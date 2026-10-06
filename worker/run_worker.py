"""
run_worker.py - long-running per-camera detection worker (v3).

Always on:   RTSP in (raw path) -> YOLO + ByteTrack -> rule engine / violations
On demand:   annotated frames -> ffmpeg (H.264) -> RTSP out (annotated path)

Adding a camera needs no MediaMTX file edits. At startup the worker registers its own
annotated path through the MediaMTX control API, with a runOnDemand hook that points
back at this worker. The registration is verified every REGISTER_INTERVAL seconds, so
it survives a MediaMTX restart, and it is removed when the worker shuts down.
"""
import os

# Must be set before cv2 is imported: force RTSP over TCP.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

import base64
import argparse
import json
import logging
import math
import queue
import signal
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

import cv2
import easyocr
import numpy as np
import torch
from ultralytics import YOLO

load_dotenv()

# ---------------------------------------------------------------- config
CAMERA_ID = os.getenv("CAMERA_ID", "camera-1")
MEDIAMTX_URL = os.getenv("MEDIAMTX_URL", "rtsp://localhost:8554")
INPUT_URL = f"{MEDIAMTX_URL}/{CAMERA_ID}-raw"
OUTPUT_URL = f"{MEDIAMTX_URL}/{CAMERA_ID}-annotated"
MODEL_PATH = os.getenv("MODEL_PATH", "vehicle_best.pt")
PLATE_MODEL_PATH = os.getenv("PLATE_MODEL_PATH", "plate_best.pt")
CONF = float(os.getenv("CONF", "0.4"))
PLATE_CONF = float(os.getenv("PLATE_CONF", "0.25"))
OCR_LANGS = os.getenv("OCR_LANGS", "en").split(",")
OCR_ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
DEVICE = os.getenv("DEVICE") or None                  # "0" for CUDA, "cpu", or None for auto
PUBLISH_WIDTH = int(os.getenv("PUBLISH_WIDTH", "0"))  # 0 = keep source width

_mtx_host = urlparse(MEDIAMTX_URL).hostname or "localhost"
MEDIAMTX_API = os.getenv("MEDIAMTX_API", f"http://{_mtx_host}:9997").rstrip("/")
MEDIAMTX_API_USER = os.getenv("MEDIAMTX_API_USER", "")
MEDIAMTX_API_PASS = os.getenv("MEDIAMTX_API_PASS", "")
OUTPUT_PATH_NAME = urlparse(OUTPUT_URL).path.lstrip("/")
SIGNAL_STATE_KEY = f"camera_signal_{CAMERA_ID}"

GRACE_SECONDS = float(os.getenv("GRACE_SECONDS", "10"))       # keep publishing after the last viewer
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "2"))          # reader poll interval
REGISTER_INTERVAL = float(os.getenv("REGISTER_INTERVAL", "30"))
REGISTER_PATH = os.getenv("REGISTER_PATH", "1") == "1"        # 0 = path is managed in mediamtx.yml
CONTROL_PORT = int(os.getenv("CONTROL_PORT", "8081"))         # control server, unique per worker per host
SIGNAL_API_PORT = int(os.getenv("SIGNAL_API_PORT", "5001"))
SIGNAL_API_BASE_URL = os.getenv("SIGNAL_API_BASE_URL", "")
BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
WORKER_API_KEY = os.getenv("WORKER_API_KEY", "")
SIGNAL_CONTROL_TOKEN = os.getenv("SIGNAL_CONTROL_TOKEN", "")
ADVERTISE_HOST = os.getenv("ADVERTISE_HOST", "")              # LAN IP MediaMTX uses to reach this worker
ADVERTISE_PORT = int(os.getenv("ADVERTISE_PORT", str(CONTROL_PORT)))
FORCE_PUBLISH = os.getenv("FORCE_PUBLISH", "0") == "1"        # debugging: publish without viewers
CONFIG_POLL_SECONDS = float(os.getenv("CONFIG_POLL_SECONDS", "5"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] " + CAMERA_ID + " %(message)s",
)
log = logging.getLogger("worker")
stop_event = threading.Event()


