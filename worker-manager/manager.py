"""Provision a video publisher on B and a detection worker on C from Rails on A."""
import base64
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
WORKER_DOCKER_CONFIG = "/tmp/traffic-worker-manager-docker"
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
            check=False, timeout=30)
        if probe.returncode == 255:
            detail = probe.stderr.strip() or probe.stdout.strip() or "SSH connection failed"
            raise RuntimeError(f"SSH port probe failed: {detail}")
        return probe.returncode == 0
    with socket.socket() as sock:
        return sock.connect_ex(("0.0.0.0", port)) != 0


def allocate_port(start, used):
    port = start
    while port in used or not port_available(port):
        port += 1
    used.add(port)
    return port


def ssh(target, command, *, check=True, timeout=None):
    if not target:
        raise RuntimeError("VIDEO_SSH_TARGET and WORKER_SSH_TARGET must be configured")
    remote_command = shlex.join(["bash", "-lc", shlex.join(command)])
    try:
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "LogLevel=ERROR",
             target, remote_command],
            check=False, text=True, capture_output=True, timeout=timeout
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"ssh to {target!r} timed out after {timeout} seconds") from exc
    if check and result.returncode:
        detail = "\n".join(part.strip() for part in (result.stderr, result.stdout) if part.strip())
        detail = detail or f"exit status {result.returncode}"
        raise RuntimeError(f"ssh to {target!r} failed: {detail}")
    return result


def powershell_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def ssh_powershell(target, script, *, check=True, timeout=None):
    if not target:
        raise RuntimeError("VIDEO_SSH_TARGET must be configured")
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    remote_command = f"powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand {encoded}"
    try:
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "LogLevel=ERROR",
             target, remote_command],
            check=False, text=True, capture_output=True, timeout=timeout
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"ssh to {target!r} timed out after {timeout} seconds") from exc
    if check and result.returncode:
        detail = "\n".join(part.strip() for part in (result.stderr, result.stdout) if part.strip())
        detail = detail or f"exit status {result.returncode}"
        raise RuntimeError(f"PowerShell command on {target!r} failed: {detail}")
    return result


def prepare_worker_docker_config():
    config = json.dumps({"auths": {}, "credsStore": ""})
    write_config = (
        "import pathlib,sys; p=pathlib.Path(sys.argv[1]); "
        "p.mkdir(parents=True,exist_ok=True); (p/'config.json').write_text(sys.argv[2])"
    )
    ssh(WORKER_SSH_TARGET,
        ["python3", "-c", write_config, WORKER_DOCKER_CONFIG, config])


def worker_docker(command, *, check=True):
    return ssh(WORKER_SSH_TARGET,
               ["env", f"DOCKER_CONFIG={WORKER_DOCKER_CONFIG}", *command], check=check)


