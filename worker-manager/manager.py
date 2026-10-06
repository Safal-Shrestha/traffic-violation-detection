"""Provision a Linux video publisher and Docker worker from the WSL manager."""
import base64
import json
import os
import shutil
import shlex
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.environ["BACKEND_URL"].rstrip("/")
MANAGER_KEY = os.environ["WORKER_MANAGER_KEY"]
MEDIAMTX_URL = os.getenv("MEDIAMTX_URL", "rtsp://127.0.0.1:8554").rstrip("/")
VIDEO_PUBLISH_URL = os.getenv("VIDEO_PUBLISH_URL", MEDIAMTX_URL).rstrip("/")
MEDIAMTX_HOST = os.getenv("MEDIAMTX_HOST", "127.0.0.1")
ADVERTISE_HOST = os.environ["ADVERTISE_HOST"]
# SSH can run the video publisher on a remote Linux or Windows host. The worker
# can run in Docker locally through Docker Desktop or on a remote Docker host.
VIDEO_SSH_TARGET = os.getenv("VIDEO_SSH_TARGET", "")
# Remote video hosts may be Windows (PowerShell) or Linux (SSH shell).
VIDEO_SSH_MODE = os.getenv("VIDEO_SSH_MODE", "powershell")
WORKER_SSH_TARGET = os.getenv("WORKER_SSH_TARGET", "")
VIDEO_DIR = os.path.abspath(os.getenv("VIDEO_DIR", "../infrastructure/media/videos"))
VIDEO_DIR_ON_B = os.getenv("VIDEO_DIR_ON_B", "")
MODEL_DIR_ON_C = os.getenv("MODEL_DIR_ON_C", "")
WORKER_BUILD_CONTEXT_ON_C = os.getenv("WORKER_BUILD_CONTEXT_ON_C", "")
WORKER_IMAGE = os.getenv("WORKER_IMAGE", "traffic-worker:demo")
WORKER_DOCKER_CONFIG = "/tmp/traffic-worker-manager-docker"
WORKER_DOCKER_NETWORK = os.getenv("WORKER_DOCKER_NETWORK", "host")
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
        return sock.connect_ex(("127.0.0.1", port)) != 0


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
            ["ssh", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "LogLevel=ERROR",
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
            ["ssh", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "LogLevel=ERROR",
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


def local_docker(command, *, check=True):
    """Use a clean client config so Docker Desktop credential helpers are optional."""
    config_dir = Path(WORKER_DOCKER_CONFIG)
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / "config.json").write_text(json.dumps({"auths": {}, "credsStore": ""}))
    env = os.environ.copy()
    env["DOCKER_CONFIG"] = str(config_dir)
    result = subprocess.run(command, check=False, text=True, capture_output=True, env=env)
    if check and result.returncode:
        detail = "\n".join(part.strip() for part in (result.stderr, result.stdout) if part.strip())
        raise RuntimeError(detail or f"command exited with status {result.returncode}")
    return result


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
    result = local_docker(["docker", "image", "inspect", WORKER_IMAGE], check=False)
    if result.returncode:
        local_docker(["docker", "build", "-t", WORKER_IMAGE, WORKER_BUILD_CONTEXT])


def start_camera(camera, control_port, signal_port):
    camera_id = camera["camera_id"]
    raw_path = camera["raw_stream_key"]
    remote_video = bool(VIDEO_SSH_TARGET)
    video_dir = VIDEO_DIR_ON_B if remote_video else VIDEO_DIR
    source = os.path.join(video_dir, camera["source_video"])
    if remote_video:
        if VIDEO_SSH_MODE in {"linux", "linux-docker"}:
            check = ssh(VIDEO_SSH_TARGET, ["test", "-f", source], check=False, timeout=15)
        elif VIDEO_SSH_MODE == "powershell":
            check_script = (
                f"if (-not (Test-Path -LiteralPath {powershell_literal(source)} -PathType Leaf)) "
                "{ exit 2 }"
            )
            check = ssh_powershell(VIDEO_SSH_TARGET, check_script, check=False, timeout=15)
        else:
            raise RuntimeError("VIDEO_SSH_MODE must be 'linux', 'linux-docker', or 'powershell'")
        if check.returncode:
            raise RuntimeError(f"source video does not exist on laptop B: {source}")
    elif not os.path.isfile(source):
        raise RuntimeError(f"source video does not exist: {source}")

    ffmpeg_name = f"traffic-ffmpeg-{camera_id}"
    worker_name = f"traffic-worker-{camera_id}"
    if remote_video and VIDEO_SSH_MODE == "powershell":
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
    elif remote_video and VIDEO_SSH_MODE == "linux-docker":
        # Run FFmpeg in a container on the Linux video host. Host networking
        # lets it publish to that machine's MediaMTX at 127.0.0.1:8554.
        ssh(VIDEO_SSH_TARGET, ["docker", "rm", "-f", ffmpeg_name], check=False, timeout=30)
        ssh(VIDEO_SSH_TARGET, ["docker", "run", "-d", "--name", ffmpeg_name,
             "--network", "host", "-v", f"{video_dir}:/videos:ro",
             "linuxserver/ffmpeg:9.0-cli-ls84", "-re", "-stream_loop", "-1",
             "-i", f"/videos/{camera['source_video']}", "-c:v", "libx264",
             "-preset", "veryfast", "-tune", "zerolatency", "-g", "30",
             "-bf", "0", "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
             f"{VIDEO_PUBLISH_URL}/{raw_path}"], timeout=120)
    elif remote_video:
        pid_file = f"/tmp/{ffmpeg_name}.pid"
        log_file = f"/tmp/{ffmpeg_name}.log"
        ffmpeg_args = ["ffmpeg", "-nostdin", "-loglevel", "warning", "-re", "-stream_loop", "-1",
                       "-i", source, "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
                       "-g", "30", "-bf", "0", "-an", "-f", "rtsp", "-rtsp_transport", "tcp",
                       f"{VIDEO_PUBLISH_URL}/{raw_path}"]
        stop_old = (
            f"if [ -f {shlex.quote(pid_file)} ]; then "
            f"kill \"$(cat {shlex.quote(pid_file)})\" 2>/dev/null || true; "
            f"rm -f {shlex.quote(pid_file)}; fi; "
        )
        launch = (
            stop_old + f"nohup {shlex.join(ffmpeg_args)} > {shlex.quote(log_file)} 2>&1 "
            f"< /dev/null & echo $! > {shlex.quote(pid_file)}"
        )
        ssh(VIDEO_SSH_TARGET, ["bash", "-lc", launch], timeout=30)
    else:
        local_docker(["docker", "rm", "-f", ffmpeg_name], check=False)
        local_docker([
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
        "DEVICE": os.getenv("WORKER_DEVICE", ""),
    }
    command = ["docker", "run", "-d", "--name", worker_name]
    if WORKER_DOCKER_NETWORK == "host":
        command.extend(["--network", "host"])
    elif WORKER_DOCKER_NETWORK == "bridge":
        command.extend(["--network", "bridge", "-p", f"{control_port}:{control_port}",
                        "-p", f"{signal_port}:{signal_port}"])
    else:
        raise RuntimeError("WORKER_DOCKER_NETWORK must be 'host' or 'bridge'")
    command.extend(["-v", f"{MODEL_DIR_ON_C or MODEL_DIR}:/models:ro"])
    for key, value in env.items():
        command.extend(["-e", f"{key}={value}"])
    command.extend(["-e", "MODEL_PATH=/models/vehicle_best.pt",
                    "-e", "PLATE_MODEL_PATH=/models/plate_best.pt"])
    command.append(WORKER_IMAGE)
    if WORKER_SSH_TARGET:
        worker_docker(["docker", "rm", "-f", worker_name], check=False)
        worker_docker(command)
    else:
        local_docker(["docker", "rm", "-f", worker_name], check=False)
        local_docker(command)
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
    if VIDEO_SSH_MODE == "linux-docker":
        ssh(VIDEO_SSH_TARGET, ["docker", "rm", "-f", f"traffic-ffmpeg-{camera_id}"],
            check=False, timeout=30)
        return
    if VIDEO_SSH_MODE == "linux":
        remote_pid_file = f"/tmp/{pid_file}"
        script = (
            f"if [ -f {shlex.quote(remote_pid_file)} ]; then "
            f"kill \"$(cat {shlex.quote(remote_pid_file)})\" 2>/dev/null || true; "
            f"rm -f {shlex.quote(remote_pid_file)}; fi"
        )
        ssh(VIDEO_SSH_TARGET, ["bash", "-lc", script], check=False, timeout=15)
        return
    script = (
        f"$pidFile = Join-Path $env:TEMP {powershell_literal(pid_file)}; "
        "if (Test-Path -LiteralPath $pidFile) { "
        "$oldPid = Get-Content -LiteralPath $pidFile -Raw; "
        "if ($oldPid) { Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue }; "
        "Remove-Item -LiteralPath $pidFile -Force }"
    )
    ssh_powershell(VIDEO_SSH_TARGET, script, check=False, timeout=15)


def main():
    if VIDEO_SSH_TARGET and VIDEO_SSH_MODE not in {"linux", "linux-docker", "powershell"}:
        raise RuntimeError("VIDEO_SSH_MODE must be 'linux', 'linux-docker', or 'powershell'")
    print(f"worker manager polling {BACKEND_URL} every {POLL_SECONDS:g}s", flush=True)
    while True:
        try:
            reconcile()
        except Exception as exc:
            print(f"manager reconciliation failed: {exc}", flush=True)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