class SignalState:
    def __init__(self):
        self._lock = threading.Lock()
        self._state = "RED"
        self._updated_at = time.time()

    def read(self):
        with self._lock:
            return self._state, self._updated_at

    def write(self, state):
        with self._lock:
            state = str(state).upper()
            if state != self._state:
                self._state = state
                self._updated_at = time.time()


signal_state = SignalState()


class DetectionState:
    """Thread-safe latest detection event exposed by the worker control API."""

    def __init__(self):
        self._lock = threading.Lock()
        self._latest = None

    def replace(self, event):
        with self._lock:
            self._latest = event

    def latest(self):
        with self._lock:
            return self._latest


detection_state = DetectionState()
camera_config = {"config_version": 0, "stop_line": None, "red_grace_seconds": 0.0}
camera_config_lock = threading.Lock()
plate_cache = {}
plate_lock = threading.Lock()
ocr_lock = threading.Lock()


class RedLightRule:
    """Detect one directional stop-line crossing per tracked vehicle during RED."""

    def __init__(self, margin_px=8):
        self.margin_px = margin_px
        self._tracks = {}

    def reset(self):
        self._tracks.clear()

    @staticmethod
    def _signed_distance(point, line, length):
        ax, ay, bx, by = line
        px, py = point
        return ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / length

    @staticmethod
    def _approach_sign(line, side):
        ax, ay, bx, by = line
        mx, my = (ax + bx) / 2, (ay + by) / 2
        length = math.hypot(bx - ax, by - ay)
        offsets = {
            "above": (0, -length), "below": (0, length),
            "left": (-length, 0), "right": (length, 0),
        }
        if side not in offsets:
            raise ValueError(f"unknown stop-line approach_side: {side!r}")
        ox, oy = offsets[side]
        d = RedLightRule._signed_distance((mx + ox, my + oy), line, length)
        if abs(d) < 1e-6:
            raise ValueError(f"approach_side {side!r} does not identify a side of the stop line")
        return 1 if d > 0 else -1

    def evaluate(self, tracks, config, frame_shape, signal, frame_sequence, now=None):
        """Return crossings; config geometry is scaled from calibration resolution."""
        stop_line = config.get("stop_line")
        if not stop_line:
            return []
        height, width = frame_shape[:2]
        ref_width = float(config.get("frame_width") or width)
        ref_height = float(config.get("frame_height") or height)
        sx, sy = width / ref_width, height / ref_height
        p1, p2 = stop_line["p1"], stop_line["p2"]
        line = (float(p1["x"]) * sx, float(p1["y"]) * sy,
                float(p2["x"]) * sx, float(p2["y"]) * sy)
        length = math.hypot(line[2] - line[0], line[3] - line[1])
        if length < 5:
            return []
        approach_sign = self._approach_sign(line, stop_line.get("approach_side", ""))
        margin = self.margin_px * (sx + sy) / 2
        now = time.time() if now is None else now
        state, state_updated_at = signal
        red_grace = max(0.0, float(config.get("red_grace_seconds", 0.0)))
        red_active = state == "RED" and now - state_updated_at >= red_grace

        events = []
        seen = set()
        for track in tracks:
            track_id = int(track["id"])
            seen.add(track_id)
            x1, y1, x2, y2 = track["xyxy"]
            point = ((x1 + x2) / 2, y2)  # bottom-centre matches app.py
            distance = self._signed_distance(point, line, length)
            along = ((point[0] - line[0]) * (line[2] - line[0]) +
                     (point[1] - line[1]) * (line[3] - line[1])) / (length * length)
            info = self._tracks.setdefault(track_id, {"side": 0, "violated": False})
            current_side = 1 if distance > margin else -1 if distance < -margin else 0
            crossed = (red_active and not info["violated"] and current_side == -approach_sign
                       and info["side"] == approach_sign and -0.15 <= along <= 1.15)
            if crossed:
                info["violated"] = True
                events.append({
                    "track_id": track_id,
                    "vehicle_class": track["cls"],
                    "detection_confidence": track["conf"],
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    "frame_sequence": frame_sequence,
                    "occurred_at": datetime.fromtimestamp(now, timezone.utc).isoformat(),
                    "signal_state": state,
                    "red_started_at": datetime.fromtimestamp(state_updated_at, timezone.utc).isoformat(),
                    "stop_line_snapshot": stop_line,
                    "config_version": config.get("config_version"),
                })
            if current_side:
                info["side"] = current_side
            info["last_seen"] = frame_sequence

        # Bound memory when ByteTrack expires IDs or streams run for a long time.
        for track_id, info in list(self._tracks.items()):
            if track_id not in seen and frame_sequence - info.get("last_seen", frame_sequence) > 300:
                del self._tracks[track_id]
        return events


