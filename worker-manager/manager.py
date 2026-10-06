"""Provision a video publisher on B and a detection worker on C from Rails on A."""
import json
import os
import shutil
import shlex
import socket
import subprocess
import time
import urllib.request

from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.environ["BACKEND_URL"].rstrip("/")
MANAGER_KEY = os.environ["WORKER_MANAGER_KEY"]
MEDIAMTX_URL = os.getenv("MEDIAMTX_URL", "rtsp://127.0.0.1:8554").rstrip("/")
VIDEO_PUBLISH_URL = os.getenv("VIDEO_PUBLISH_URL", MEDIAMTX_URL).rstrip("/")
MEDIAMTX_HOST = os.getenv("MEDIAMTX_HOST", "127.0.0.1")
ADVERTISE_HOST = os.environ["ADVERTISE_HOST"]
# The manager runs on laptop A. Source videos and MediaMTX live on B; the
# detection containers and model weights live on C. SSH runs the local parts on
# their owning machines while the manager remains the single orchestrator.
VIDEO_SSH_TARGET = os.getenv("VIDEO_SSH_TARGET", "")
WORKER_SSH_TARGET = os.getenv("WORKER_SSH_TARGET", "")
VIDEO_DIR = os.path.abspath(os.getenv("VIDEO_DIR", "../infrastructure/media/videos"))
VIDEO_DIR_ON_B = os.getenv("VIDEO_DIR_ON_B", "")
MODEL_DIR_ON_C = os.getenv("MODEL_DIR_ON_C", "")
WORKER_BUILD_CONTEXT_ON_C = os.getenv("WORKER_BUILD_CONTEXT_ON_C", "")
WORKER_IMAGE = os.getenv("WORKER_IMAGE", "traffic-worker:demo")
MEDIAMTX_API_USER = os.getenv("MEDIAMTX_API_USER", "worker")
MEDIAMTX_API_PASS = os.getenv("MEDIAMTX_API_PASS", "change-me")
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
    if WORKER_SSH_TARGET:
        probe = ssh(WORKER_SSH_TARGET, ["python3", "-c",
            "import socket,sys; s=socket.socket(); s.settimeout(.3); sys.exit(0 if s.connect_ex(('127.0.0.1', int(sys.argv[1]))) else 1)", str(port)],
            check=False)
        return probe.returncode == 0
    with socket.socket() as sock:
        return sock.connect_ex(("0.0.0.0", port)) != 0


def allocate_port(start, used):
    port = start
    while port in used or not port_available(port):
        port += 1
    used.add(port)
    return port


def ssh(target, command, *, check=True):
    if not target:
        raise RuntimeError("VIDEO_SSH_TARGET and WORKER_SSH_TARGET must be configured")
    return subprocess.run(["ssh", target, "bash", "-lc", shlex.join(command)],
                          check=check, text=True, capture_output=True)


