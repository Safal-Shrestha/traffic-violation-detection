"""
run_worker.py - long-running per-camera detection worker.

RTSP in (MediaMTX raw path) -> YOLO + ByteTrack -> annotated frames
-> ffmpeg (H.264) -> RTSP out (MediaMTX annotated path).

One process = one camera = one tracker instance.
"""
import os

# Must be set before cv2 is imported: force RTSP over TCP (fewer dropped packets).
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

import logging
import queue
import signal
import subprocess
import threading
import time

import cv2
from ultralytics import YOLO

# ---------------------------------------------------------------- config
CAMERA_ID = os.getenv("CAMERA_ID", "camera-1")
MEDIAMTX_URL = os.getenv("MEDIAMTX_URL", "rtsp://localhost:8554")
INPUT_URL = os.getenv("INPUT_URL", f"{MEDIAMTX_URL}/{CAMERA_ID}-raw")
OUTPUT_URL = os.getenv("OUTPUT_URL", f"{MEDIAMTX_URL}/{CAMERA_ID}-annotated")
MODEL_PATH = os.getenv("MODEL_PATH", "vehicle_best.pt")
CONF = float(os.getenv("CONF", "0.4"))
DEVICE = os.getenv("DEVICE") or None          # "0" for CUDA, "cpu", or None for auto
PUBLISH_WIDTH = int(os.getenv("PUBLISH_WIDTH", "0"))  # 0 = keep source width

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] " + CAMERA_ID + " %(message)s",
)
log = logging.getLogger("worker")
stop_event = threading.Event()


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
        """Return (frame, seq) if a newer frame exists, else (None, last_seq)."""
        with self._lock:
            if self._seq == last_seq or self._frame is None:
                return None, last_seq
            return self._frame, self._seq


# ---------------------------------------------------------------- output
class Publisher(threading.Thread):
    """Pipes annotated frames into ffmpeg. Queue size 1: slow encoder => drop frames,
    never block detection."""

    def __init__(self, url):
        super().__init__(daemon=True)
        self.url = url
        self.q = queue.Queue(maxsize=1)
        self.proc = None
        self.size = None

    def submit(self, frame):
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
            "-profile:v", "baseline", "-pix_fmt", "yuv420p", "-g", "30",
            "-f", "rtsp", "-rtsp_transport", "tcp", self.url,
        ]
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL)
        self.size = (w, h)
        log.info("publishing %dx%d to %s", w, h, self.url)

    def _kill(self):
        if self.proc is not None:
            try:
                self.proc.stdin.close()
            except Exception:
                pass
            self.proc.kill()
            self.proc = None

    def run(self):
        while not stop_event.is_set():
            try:
                frame = self.q.get(timeout=0.5)
            except queue.Empty:
                continue
            h, w = frame.shape[:2]
            if self.proc is None or self.size != (w, h) or self.proc.poll() is not None:
                self._spawn(w, h)
            try:
                self.proc.stdin.write(frame.tobytes())
            except (BrokenPipeError, OSError):
                log.warning("ffmpeg pipe broke, restarting encoder")
                self._kill()
        self._kill()


# ---------------------------------------------------------------- pipeline
def extract_tracks(result):
    """Convert an ultralytics result into plain dicts for the rule engine."""
    boxes = result.boxes
    if boxes is None or boxes.id is None:
        return []
    return [
        {"id": int(i), "cls": result.names[int(c)], "conf": float(s), "xyxy": xy}
        for i, c, s, xy in zip(
            boxes.id.tolist(), boxes.cls.tolist(), boxes.conf.tolist(), boxes.xyxy.tolist()
        )
    ]


def handle_frame(tracks, frame, ts):
    """Hook for the rule engine.

    Plug in here, in this order:
      signal state provider -> red-light rule (per-track state machine)
      -> evidence ring buffer -> plate OCR on violating tracks -> outbox/POST.
    """
    return


def reset_tracker(model):
    """Clear ByteTrack state after a stream reconnect so IDs do not carry over."""
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

    grabber = FrameGrabber(INPUT_URL)
    publisher = Publisher(OUTPUT_URL)
    grabber.start()
    publisher.start()

    last_seq = -1
    last_gen = 0
    frames, t0 = 0, time.time()

    while not stop_event.is_set():
        frame, last_seq = grabber.latest(last_seq)
        if frame is None:
            time.sleep(0.005)
            continue

        if grabber.generation != last_gen:
            reset_tracker(model)
            last_gen = grabber.generation

        result = model.track(
            frame, persist=True, tracker="bytetrack.yaml",
            conf=CONF, device=DEVICE, verbose=False,
        )[0]

        ts = time.time()
        handle_frame(extract_tracks(result), frame, ts)

        annotated = result.plot()
        if PUBLISH_WIDTH and annotated.shape[1] > PUBLISH_WIDTH:
            scale = PUBLISH_WIDTH / annotated.shape[1]
            annotated = cv2.resize(annotated, (PUBLISH_WIDTH, int(annotated.shape[0] * scale)))
        publisher.submit(annotated)

        frames += 1
        if time.time() - t0 >= 5:
            log.info("inference %.1f FPS", frames / (time.time() - t0))
            frames, t0 = 0, time.time()

    log.info("shutting down")


if __name__ == "__main__":
    main()
