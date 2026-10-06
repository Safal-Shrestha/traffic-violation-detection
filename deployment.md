# Current deployment (Windows + WSL and Linux)

The current topology keeps Rails and the worker manager in WSL on Windows
`192.168.1.5`. MediaMTX, MinIO, the frontend, and source videos run on Linux
`192.168.1.9`. The CPU-only detection worker runs as a Docker Desktop container
managed locally by the WSL worker manager; it does not use a separate SSH target.

## Current request and stream flow

1. The browser loads the frontend from Linux `.9` and calls Rails at
   `http://192.168.1.5:3000`.
2. The manager in WSL claims the camera from Rails.
3. Over SSH, the manager starts native Linux FFmpeg on `.9`; FFmpeg publishes
   to MediaMTX at `.9:8554` using the RTSP `user` account.
4. The manager starts the worker container through Docker Desktop. The
   container reads/writes RTSP at `.9:8554`, calls Rails at `.5:3000`, and
   exposes its control/signal ports through Docker Desktop to Windows `.5`.
5. The worker uses the separate `worker` account for MediaMTX API calls.

## Configure the current machines

### Windows / WSL at 192.168.1.5

- Start Docker Desktop and enable WSL integration for the distro that runs the
  manager. From that distro, `docker info` must reach the Docker Desktop engine.
- Keep Rails bound to `0.0.0.0:3000`. WSL networking must allow the Linux laptop
  to reach Windows `.5:3000`; use mirrored networking or a Windows port proxy
  and firewall rule if the distro uses NAT.
- In WSL, add the Linux host key once and authorize the WSL key on Linux as
  described below. The manager's `.env` uses `VIDEO_SSH_TARGET=safal@192.168.1.9`
  and `VIDEO_SSH_MODE=linux`; leave `WORKER_SSH_TARGET` empty.
- Set `VIDEO_DIR_ON_B` to the Linux checkout's
  `infrastructure/media/videos` directory. Keep worker build/model paths local
  to WSL (`../worker`). The worker image uses `requirements-cpu.txt` and runs
  with `DEVICE=cpu`.
- Use bridge networking for the local Docker Desktop worker. Ports allocated
  by the manager are published to Windows `.5`, where MediaMTX on `.9` can
  reach the worker's `/hold` callback.

### Linux at 192.168.1.9

- Install and start OpenSSH server, Docker Engine/Compose, Node.js, and native
  `ffmpeg`; the SSH account `safal` must be able to run FFmpeg and Docker.
- Add the WSL manager's public key to `safal`'s `~/.ssh/authorized_keys`. From
  WSL, `ssh-copy-id -i ~/.ssh/id_ed25519.pub safal@192.168.1.9` can do this
  after interactive password login is enabled. Then verify with
  `ssh -o BatchMode=yes safal@192.168.1.9 'command -v ffmpeg'`.
- Start MediaMTX and MinIO from the repository compose files and start Vite
  with `--host 0.0.0.0`. MediaMTX's RTSP account is `user` / `mediamtx`; the
  API account remains `worker` / `mediamtx`. MinIO uses `minio-user` /
  `minio-pw` in this development setup.
- Allow inbound TCP `22`, `8554`, `8888`, `8889`, and `9000` as needed. Allow
  `9997` from `.5` only, plus UDP `8189` for WebRTC viewers.

## Previous three-laptop deployment (A / B / C, retained for reference)

The following layout is the previous deployment pattern. Its settings remain
below so they can be reused, but the current setup above is the active target.

This setup keeps the Rails API and worker manager on laptop A, the browser UI,
MediaMTX, MinIO, and the four source videos on laptop B, and one Dockerized
detection worker per camera on laptop C. Put all three laptops on the same
trusted LAN and give each a stable address or DHCP reservation.

## Request lifecycle

1. An administrator signs in to the frontend on B. The frontend sends the
   request to Rails on A using `VITE_API_BASE_URL`.
2. `POST /api/v1/cameras` creates the camera, creates unique raw and annotated
   stream keys, and marks provisioning `REQUESTED`.
3. The manager on A polls Rails, selects one unassigned video from
   `junction1.mp4` through `junction4.mp4`, and claims the camera with that
   selection. It asks B over SSH to run FFmpeg against the selected file and
   publish to its raw MediaMTX path, then asks C over SSH to start the worker
   container.
4. The worker on C reads the raw RTSP path, runs detection, and registers its
   annotated path through MediaMTX's API. Its heartbeat changes provisioning
   to `READY`.