def ensure_worker_image():
    if WORKER_SSH_TARGET:
        prepare_worker_docker_config()
        inspect = worker_docker(["docker", "image", "inspect", WORKER_IMAGE], check=False)
        if inspect.returncode == 0:
            return
        if not WORKER_BUILD_CONTEXT_ON_C:
            raise RuntimeError("WORKER_BUILD_CONTEXT_ON_C is required to build the image on laptop C")
        worker_docker(["docker", "build", "-t", WORKER_IMAGE, WORKER_BUILD_CONTEXT_ON_C])
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
        check_script = (
            f"if (-not (Test-Path -LiteralPath {powershell_literal(source)} -PathType Leaf)) "
            "{ exit 2 }"
        )
        check = ssh_powershell(VIDEO_SSH_TARGET, check_script, check=False, timeout=15)
        if check.returncode:
            raise RuntimeError(f"source video does not exist on laptop B: {source}")
    elif not os.path.isfile(source):
        raise RuntimeError(f"source video does not exist: {source}")

    ffmpeg_name = f"traffic-ffmpeg-{camera_id}"
    worker_name = f"traffic-worker-{camera_id}"
    if remote_video:
        pid_file = ffmpeg_name + ".pid"
        ffmpeg_args = ["-nostdin", "-loglevel", "warning", "-re", "-stream_loop", "-1",
                       "-i", source, "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
                       "-g", "30", "-bf", "0", "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                       f"{VIDEO_PUBLISH_URL}/{raw_path}"]
        args = powershell_literal(subprocess.list2cmdline(ffmpeg_args))
        script = (
            "$ErrorActionPreference = 'Stop'; "
            f"$pidFile = Join-Path $env:TEMP {powershell_literal(pid_file)}; "
            "if (Test-Path -LiteralPath $pidFile) { "
            "$oldPid = Get-Content -LiteralPath $pidFile -Raw; "
            "if ($oldPid) { Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue }; "
            "Remove-Item -LiteralPath $pidFile -Force }; "
            "$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source; "
            f"$process = Start-Process -FilePath $ffmpeg -ArgumentList {args} -PassThru -WindowStyle Hidden "
            f"-RedirectStandardOutput (Join-Path $env:TEMP {powershell_literal(ffmpeg_name + '.out.log')}) "
            f"-RedirectStandardError (Join-Path $env:TEMP {powershell_literal(ffmpeg_name + '.err.log')}); "
            "$process.Id | Set-Content -LiteralPath $pidFile -NoNewline"
        )
        ssh_powershell(VIDEO_SSH_TARGET, script, timeout=30)
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
        worker_docker(["docker", "rm", "-f", worker_name], check=False)
        worker_docker(command)
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
    print(f"started camera {camera_id}: worker={worker_name}, control_port={control_port}, signal_port={signal_port}",
          flush=True)


def reconcile():
    payload = request("GET", "/api/v1/worker-manager/cameras")
    cameras = payload.get("data", [])
    if not cameras:
        return

    ensure_worker_image()
    available_videos = list(payload.get("available_videos", []))
    used_control = {item["control_port"] for item in processes.values()}
    used_signal = {item["signal_port"] for item in processes.values()}
    for camera in cameras:
        camera_id = camera["camera_id"]
        if camera_id in processes:
            continue
        source_video = camera.get("source_video") or (available_videos.pop(0) if available_videos else None)
        if not source_video:
            print(f"no demo video available for camera {camera_id}", flush=True)
            continue
        claimed_camera = False
        try:
            claimed = request("POST", f"/api/v1/worker-manager/cameras/{camera_id}/claim",
                              {"source_video": source_video})
            claimed_camera = True
            camera.update(claimed)
            control_port = allocate_port(CONTROL_PORT_START, used_control)
            signal_port = allocate_port(SIGNAL_PORT_START, used_signal)
            start_camera(camera, control_port, signal_port)
        except Exception as exc:
            if VIDEO_SSH_TARGET:
                stop_video_publisher(camera_id)
            if claimed_camera:
                request("POST", f"/api/v1/worker-manager/cameras/{camera_id}/failure",
                        {"message": str(exc)})
                print(f"camera {camera_id} provisioning failed: {exc}", flush=True)
            else:
                print(f"camera {camera_id} was not claimed: {exc}", flush=True)


def stop_video_publisher(camera_id):
    pid_file = f"traffic-ffmpeg-{camera_id}.pid"
    script = (
        f"$pidFile = Join-Path $env:TEMP {powershell_literal(pid_file)}; "
        "if (Test-Path -LiteralPath $pidFile) { "
        "$oldPid = Get-Content -LiteralPath $pidFile -Raw; "
        "if ($oldPid) { Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue }; "
        "Remove-Item -LiteralPath $pidFile -Force }"
    )
    ssh_powershell(VIDEO_SSH_TARGET, script, check=False, timeout=15)


def main():
    if bool(VIDEO_SSH_TARGET) != bool(WORKER_SSH_TARGET):
        raise RuntimeError("Configure both VIDEO_SSH_TARGET and WORKER_SSH_TARGET for the A/B/C deployment")
    print(f"worker manager polling {BACKEND_URL} every {POLL_SECONDS:g}s", flush=True)
    while True:
        try:
            reconcile()
        except Exception as exc:
            print(f"manager reconciliation failed: {exc}", flush=True)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
