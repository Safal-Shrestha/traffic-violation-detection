#!/usr/bin/env python3
"""Configure and preflight the three-laptop demo from the manager's WSL distro.

This updates only deployment environment files. It does not install packages,
start services, copy models/videos, or change application source.
"""

from __future__ import annotations

import getpass
import ipaddress
import json
import os
import re
import secrets
import shlex
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV = ROOT / "backend" / ".env"
MANAGER_ENV = ROOT / "worker-manager" / ".env"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        match = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if match:
            value = match.group(2)
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[match.group(1)] = value
    return values


def update_env(path: Path, updates: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    old = path.read_text().splitlines() if path.exists() else []
    seen: set[str] = set()
    result: list[str] = []
    for line in old:
        match = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if match and match.group(1) in updates:
            key = match.group(1)
            if key not in seen:
                result.append(f"{key}={updates[key]}")
                seen.add(key)
        else:
            result.append(line)
    for key, value in updates.items():
        if key not in seen:
            result.append(f"{key}={value}")
    if path.exists():
        backup = path.with_name(f"{path.name}.bak-{time.strftime('%Y%m%d-%H%M%S')}")
        backup.write_text(path.read_text())
        os.chmod(backup, 0o600)
    path.write_text("\n".join(result).rstrip() + "\n")
    os.chmod(path, 0o600)


def ask(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    while True:
        value = input(f"{label}{suffix}: ").strip() or default
        if value:
            return value
        print("This value is required.")


def ask_ip(label: str, default: str = "") -> str:
    while True:
        value = ask(label, default)
        try:
            return str(ipaddress.ip_address(value))
        except ValueError:
            print("Enter a valid IPv4 or IPv6 address.")


def ask_user(label: str, default: str = "") -> str:
    while True:
        value = ask(label, default)
        if re.fullmatch(r"[A-Za-z0-9_.-]+", value):
            return value
        print("Use a Linux account name containing letters, digits, dot, dash, or underscore.")


def ask_secret(label: str, existing: str, generated: str) -> str:
    while True:
        value = getpass.getpass(f"{label} (Enter keeps current value): ").strip()
        if value:
            return value
        if existing and not existing.startswith(("change", "your-shared")):
            return existing
        if generated:
            return generated
        print("Enter the value configured on the corresponding service.")


def ssh_run(target: str, command: str, timeout: int = 20) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["ssh", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5",
         "-o", "LogLevel=ERROR", target, command],
        check=False, text=True, capture_output=True, timeout=timeout,
    )


def remote_python(target: str, script: str, payload: dict, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    command = "python3 -c " + shlex.quote(script)
    return subprocess.run(
        ["ssh", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5",
         "-o", "LogLevel=ERROR", target, command],
        input=json.dumps(payload), check=False, text=True, capture_output=True, timeout=timeout,
    )


def check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"{'PASS' if ok else 'FAIL'}  {label}" + (f" — {detail}" if detail else ""))
    return ok


def local_http(url: str, timeout: float = 3) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status < 500, f"HTTP {response.status}"
    except (urllib.error.URLError, TimeoutError) as exc:
        return False, str(exc)


REMOTE_PATCH = r'''
import json, os, pathlib, sys, time
payload = json.load(sys.stdin)
def patch(path, values):
    p = pathlib.Path(path)
    if not p.parent.is_dir():
        raise SystemExit("missing directory: " + str(p.parent))
    old = p.read_text().splitlines() if p.exists() else []
    seen, out = set(), []
    import re
    for line in old:
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if m and m.group(1) in values:
            k = m.group(1)
            if k not in seen:
                out.append(k + "=" + values[k]); seen.add(k)
        else:
            out.append(line)
    for k, v in values.items():
        if k not in seen: out.append(k + "=" + v)
    if p.exists():
        backup = p.with_name(p.name + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
        backup.write_text(p.read_text()); os.chmod(backup, 0o600)
    p.write_text("\n".join(out).rstrip() + "\n"); os.chmod(p, 0o600)
for path, values in payload["files"].items(): patch(path, values)
print("updated " + str(len(payload["files"])) + " deployment env file(s)")
'''


def main() -> int:
    old_backend = read_env(BACKEND_ENV)
    old_manager = read_env(MANAGER_ENV)

    print("Three-laptop setup (run this from the WSL distro that hosts Rails and manager).")
    print("Laptop A = this WSL/Windows host; B = Linux MediaMTX/MinIO/frontend; C = Linux worker/GPU.")
    print("B and C must already accept SSH keys from this WSL account. No remote packages are installed.")
    a_ip = ask_ip("Laptop A LAN IP (Rails/manager)", "192.168.1.5")
    b_ip = ask_ip("Laptop B LAN IP (MediaMTX/MinIO/frontend)", old_manager.get("MEDIAMTX_HOST", "192.168.1.9"))
    b_user = ask_user("Laptop B SSH username", old_manager.get("VIDEO_SSH_TARGET", "safal@192.168.1.9").split("@", 1)[0])
    b_repo = ask("Laptop B repository path")
    c_ip = ask_ip("Laptop C LAN IP (GPU worker)")
    c_user = ask_user("Laptop C SSH username")
    c_repo = ask("Laptop C repository path")
    c_models = ask("Laptop C model directory containing vehicle_best.pt and plate_best.pt")

    old_manager_key = old_backend.get("WORKER_MANAGER_KEY", old_manager.get("WORKER_MANAGER_KEY", ""))
    old_worker_key = old_backend.get("WORKER_API_KEY", old_manager.get("WORKER_API_KEY", ""))
    manager_key = ask_secret("Shared WORKER_MANAGER_KEY", old_manager_key, secrets.token_urlsafe(32))
    worker_key = ask_secret("Shared WORKER_API_KEY", old_worker_key, secrets.token_urlsafe(32))
    control_token = ask_secret("SIGNAL_CONTROL_TOKEN", old_manager.get("SIGNAL_CONTROL_TOKEN", ""), secrets.token_urlsafe(32))
    media_api_user = ask("MediaMTX API username", old_manager.get("MEDIAMTX_API_USER", "worker"))
    media_api_pass = ask_secret("MediaMTX API password (must match B's mediamtx.yml)", old_manager.get("MEDIAMTX_API_PASS", ""), "")
    minio_user = ask("MinIO access key", old_backend.get("AWS_ACCESS_KEY_ID", "minio-user"))
    minio_pass = ask_secret("MinIO secret key", old_backend.get("AWS_SECRET_ACCESS_KEY", ""), secrets.token_urlsafe(24))

    b_target, c_target = f"{b_user}@{b_ip}", f"{c_user}@{c_ip}"
    print("\nChecking key-based SSH access before changing configuration...")
    ssh_ok = True
    for name, target in (("Laptop B", b_target), ("Laptop C", c_target)):
        result = ssh_run(target, "printf SSH_OK", timeout=10)
        ssh_ok &= check(f"{name} SSH ({target})", result.returncode == 0,
                        result.stdout.strip() if result.returncode == 0 else (result.stderr.strip() or result.stdout.strip()))
    if not ssh_ok:
        print("No configuration files were changed. Add this WSL account's public key to both Linux laptops, then rerun.")
        return 2

    worker_updates = {
        "BACKEND_URL": f"http://{a_ip}:3000",
        "MEDIAMTX_URL": f"rtsp://{b_ip}:8554",
        "VIDEO_PUBLISH_URL": "rtsp://127.0.0.1:8554",
        "MEDIAMTX_HOST": b_ip,
        "VIDEO_SSH_TARGET": b_target,
        "VIDEO_SSH_MODE": "linux",
        "VIDEO_DIR_ON_B": f"{b_repo.rstrip('/')}/infrastructure/media/videos",
        "ADVERTISE_HOST": c_ip,
        "WORKER_SSH_TARGET": c_target,
        "WORKER_BUILD_CONTEXT_ON_C": f"{c_repo.rstrip('/')}/worker",
        "MODEL_DIR_ON_C": c_models,
        "WORKER_DOCKER_NETWORK": "host",
        "WORKER_GPU": "1",
        "WORKER_REQUIREMENTS": "requirements-gpu.txt",
        "WORKER_IMAGE": "traffic-worker:demo-gpu",
        "WORKER_DEVICE": "0",
        "WORKER_MANAGER_KEY": manager_key,
        "WORKER_API_KEY": worker_key,
        "SIGNAL_CONTROL_TOKEN": control_token,
        "MEDIAMTX_API_USER": media_api_user,
        "MEDIAMTX_API_PASS": media_api_pass,
    }
    backend_updates = {
        "S3_ENDPOINT": f"http://{b_ip}:9000",
        "AWS_ACCESS_KEY_ID": minio_user,
        "AWS_SECRET_ACCESS_KEY": minio_pass,
        "MEDIAMTX_PLAYBACK_BASE": f"http://{b_ip}:8889",
        "MEDIAMTX_HLS_BASE": f"http://{b_ip}:8888",
        "WORKER_MANAGER_KEY": manager_key,
        "WORKER_API_KEY": worker_key,
        "SIGNAL_CONTROL_TOKEN": control_token,
    }
    update_env(MANAGER_ENV, worker_updates)
    update_env(BACKEND_ENV, backend_updates)

    b_files = {
        f"{b_repo.rstrip('/')}/infrastructure/media/.env": {"MTX_WEBRTCADDITIONALHOSTS": b_ip},
        f"{b_repo.rstrip('/')}/infrastructure/minio/.env": {
            "MINIO_ROOT_USER": minio_user,
            "MINIO_ROOT_PASSWORD": minio_pass,
        },
        f"{b_repo.rstrip('/')}/frontend/.env.local": {
            "VITE_API_BASE_URL": f"http://{a_ip}:3000/api/v1",
        },
    }
    remote = remote_python(b_target, REMOTE_PATCH, {"files": b_files})
    if not check("Laptop B deployment environment files", remote.returncode == 0,
                 remote.stdout.strip() if remote.returncode == 0 else remote.stderr.strip()):
        print("Local A environment files were updated. Fix B's repository path/permissions and rerun.")
        return 2

    print("\nConfiguration written. Existing env files were backed up with timestamped .bak files.")
    print("Checking service prerequisites and network reachability...")
    all_ok = True
    ok, detail = local_http("http://127.0.0.1:3000/up")
    all_ok &= check("Rails on Laptop A", ok, detail)
    try:
        import dotenv  # noqa: F401
        all_ok &= check("python-dotenv in WSL", True)
    except ImportError:
        all_ok &= check("python-dotenv in WSL", False, "install worker-manager/requirements.txt")

    b_script = r'''set -eu
repo="$1"
test -d "$repo/infrastructure/media" && test -d "$repo/infrastructure/minio" && test -d "$repo/frontend"
command -v docker >/dev/null
docker info >/dev/null
command -v ffmpeg >/dev/null
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q 'libx264'
for n in 1 2 3 4; do test -s "$repo/infrastructure/media/videos/junction${n}.mp4"; done
docker compose -f "$repo/infrastructure/media/docker-compose.yml" up -d
docker compose -f "$repo/infrastructure/minio/docker-compose.yml" up -d
docker compose -f "$repo/infrastructure/media/docker-compose.yml" ps --status running --services | grep -qx mediamtx
docker compose -f "$repo/infrastructure/minio/docker-compose.yml" ps --status running --services | grep -qx minio
command -v node >/dev/null && command -v npm >/dev/null
curl -fsS --max-time 3 http://127.0.0.1:9000/minio/health/live >/dev/null
curl -fsS --max-time 3 -u "$2:$3" http://127.0.0.1:9997/v3/paths/list >/dev/null
echo 'B_OK: Docker, FFmpeg, four videos, MediaMTX, MinIO, Node/npm, MediaMTX API'
'''
    b_payload = "set -- " + shlex.join([b_repo, media_api_user, media_api_pass]) + "\n" + b_script
    b_command = "bash -lc " + shlex.quote(b_payload)
    b_check = ssh_run(b_target, b_command, timeout=180)
    all_ok &= check("Laptop B services and files", b_check.returncode == 0,
                    b_check.stdout.strip() if b_check.returncode == 0 else (b_check.stderr.strip() or b_check.stdout.strip()))

    c_script = r'''set -eu
repo="$1"; models="$2"; manager_ip="$3"; media_ip="$4"
command -v docker >/dev/null && docker info >/dev/null
test -f "$repo/worker/Dockerfile"
test -s "$models/vehicle_best.pt" && test -s "$models/plate_best.pt"
command -v nvidia-smi >/dev/null && nvidia-smi -L
docker run --rm --gpus all nvidia/cuda:12.8.1-base-ubuntu24.04 nvidia-smi >/dev/null
python3 - "$manager_ip" "$media_ip" <<'PY'
import socket,sys
for host,port in ((sys.argv[1],3000),(sys.argv[2],8554),(sys.argv[2],9997)):
 s=socket.create_connection((host,port),3); s.close()
print('worker host can reach Rails and MediaMTX')
PY
echo 'C_OK: Docker, NVIDIA driver, models, Rails/MediaMTX network'
'''
    c_payload = "set -- " + " ".join(map(shlex.quote, [c_repo, c_models, a_ip, b_ip])) + "\n" + c_script
    c_check = ssh_run(c_target, "bash -lc " + shlex.quote(c_payload), timeout=240)
    all_ok &= check("Laptop C Docker, GPU, models, and network", c_check.returncode == 0,
                    c_check.stdout.strip() if c_check.returncode == 0 else (c_check.stderr.strip() or c_check.stdout.strip()))

    # Confirm the main LAN services from the manager machine as well.
    for label, ip, port in (("MediaMTX RTSP", b_ip, 8554), ("MediaMTX WebRTC", b_ip, 8889),
                            ("MinIO S3", b_ip, 9000), ("Frontend Vite", b_ip, 5173),
                            ("Worker host SSH", c_ip, 22)):
        try:
            with socket.create_connection((ip, port), timeout=2):
                ok, detail = True, f"{ip}:{port} reachable"
        except OSError as exc:
            ok, detail = False, str(exc)
        all_ok &= check(label, ok, detail)

    print("\nNext: start Rails, then `cd worker-manager && python3 manager.py`; start Vite on B with `npm run dev -- --host 0.0.0.0`.")
    print("Add one camera and confirm worker provisioning reaches READY before calibrating it.")
    print("GPU mode is enabled for this three-laptop setup with requirements-gpu.txt and Docker --gpus all.")
    print("The CPU setup remains the default when WORKER_GPU=0.")
    return 0 if all_ok else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nSetup cancelled.", file=sys.stderr)
        raise SystemExit(130)