5. The frontend prompts for frame dimensions and stop-line coordinates. Saving
   calibration stores it in Rails and increments `config_version`. The worker
   polls the camera config endpoint and refreshes its in-memory config when the
   version changes.

Only four distinct videos are configured, so no more than four cameras can be
created until the backend's demo-video list is expanded. Video assignment is
serialized and unique in the database. A failed provisioning
request is marked `ERROR` and retried by the manager. A `STARTING` request older
than two minutes is reclaimable after a manager restart. Cameras whose worker
heartbeat is stale for 30 seconds are reconciled again, including after laptop
C or the manager restarts.

## Install requirements

### Laptop A: Rails backend and worker manager

- Linux/macOS shell with Python 3 and `python-dotenv` (`python3 -m pip install
  -r worker-manager/requirements.txt` if present; otherwise install
  `python-dotenv`).
- Ruby and Bundler versions from the repository, PostgreSQL, and the Rails
  backend dependencies.
- OpenSSH client and key-based SSH access to B and C. The manager must be able
  to run remote commands without an interactive password prompt.
- A reachable PostgreSQL database. Set `DB_HOST`, `DB_PORT`, credentials, and
  database name in `backend/.env` (or the service environment).

### Laptop B: frontend, MediaMTX, MinIO, and video source

- Docker Engine and Docker Compose plugin.
- Node.js and npm for the Vite frontend.
- The four files `junction1.mp4` ... `junction4.mp4` in a directory readable by
  the SSH account configured on A.
- `ffmpeg` installed on the host. The manager launches a host FFmpeg process on
  B to publish each selected file to MediaMTX.
- Copy `infrastructure/media/.env.example` to `infrastructure/media/.env` and
  set `MTX_WEBRTCADDITIONALHOSTS` to B's LAN IP. Configure a non-default
  MediaMTX API password in `mediamtx.yml` and the matching manager setting.
- Copy `infrastructure/minio/.env.example` to
  `infrastructure/minio/.env`; set strong MinIO root credentials.

### Laptop C: detection worker host

- Docker Engine and an SSH account that can run Docker commands. Add that
  account to the Docker group or configure rootless Docker.
- A checkout of this repository at the path used for
  `WORKER_BUILD_CONTEXT_ON_C`.
- Model files `vehicle_best.pt` and `plate_best.pt` in the directory used for
  `MODEL_DIR_ON_C`.
- For GPU inference, a compatible NVIDIA driver and NVIDIA Container Toolkit;
  otherwise the worker uses CPU and will process more slowly.

## Configure addresses and secrets

Use private LAN addresses, not `localhost`, in cross-laptop settings. Copy
`worker-manager/.env.example` to `worker-manager/.env` on A and set:

```dotenv
BACKEND_URL=http://<A_IP>:3000
WORKER_MANAGER_KEY=<same-secret-as-backend>
WORKER_API_KEY=<same-secret-as-backend>
SIGNAL_CONTROL_TOKEN=<shared-random-secret>

VIDEO_SSH_TARGET=<ssh-user>@<B_IP>
VIDEO_DIR_ON_B=/absolute/path/to/infrastructure/media/videos
WORKER_SSH_TARGET=<ssh-user>@<C_IP>
WORKER_BUILD_CONTEXT_ON_C=/absolute/path/to/repo/worker
MODEL_DIR_ON_C=/absolute/path/to/model-weights

MEDIAMTX_URL=rtsp://<B_IP>:8554
VIDEO_PUBLISH_URL=rtsp://127.0.0.1:8554
MEDIAMTX_HOST=<B_IP>
MEDIAMTX_API_USER=worker
MEDIAMTX_API_PASS=<same-password-as-MediaMTX-config>
ADVERTISE_HOST=<C_IP>
```

In `backend/.env`, use the same `WORKER_MANAGER_KEY` and `WORKER_API_KEY`.
Set `MEDIAMTX_PLAYBACK_BASE=http://<B_IP>:8889` and
`MEDIAMTX_HLS_BASE=http://<B_IP>:8888`. Set `S3_ENDPOINT=http://<B_IP>:9000`
and the MinIO access key and secret to match laptop B. Rails creates the
configured evidence bucket on first use; those credentials need bucket create,
read, and write access.