red_light_rule = RedLightRule()


# ---------------------------------------------------------------- MediaMTX control API
def mtx_request(method, endpoint, body=None, timeout=2):
    """Returns (status, json_or_None). status is None when the API is unreachable."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{MEDIAMTX_API}{endpoint}", data=data, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if MEDIAMTX_API_USER:
        token = base64.b64encode(f"{MEDIAMTX_API_USER}:{MEDIAMTX_API_PASS}".encode()).decode()
        req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return None, None


def detect_advertise_host():
    """Local address the OS would use to reach MediaMTX. Inside Docker this is the
    container's bridge IP, which MediaMTX cannot reach, so set ADVERTISE_HOST there."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect((_mtx_host, 9))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


class PathRegistrar(threading.Thread):
    """Keeps this camera's annotated path registered in MediaMTX with a runOnDemand hook."""

    def __init__(self, path_name, hold_url, interval):
        super().__init__(daemon=True)
        self.path_name = path_name
        self.interval = interval
        self.desired = {
            "source": "publisher",
            "runOnDemand": f"wget -qO- {hold_url}",
            "runOnDemandStartTimeout": "15s",
            "runOnDemandCloseAfter": "2s",   # the worker owns the real grace period
        }
        self._ok = None

    def ensure(self):
        status, conf = mtx_request("GET", f"/v3/config/paths/get/{self.path_name}")
        if status == 200 and conf and conf.get("runOnDemand") == self.desired["runOnDemand"]:
            return True
        if status == 200:
            status, _ = mtx_request("PATCH", f"/v3/config/paths/patch/{self.path_name}", self.desired)
        else:
            status, _ = mtx_request("POST", f"/v3/config/paths/add/{self.path_name}", self.desired)
        return status == 200

    def unregister(self):
        status, _ = mtx_request("DELETE", f"/v3/config/paths/delete/{self.path_name}")
        log.info("unregistered path %s (status %s)", self.path_name, status)

    def run(self):
        while not stop_event.is_set():
            ok = self.ensure()
            if ok != self._ok:
                if ok:
                    log.info("registered path %s -> %s", self.path_name, self.desired["runOnDemand"])
                else:
                    log.warning("cannot register path %s with MediaMTX API %s (check api/auth/port 9997)",
                                self.path_name, MEDIAMTX_API)
                self._ok = ok
            stop_event.wait(self.interval if ok else 5)


# ---------------------------------------------------------------- viewer presence
class ViewerGate:
    """active = (open hold connections > 0) OR (a viewer signal was seen within `grace`)."""

    def __init__(self, path_name, grace, poll_s):
        self.path_name = path_name
        self.grace = grace
        self.poll_s = poll_s
        self._lock = threading.Lock()
        self._holds = 0
        self._readers = 0
        self._last_seen = float("-inf")
        self._api_ok = None

    def hold_open(self):
        with self._lock:
            self._holds += 1
            self._last_seen = time.monotonic()
        log.info("viewer hold opened (holds=%d)", self._holds)

    def hold_close(self):
        with self._lock:
            self._holds = max(0, self._holds - 1)
            self._last_seen = time.monotonic()
        log.info("viewer hold closed (holds=%d)", self._holds)

    def _set_api_ok(self, ok, detail=""):
        if ok != self._api_ok:
            if ok:
                log.info("MediaMTX API reachable at %s", MEDIAMTX_API)
            else:
                log.warning("MediaMTX API poll failing (%s); relying on hold connections", detail)
            self._api_ok = ok

    def poll_loop(self):
        while not stop_event.is_set():
            readers = 0
            status, data = mtx_request("GET", f"/v3/paths/get/{self.path_name}")
            if status == 200:
                readers = len((data or {}).get("readers") or [])
                self._set_api_ok(True)
            elif status == 404:              # path not live, so nobody can be reading it
                self._set_api_ok(True)
            elif status is None:
                self._set_api_ok(False, "unreachable")
            else:
                self._set_api_ok(False, f"HTTP {status}")
            with self._lock:
                self._readers = readers
                if readers > 0:
                    self._last_seen = time.monotonic()
            stop_event.wait(self.poll_s)

    @property
    def active(self):
        with self._lock:
            if self._holds > 0:
                return True
            return (time.monotonic() - self._last_seen) < self.grace

    def status(self):
        with self._lock:
            return {"holds": self._holds, "readers": self._readers, "api_ok": self._api_ok}