def ensure_worker_image():
    if WORKER_SSH_TARGET:
        inspect = ssh(WORKER_SSH_TARGET,
                      ["docker", "image", "inspect", WORKER_IMAGE], check=False)
        if inspect.returncode == 0:
            return
        if not WORKER_BUILD_CONTEXT_ON_C:
            raise RuntimeError("WORKER_BUILD_CONTEXT_ON_C is required to build the image on laptop C")
        ssh(WORKER_SSH_TARGET,
            ["docker", "build", "-t", WORKER_IMAGE, WORKER_BUILD_CONTEXT_ON_C])
        return
    if shutil.which("docker") is None:
        raise RuntimeError("docker CLI is required when WORKER_SSH_TARGET is not configured")
    result = subprocess.run(["docker", "image", "inspect", WORKER_IMAGE],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode:
        subprocess.run(["docker", "build", "-t", WORKER_IMAGE, WORKER_BUILD_CONTEXT], check=True)


def start_camera(camera, control_port, signal_port):
    camera_id = camera["camera_id"]
    raw_path = camera["raw_stream_key"]
    remote_video = bool(VIDEO_SSH_TARGET)
    video_dir = VIDEO_DIR_ON_B if remote_video else VIDEO_DIR
    source = os.path.join(video_dir, camera["source_video"])
    if remote_video:
        check = ssh(VIDEO_SSH_TARGET, ["test", "-f", source], check=False)
        if check.returncode:
            raise RuntimeError(f"source video does not exist on laptop B: {source}")
    elif not os.path.isfile(source):
        raise RuntimeError(f"source video does not exist: {source}")

    ffmpeg_name = f"traffic-ffmpeg-{camera_id}"
    worker_name = f"traffic-worker-{camera_id}"
    if remote_video:
        pid_file = f"/tmp/{ffmpeg_name}.pid"
        ssh(VIDEO_SSH_TARGET, ["bash", "-lc", f"if test -f {shlex.quote(pid_file)}; then kill $(cat {shlex.quote(pid_file)}) 2>/dev/null || true; rm -f {shlex.quote(pid_file)}; fi"], check=False)
        ffmpeg_cmd = ["ffmpeg", "-nostdin", "-loglevel", "warning", "-re", "-stream_loop", "-1",
                      "-i", source, "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
                      "-g", "30", "-bf", "0", "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                      f"{VIDEO_PUBLISH_URL}/{raw_path}"]
        shell_cmd = f"nohup {shlex.join(ffmpeg_cmd)} >/tmp/{ffmpeg_name}.log 2>&1 </dev/null & echo $! > {shlex.quote(pid_file)}"
        ssh(VIDEO_SSH_TARGET, ["bash", "-lc", shell_cmd])
    else:
        subprocess.run(["docker", "rm", "-f", ffmpeg_name], check=False,
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
        "MEDIAMTX_API_USER": MEDIAMTX_API_USER,
        "MEDIAMTX_API_PASS": MEDIAMTX_API_PASS,
    }
    command = [
        "docker", "run", "-d", "--name", worker_name, "--network", "host",
        "-v", f"{MODEL_DIR_ON_C or MODEL_DIR}:/models:ro",
    ]
    for key, value in env.items():
        command.extend(["-e", f"{key}={value}"])
    command.extend(["-e", "MODEL_PATH=/models/vehicle_best.pt",
                    "-e", "PLATE_MODEL_PATH=/models/plate_best.pt"])
    command.append(WORKER_IMAGE)
    if WORKER_SSH_TARGET:
        ssh(WORKER_SSH_TARGET, ["docker", "rm", "-f", worker_name], check=False)
        ssh(WORKER_SSH_TARGET, command)
    else:
        subprocess.run(["docker", "rm", "-f", worker_name], check=False,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(command, check=True)
    processes[camera_id] = {
        "ffmpeg": ffmpeg_name,
        "worker": worker_name,
        "control_port": control_port,
        "signal_port": signal_port,
    }


def reconcile():
    payload = request("GET", "/api/v1/worker-manager/cameras")
    available_videos = list(payload.get("available_videos", []))
    used_control = {item["control_port"] for item in processes.values()}
    used_signal = {item["signal_port"] for item in processes.values()}
    for camera in payload["data"]:
        camera_id = camera["camera_id"]
        if camera_id in processes:
            continue
        source_video = camera.get("source_video") or (available_videos.pop(0) if available_videos else None)
        if not source_video:
            print(f"no demo video available for camera {camera_id}", flush=True)
            continue
        try:
            claimed = request("POST", f"/api/v1/worker-manager/cameras/{camera_id}/claim",
                              {"source_video": source_video})
            camera.update(claimed)
            control_port = allocate_port(CONTROL_PORT_START, used_control)
            signal_port = allocate_port(SIGNAL_PORT_START, used_signal)
            start_camera(camera, control_port, signal_port)
        except Exception as exc:
            if VIDEO_SSH_TARGET:
                pid_file = f"/tmp/traffic-ffmpeg-{camera_id}.pid"
                ssh(VIDEO_SSH_TARGET, ["bash", "-lc", f"if test -f {shlex.quote(pid_file)}; then kill $(cat {shlex.quote(pid_file)}) 2>/dev/null || true; rm -f {shlex.quote(pid_file)}; fi"], check=False)
            request("POST", f"/api/v1/worker-manager/cameras/{camera_id}/failure",
                    {"message": str(exc)})


def main():
    if bool(VIDEO_SSH_TARGET) != bool(WORKER_SSH_TARGET):
        raise RuntimeError("Configure both VIDEO_SSH_TARGET and WORKER_SSH_TARGET for the A/B/C deployment")
    while True:
        try:
            ensure_worker_image()
            reconcile()
        except Exception as exc:
            print(f"manager reconciliation failed: {exc}", flush=True)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