On B, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://<A_IP>:3000/api/v1
```

The frontend currently calls the Rails API from the browser. Rails' API base
controller permits cross-origin requests; keep the three machines on a trusted
LAN because this demo uses HTTP. Do not reuse example passwords on a shared or
public network.

## Start services

### Laptop A

1. Start PostgreSQL and configure `backend/.env`.
2. From `backend/`, install bundle dependencies, run database setup/migrations,
   and start Rails bound to `0.0.0.0:3000`:

   ```sh
   bundle install
   bin/rails db:prepare
   bin/rails server -b 0.0.0.0 -p 3000
   ```

3. Create/verify the administrator account using the backend's configured seed
   or admin bootstrap process.
4. In a second shell, from `worker-manager/`, install `python-dotenv`, copy and
   fill `.env`, then run:

   ```sh
   python3 manager.py
   ```

The first worker image build is run on C through SSH. The worker manager needs
outbound SSH from A to B and C, and HTTP access to Rails on A.

### Laptop B

1. Start MediaMTX and MinIO from the repository root:

   ```sh
   docker compose -f infrastructure/media/docker-compose.yml up -d
   docker compose -f infrastructure/minio/docker-compose.yml up -d
   ```

2. Ensure `infrastructure/media/videos/junction1.mp4` through
   `junction4.mp4` exist, and point `VIDEO_DIR_ON_B` at this directory.
3. Start the frontend from `frontend/`:

   ```sh
   npm install
   npm run dev -- --host 0.0.0.0
   ```

Open the Vite URL from a browser on B (or another allowed viewer machine).

### Laptop C

Ensure Docker is running, model files exist, and A's SSH key can run `docker`
without prompting. No worker is started manually: each camera request causes A's
manager to start one worker container on C.

## Firewall rules

Permit only the listed source machines/subnets. Docker-published ports are
reachable on the host, so firewall rules still matter.

| Destination | Port/protocol | Allow from | Purpose |
|---|---|---|---|
| A | TCP 3000 | B and C | Rails API (browser and worker callbacks) |
| A | TCP 5432 | A only, unless DB is elsewhere | PostgreSQL |
| B | TCP 22 | A | Manager starts/stops the video publisher over SSH |
| C | TCP 22 | A | Manager starts worker containers over SSH |
| B | TCP 8554 | C and B | RTSP raw input and annotated output |
| B | TCP 9997 | C only | MediaMTX control API |
| B | TCP 8889 | browser/viewer clients | WebRTC signaling and playback |
| B | UDP 8189 | browser/viewer clients | WebRTC media transport |
| B | TCP 8888 | browser/viewer clients, if HLS is used | HLS playback |
| B | TCP 9000 | A, and browser clients if signed object URLs are used | MinIO S3 API |
| B | TCP 9001 | administrator workstation only | MinIO console |
| C | TCP 8081-8112 | B | Worker viewer hold callbacks, one port per worker |
| C | TCP 5001-5032 | B and operator browsers | Worker signal-state APIs, one port per worker |

The manager allocates control and signal ports from the ranges above. Increase
the firewall ranges and `CONTROL_PORT_START` / `SIGNAL_PORT_START` together if
you need more workers. Do not expose MediaMTX API, MinIO console, SSH, or worker
control ports to the public internet. `MEDIAMTX_URL` is B's LAN address so C's
workers can use it; `VIDEO_PUBLISH_URL` is for FFmpeg running on B and uses B's
loopback address.

## Verify one camera

1. In the browser on B, sign in as an administrator and add a camera.
2. Confirm Rails returns a camera ID and `REQUESTED` provisioning status.
3. On A, inspect manager output. On B, inspect `/tmp/traffic-ffmpeg-<camera-id>.log`.
   On C, inspect `docker logs traffic-worker-<camera-id>`.
4. Confirm the Rails camera reports provisioning `READY` and a fresh worker
   heartbeat. The manager assigns a different video to every camera.
5. Save calibration coordinates in the prompt. The worker logs the loaded config
   version; after the save, it should report the incremented version.
6. For stream diagnostics, check MediaMTX's API on B and view the annotated
   stream at `http://<B_IP>:8889/<camera-id>-annotated` from an allowed browser.

## Runtime notes

- Worker containers use host networking on C so the control and signal ports
  are reachable at C's LAN address. The Docker daemon on C must support
  `--network host`.
- FFmpeg is a host process on B and is tracked with a PID file in `/tmp`.
  Stop the manager gracefully before moving the source files or changing LAN
  addresses.
- Rails, PostgreSQL, and MinIO must be available before operators create
  cameras. Rails stores camera configuration in PostgreSQL; video files remain
  on B, and the model weights remain on C.
- `deployment.md` describes a development LAN deployment. Use TLS, individual
  per-worker credentials, restricted MediaMTX authentication, and managed
  secrets before deploying beyond a trusted test network.
