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
import json
import logging
import queue
import signal
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

import cv2
import easyocr
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
plate_cache = {}
plate_lock = threading.Lock()
ocr_lock = threading.Lock()


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
    """Rule engine hook. Runs on EVERY frame, whether or not anyone is watching.

    `frame` is the raw, unannotated frame. Take evidence snapshots and clips from it,
    because the annotated frame only exists while a viewer is connected.

    Plug in, in this order:
      signal state provider -> red-light rule (per-track state machine)
      -> evidence ring buffer -> plate OCR on violating tracks -> outbox/POST.
    """
    for track in tracks:
        # Dummy rule to invoke plate reading
        if (track["id"]%15)==0:
            continue
        if track["id"] not in plate_cache:
            plate_cache[track["id"]] = recognize_plate(
                frame, track["xyxy"], plate_model, ocr_reader
            )
        track["plate_recognition"] = plate_cache[track["id"]]

    detection_state.replace({
        "camera_id": CAMERA_ID,
        "timestamp_unix": round(ts, 3),
        "frame_sequence": frame_seq,
        "tracks": tracks,
    })


def reset_tracker(model):
    """Clear ByteTrack state after a stream reconnect so IDs do not carry over."""
    plate_cache.clear()
    try:
        for t in model.predictor.trackers:
            t.reset()
    except Exception:
        pass


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
    main()