# ---------------------------------------------------------------- control server
class ControlHandler(BaseHTTPRequestHandler):
    """GET /viewer/hold  long-lived; open while MediaMTX reports readers (runOnDemand)
       GET /health       JSON status
       GET /detections/latest  latest vehicle and plate-recognition JSON"""

    def do_GET(self):
        server = self.server
        if self.path.startswith("/viewer/hold"):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            server.gate.hold_open()
            try:
                while not stop_event.is_set():
                    self.wfile.write(b".\n")      # heartbeat: a dead peer raises an error
                    self.wfile.flush()
                    time.sleep(2)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                server.gate.hold_close()
        elif self.path.startswith("/health"):
            body = json.dumps({
                "camera": CAMERA_ID,
                "publishing": server.publisher.enabled,
                **server.gate.status(),
                "inference_fps": round(server.stats.get("fps", 0.0), 1),
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith("/detections/latest"):
            body = json.dumps(
                detection_state.latest() or {
                    "camera_id": CAMERA_ID,
                    "status": "no detections processed yet",
                    "fibonacci_track_ids": [],
                    "fibonacci_tracks": [],
                    "tracks": [],
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def log_message(self, *args):
        return


class SignalHandler(BaseHTTPRequestHandler):
    def _response(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", os.getenv("SIGNAL_CORS_ORIGIN", "*"))
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._response(204, {})

    def do_GET(self):
        if not self._matches_key():
            self._response(404, {"error": "unknown signal key"})
            return
        state, updated_at = signal_state.read()
        self._response(200, {
            "signal_state_key": SIGNAL_STATE_KEY,
            "camera_id": CAMERA_ID,
            "state": state,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(updated_at)),
        })

    def do_PUT(self):
        if not self._matches_key():
            self._response(404, {"error": "unknown signal key"})
            return
        expected = SIGNAL_CONTROL_TOKEN
        provided = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        if not expected or provided != expected:
            self._response(401, {"error": "unauthorized"})
            return
        try:
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            state = str(payload["state"]).upper()
        except (ValueError, KeyError, json.JSONDecodeError):
            self._response(422, {"error": "state must be RED, YELLOW, or GREEN"})
            return
        if state not in {"RED", "YELLOW", "GREEN"}:
            self._response(422, {"error": "state must be RED, YELLOW, or GREEN"})
            return
        signal_state.write(state)
        self.do_GET()

    def _matches_key(self):
        return self.path.rstrip("/").endswith(f"/signal/{unquote(SIGNAL_STATE_KEY)}")

    def log_message(self, *args):
        return


def report_heartbeat():
    if not BACKEND_URL or not WORKER_API_KEY:
        log.warning("BACKEND_URL or WORKER_API_KEY missing; worker heartbeat disabled")
        return
    host = ADVERTISE_HOST or detect_advertise_host()
    signal_base = SIGNAL_API_BASE_URL or f"http://{host}:{SIGNAL_API_PORT}"
    control_base = f"http://{host}:{ADVERTISE_PORT}"
    payload = json.dumps({
        "status": "RUNNING",
        "control_api_base_url": control_base,
        "signal_api_base_url": signal_base,
    }).encode()
    request = urllib.request.Request(
        f"{BACKEND_URL}/api/v1/cameras/{CAMERA_ID}/heartbeat",
        data=payload,
        headers={"Content-Type": "application/json", "X-Worker-Key": WORKER_API_KEY},
        method="POST",
    )
    try:
        urllib.request.urlopen(request, timeout=5).read()
    except (urllib.error.URLError, TimeoutError) as exc:
        log.warning("heartbeat failed: %s", exc)


def heartbeat_loop():
    while not stop_event.is_set():
        report_heartbeat()
        stop_event.wait(10)


def config_loop():
    """Fetch the persisted calibration so every worker uses the backend's latest version."""
    while not stop_event.is_set():
        try:
            req = urllib.request.Request(
                f"{BACKEND_URL}/api/v1/cameras/{CAMERA_ID}/config",
                headers={"X-Worker-Key": WORKER_API_KEY},
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                config = json.loads(response.read())
            with camera_config_lock:
                camera_config.update(config)
            log.info("loaded camera config version %s (calibrated=%s)",
                     config.get("config_version"), config.get("stop_line") is not None)
        except Exception as exc:
            log.warning("camera config fetch failed: %s", exc)
        stop_event.wait(CONFIG_POLL_SECONDS)


# ---------------------------------------------------------------- input
class FrameGrabber(threading.Thread):
    """Reads the RTSP stream and keeps only the newest frame (drops stale ones)."""

    def __init__(self, url):
        super().__init__(daemon=True)
        self.url = url
        self._lock = threading.Lock()
        self._frame = None
        self._seq = 0
        self.generation = 0  # increments on every (re)connect

    def run(self):
        while not stop_event.is_set():
            cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
            if not cap.isOpened():
                log.warning("cannot open %s, retrying in 2s", self.url)
                cap.release()
                time.sleep(2)
                continue
            self.generation += 1
            log.info("connected to %s (generation %d)", self.url, self.generation)
            while not stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    log.warning("stream lost, reconnecting")
                    break
                with self._lock:
                    self._frame = frame
                    self._seq += 1
            cap.release()
            time.sleep(1)

    def latest(self, last_seq):
        with self._lock:
            if self._seq == last_seq or self._frame is None:
                return None, last_seq
            return self._frame, self._seq


# ---------------------------------------------------------------- output
class Publisher(threading.Thread):
    """Annotated-stream publisher, disabled by default.

    set_enabled(True)  -> accepts frames, spawns ffmpeg on the first one
    set_enabled(False) -> drops queued frames and kills ffmpeg, which closes the path

    Queue size 1: a slow encoder drops frames and never blocks detection.
    """

    def __init__(self, url):
        super().__init__(daemon=True)
        self.url = url
        self.q = queue.Queue(maxsize=1)
        self.proc = None
        self.size = None
        self.enabled = False

    def set_enabled(self, on):
        if on == self.enabled:
            return
        self.enabled = on
        if on:
            log.info("annotated publishing ON -> %s", self.url)
        else:
            self._drain()
            self._kill()
            log.info("annotated publishing OFF")

    def _drain(self):
        try:
            while True:
                self.q.get_nowait()
        except queue.Empty:
            pass

    def submit(self, frame):
        if not self.enabled:
            return
        try:
            self.q.put_nowait(frame)
        except queue.Full:
            try:
                self.q.get_nowait()
            except queue.Empty:
                pass
            try:
                self.q.put_nowait(frame)
            except queue.Full:
                pass

    def _spawn(self, w, h):
        self._kill()
        cmd = [
            "ffmpeg", "-loglevel", "warning",
            "-use_wallclock_as_timestamps", "1",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-i", "-",
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
            "-profile:v", "baseline", "-pix_fmt", "yuv420p",
            "-g", "15",                       # short GOP: a new viewer gets a keyframe fast
            "-f", "rtsp", "-rtsp_transport", "tcp", self.url,
        ]
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL)
        self.size = (w, h)
        log.info("encoder started %dx%d", w, h)

    def _kill(self):
        p, self.proc = self.proc, None
        if p is not None:
            try:
                p.stdin.close()
            except Exception:
                pass
            p.kill()
            try:
                p.wait(timeout=2)
            except Exception:
                pass

    def run(self):
        while not stop_event.is_set():
            try:
                frame = self.q.get(timeout=0.5)
            except queue.Empty:
                if not self.enabled:
                    self._kill()
                continue
            if not self.enabled:
                self._kill()
                continue
            h, w = frame.shape[:2]
            if self.proc is None or self.size != (w, h) or self.proc.poll() is not None:
                self._spawn(w, h)
            try:
                self.proc.stdin.write(frame.tobytes())
            except (BrokenPipeError, OSError, AttributeError):
                log.warning("encoder pipe closed")
                self._kill()
        self._kill()


# ---------------------------------------------------------------- pipeline
def encode_jpg_b64(image, quality=85):
    ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("could not encode evidence frame as JPEG")
    return base64.b64encode(data).decode("ascii")


def preprocess_for_ocr(crop):
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    if h < 64: # upscale small plates, OCR does much better
        scale = 64 / h
        gray = cv2.resize(gray, (int(w * scale), 64), interpolation=cv2.INTER_CUBIC)
    return cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4)).apply(gray)


def recognize_plate(frame, vehicle_box, plate_model, ocr_reader):
    """Run plate detection and OCR for one tracked vehicle crop."""
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = vehicle_box
    x1, x2 = max(0, min(width, int(x1))), max(0, min(width, int(x2)))
    y1, y2 = max(0, min(height, int(y1))), max(0, min(height, int(y2)))
    vehicle_bbox = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
    if x2 <= x1 or y2 <= y1:
        return {"vehicle_bbox": vehicle_bbox, "plates": []}

    vehicle_crop = frame[y1:y2, x1:x2]
    with plate_lock:
        result = plate_model.predict(
            vehicle_crop, conf=PLATE_CONF, device=DEVICE, verbose=False
        )[0]

    plates = []
    if result.boxes is None or len(result.boxes) == 0:
        return {"vehicle_bbox": vehicle_bbox, "plates": plates}

    boxes = result.boxes.xyxy.cpu().numpy()
    confidences = result.boxes.conf.cpu().numpy()
    for (px1, py1, px2, py2), plate_confidence in sorted(
        zip(boxes, confidences), key=lambda item: -item[1]
    ):
        cx1, cy1 = max(0, int(px1)), max(0, int(py1))
        cx2, cy2 = min(vehicle_crop.shape[1], int(px2)), min(vehicle_crop.shape[0], int(py2))
        plate_crop = vehicle_crop[cy1:cy2, cx1:cx2]
        if plate_crop.size == 0:
            continue

        with ocr_lock:
            ocr_results = ocr_reader.readtext(
                preprocess_for_ocr(plate_crop),
                allowlist=OCR_ALLOWLIST,
                detail=1,
                paragraph=False,
            )
        parts = [
            {"text": text.upper().replace(" ", ""), "confidence": round(float(confidence), 4)}
            for _, text, confidence in ocr_results
        ]
        plates.append({
            "plate_text": "".join(part["text"] for part in parts),
            "ocr_confidence": round(
                sum(part["confidence"] for part in parts) / len(parts), 4
            ) if parts else 0.0,
            "detection_confidence": round(float(plate_confidence), 4),
            "plate_bbox": {
                "x1": round(float(px1) + x1, 2),
                "y1": round(float(py1) + y1, 2),
                "x2": round(float(px2) + x1, 2),
                "y2": round(float(py2) + y1, 2),
            },
            "ocr_parts": parts,
        })

    return {"vehicle_bbox": vehicle_bbox, "plates": plates}


def extract_tracks(result):
    """Convert an ultralytics result into plain dicts for the rule engine."""
    boxes = result.boxes
    if boxes is None or boxes.id is None:
        return []
    return [
        {
            "id": int(i),
            "cls": result.names[int(c)],
            "conf": round(float(s), 4),
            "xyxy": [round(float(value), 2) for value in xy],
        }
        for i, c, s, xy in zip(
            boxes.id.tolist(), boxes.cls.tolist(), boxes.conf.tolist(), boxes.xyxy.tolist()
        )
    ]


def handle_frame(tracks, frame, ts, frame_seq, plate_model, ocr_reader):
    """Apply the signal and stop-line rule to each live frame; OCR only violators."""
    with camera_config_lock:
        active_config = dict(camera_config)
    signal = signal_state.read()
    violations = red_light_rule.evaluate(
        tracks, active_config, frame.shape, signal, frame_seq, now=ts
    )
    tracks_by_id = {track["id"]: track for track in tracks}
    for violation in violations:
        track = tracks_by_id[violation["track_id"]]
        plate_result = recognize_plate(frame, track["xyxy"], plate_model, ocr_reader)
        plates = plate_result["plates"]
        plate = next((item for item in plates if item["plate_text"]), None)
        violation["plate_recognition"] = plate_result
        violation["detected_plate_raw"] = plate["plate_text"] if plate else None
        violation["plate_confidence"] = plate["ocr_confidence"] if plate else None
        violation["evidence_image_base64"] = encode_jpg_b64(frame, quality=80)
        log.warning(
            "RED_LIGHT violation: track=%s class=%s plate=%s frame=%s",
            violation["track_id"], violation["vehicle_class"],
            violation["detected_plate_raw"] or "unreadable", violation["frame_sequence"],
        )

    detection_state.replace({
        "camera_id": CAMERA_ID,
        "timestamp_unix": round(ts, 3),
        "frame_sequence": frame_seq,
        "config_version": active_config.get("config_version"),
        "signal_state": signal[0],
        "calibrated": active_config.get("stop_line") is not None,
        "stop_line": active_config.get("stop_line"),
        "frame_width": active_config.get("frame_width"),
        "frame_height": active_config.get("frame_height"),
        "red_grace_seconds": active_config.get("red_grace_seconds", 0.0),
        "tracks": tracks,
        "violations": violations,
    })


def reset_tracker(model):
    """Clear ByteTrack state after a stream reconnect so IDs do not carry over."""
    plate_cache.clear()
    red_light_rule.reset()
    try:
        for t in model.predictor.trackers:
            t.reset()
    except Exception:
        pass


def cli_rule_self_test():
    """Exercise signal -> calibrated line -> crossing -> one evidence event."""
    global camera_config
    red_light_rule.reset()
    camera_config = {
        "config_version": 7,
        "frame_width": 200,
        "frame_height": 200,
        "stop_line": {
            "p1": {"x": 20, "y": 100},
            "p2": {"x": 180, "y": 100},
            "approach_side": "below",
        },
        "red_grace_seconds": 0.5,
    }
    frame = np.zeros((400, 400, 3), dtype=np.uint8)

    class EmptyPlateModel:
        def predict(self, *_args, **_kwargs):
            return [type("Result", (), {"boxes": None})()]

    track = lambda track_id, top, bottom: {
        "id": track_id, "cls": "car", "conf": 0.93,
        "xyxy": [160.0, top, 240.0, bottom],
    }
    model = EmptyPlateModel()
    ocr = object()

    signal_state.write("GREEN")
    handle_frame([track(1, 220, 260)], frame, time.time(), 1, model, ocr)
    handle_frame([track(1, 100, 140)], frame, time.time(), 2, model, ocr)
    if detection_state.latest().get("violations"):
        raise AssertionError("a green-light crossing was incorrectly reported")

    signal_state.write("RED")
    red_started = signal_state.read()[1]
    handle_frame([track(4, 220, 260)], frame, red_started + 0.1, 3, model, ocr)
    handle_frame([track(4, 100, 140)], frame, red_started + 0.3, 4, model, ocr)
    if detection_state.latest().get("violations"):
        raise AssertionError("a crossing during the red grace period was reported")

    handle_frame([track(2, 220, 260)], frame, red_started + 0.4, 5, model, ocr)
    handle_frame([track(2, 100, 140)], frame, red_started + 0.8, 6, model, ocr)
    event = detection_state.latest()["violations"]
    if len(event) != 1 or event[0]["track_id"] != 2:
        raise AssertionError(f"expected one RED crossing event, got {event!r}")
    if event[0]["config_version"] != 7 or not event[0]["evidence_image_base64"]:
        raise AssertionError("violation is missing calibration version or frame evidence")

    handle_frame([track(2, 80, 120)], frame, red_started + 1.0, 7, model, ocr)
    if detection_state.latest().get("violations"):
        raise AssertionError("the same track generated a duplicate violation")

    handle_frame([track(3, 100, 140)], frame, red_started + 1.1, 8, model, ocr)
    handle_frame([track(3, 220, 260)], frame, red_started + 1.2, 9, model, ocr)
    if detection_state.latest().get("violations"):
        raise AssertionError("a crossing from the exit side was incorrectly reported")

    print("CLI red-light workflow PASS: signal state, scaled line, grace period, direction, "
          "single event and JPEG evidence")


def main():
    signal.signal(signal.SIGTERM, lambda *_: stop_event.set())
    signal.signal(signal.SIGINT, lambda *_: stop_event.set())

    log.info("loading model %s", MODEL_PATH)
    model = YOLO(MODEL_PATH)
    log.info("loading plate model %s", PLATE_MODEL_PATH)
    plate_model = YOLO(PLATE_MODEL_PATH)
    ocr_reader = easyocr.Reader(OCR_LANGS, gpu=torch.cuda.is_available())

    grabber = FrameGrabber(INPUT_URL)
    publisher = Publisher(OUTPUT_URL)
    gate = ViewerGate(OUTPUT_PATH_NAME, GRACE_SECONDS, POLL_SECONDS)
    stats = {"fps": 0.0}

    server = ThreadingHTTPServer(("0.0.0.0", CONTROL_PORT), ControlHandler)
    server.daemon_threads = True
    server.gate, server.publisher, server.stats = gate, publisher, stats
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log.info("control server on :%d (viewer hold + /health)", CONTROL_PORT)

    signal_server = ThreadingHTTPServer(("0.0.0.0", SIGNAL_API_PORT), SignalHandler)
    signal_server.daemon_threads = True
    threading.Thread(target=signal_server.serve_forever, daemon=True).start()
    log.info("signal server on :%d", SIGNAL_API_PORT)
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    threading.Thread(target=config_loop, daemon=True).start()

    registrar = None
    if REGISTER_PATH:
        host = ADVERTISE_HOST or detect_advertise_host()
        if not ADVERTISE_HOST:
            log.warning("ADVERTISE_HOST not set, using %s. Inside Docker, set it to the laptop's "
                        "LAN IP and publish port %d.", host, ADVERTISE_PORT)
        registrar = PathRegistrar(
            OUTPUT_PATH_NAME, f"http://{host}:{ADVERTISE_PORT}/viewer/hold", REGISTER_INTERVAL
        )
        registrar.start()

    grabber.start()
    publisher.start()
    threading.Thread(target=gate.poll_loop, daemon=True).start()

    last_seq, last_gen = -1, 0
    frames, t0 = 0, time.time()

    while not stop_event.is_set():
        frame, last_seq = grabber.latest(last_seq)
        if frame is None:
            time.sleep(0.005)
            continue

        if grabber.generation != last_gen:
            reset_tracker(model)
            last_gen = grabber.generation

        # Detection and rules: always on.
        result = model.track(
            frame, persist=True, tracker="bytetrack.yaml",
            conf=CONF, device=DEVICE, verbose=False,
        )[0]
        handle_frame(
            extract_tracks(result),
            frame,
            time.time(),
            last_seq,
            plate_model,
            ocr_reader,
        )

        # Annotated branch: only while someone is watching.
        publisher.set_enabled(FORCE_PUBLISH or gate.active)
        if publisher.enabled:
            annotated = result.plot()
            if PUBLISH_WIDTH and annotated.shape[1] > PUBLISH_WIDTH:
                scale = PUBLISH_WIDTH / annotated.shape[1]
                annotated = cv2.resize(
                    annotated, (PUBLISH_WIDTH, int(annotated.shape[0] * scale))
                )
            publisher.submit(annotated)

        frames += 1
        if time.time() - t0 >= 5:
            stats["fps"] = frames / (time.time() - t0)
            log.info("inference %.1f FPS | publishing=%s | %s",
                     stats["fps"], publisher.enabled, gate.status())
            frames, t0 = 0, time.time()

    log.info("shutting down")
    publisher.set_enabled(False)
    if registrar is not None:
        registrar.unregister()
    server.shutdown()
    signal_server.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Per-camera vehicle detection worker")
    parser.add_argument("--self-test-rules", action="store_true",
                        help="run a local synthetic red-light workflow check without services")
    args = parser.parse_args()
    if args.self_test_rules:
        cli_rule_self_test()
    else:
        main()
