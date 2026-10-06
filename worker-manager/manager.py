"""Demo worker manager.

Runs on the worker/video laptop and reconciles cameras requested by Rails.
It intentionally keeps process ownership here rather than inside Rails.
"""
import json
import os
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request


BACKEND_URL = os.environ["BACKEND_URL"].rstrip("/")
MANAGER_KEY = os.environ["WORKER_MANAGER_KEY"]
MEDIAMTX_URL = os.getenv("MEDIAMTX_URL", "rtsp://127.0.0.1:8554").rstrip("/")
MEDIAMTX_HOST = os.getenv("MEDIAMTX_HOST", "127.0.0.1")
ADVERTISE_HOST = os.environ["ADVERTISE_HOST"]
VIDEO_DIR = os.path.abspath(os.getenv("VIDEO_DIR", "../infrastructure/media/videos"))
WORKER_IMAGE = os.getenv("WORKER_IMAGE", "traffic-worker:demo")
WORKER_BUILD_CONTEXT = os.path.abspath(os.getenv("WORKER_BUILD_CONTEXT", "../worker"))
MODEL_DIR = os.path.abspath(os.getenv("MODEL_DIR", WORKER_BUILD_CONTEXT))
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "5"))
CONTROL_PORT_START = int(os.getenv("CONTROL_PORT_START", "8081"))
SIGNAL_PORT_START = int(os.getenv("SIGNAL_PORT_START", "5001"))
BACKEND_TIMEOUT = 10

processes = {}


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"X-Worker-Manager-Key": MANAGER_KEY}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{BACKEND_URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=BACKEND_TIMEOUT) as response:
        return json.loads(response.read())


def port_available(port):
    with socket.socket() as sock:
        return sock.connect_ex(("0.0.0.0", port)) != 0


def allocate_port(start, used):
    port = start
    while port in used or not port_available(port):
        port += 1
    used.add(port)
    return port


def ensure_worker_image():
    if shutil.which("docker") is None:
        raise RuntimeError("docker CLI is required to run the worker manager")
    result = subprocess.run(
        ["docker", "image", "inspect", WORKER_IMAGE],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    if result.returncode == 0:
        return
    subprocess.run(["docker", "build", "-t", WORKER_IMAGE, WORKER_BUILD_CONTEXT], check=True)


def start_camera(camera, control_port, signal_port):
    camera_id = camera["camera_id"]
    raw_path = camera["raw_stream_key"]
    source = os.path.join(VIDEO_DIR, camera["source_video"])
    if not os.path.isfile(source):
        raise RuntimeError(f"source video does not exist: {source}")

    ffmpeg_name = f"traffic-ffmpeg-{camera_id}"
    worker_name = f"traffic-worker-{camera_id}"
    subprocess.run(["docker", "rm", "-f", ffmpeg_name], check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["docker", "rm", "-f", worker_name], check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    subprocess.run([
        "docker", "run", "-d", "--name", ffmpeg_name, "--network", "host",
        "-v", f"{VIDEO_DIR}:/videos:ro", "linuxserver/ffmpeg:9.0-cli-ls84",
        "-re", "-stream_loop", "-1", "-i", f"/videos/{camera['source_video']}",
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
        "-g", "30", "-bf", "0", "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
        f"{MEDIAMTX_URL}/{raw_path}",
    ], check=True)

    env = {
        "CAMERA_ID": camera_id,
        "MEDIAMTX_URL": MEDIAMTX_URL,
        "MEDIAMTX_API": f"http://{MEDIAMTX_HOST}:9997",
        "BACKEND_URL": BACKEND_URL,
        "WORKER_API_KEY": os.environ["WORKER_API_KEY"],
        "CONTROL_PORT": str(control_port),
        "ADVERTISE_PORT": str(control_port),
        "SIGNAL_API_PORT": str(signal_port),
        "SIGNAL_API_BASE_URL": f"http://{ADVERTISE_HOST}:{signal_port}",
        "ADVERTISE_HOST": ADVERTISE_HOST,
        "SIGNAL_CONTROL_TOKEN": os.environ["SIGNAL_CONTROL_TOKEN"],
    }
    command = [
        "docker", "run", "-d", "--name", worker_name, "--network", "host",
        "-v", f"{MODEL_DIR}:/models:ro",
    ]
    for key, value in env.items():
        command.extend(["-e", f"{key}={value}"])
    command.extend(["-e", "MODEL_PATH=/models/vehicle_best.pt",
                    "-e", "PLATE_MODEL_PATH=/models/plate_best.pt"])
    command.append(WORKER_IMAGE)
    subprocess.run(command, check=True)
    processes[camera_id] = {
        "ffmpeg": ffmpeg_name,
        "worker": worker_name,
        "control_port": control_port,
        "signal_port": signal_port,
    }


def reconcile():
    payload = request("GET", "/api/v1/worker-manager/cameras")
    used_control = {item["control_port"] for item in processes.values()}
    used_signal = {item["signal_port"] for item in processes.values()}
    for camera in payload["data"]:
        camera_id = camera["camera_id"]
        if camera_id in processes:
            continue
        request("POST", f"/api/v1/worker-manager/cameras/{camera_id}/claim")
        try:
            control_port = allocate_port(CONTROL_PORT_START, used_control)
            signal_port = allocate_port(SIGNAL_PORT_START, used_signal)
            start_camera(camera, control_port, signal_port)
        except Exception as exc:
            request("POST", f"/api/v1/worker-manager/cameras/{camera_id}/failure",
                   {"message": str(exc)})


def main():
    ensure_worker_image()
    while True:
        try:
            reconcile()
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            print(f"manager reconciliation failed: {exc}", flush=True)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
