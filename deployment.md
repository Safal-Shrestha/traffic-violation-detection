# Three-laptop demo deployment

This guide configures the traffic-violation demo across three laptops on the
same private LAN. Run the setup script from the WSL distro that runs Rails and
the worker manager. The script prompts for the addresses, Linux SSH accounts,
checkout locations, model directory, and shared credentials; it writes the
deployment environment values and checks SSH, services, files, and network
access.

## Machine roles

| Machine | Runs | Needs to reach |
|---|---|---|
| **A: Windows laptop, from WSL** | Rails API, PostgreSQL, worker manager | B and C over SSH; B's MediaMTX and MinIO; C's worker ports |
| **B: Linux laptop** | MediaMTX, MinIO, frontend, demo videos, FFmpeg publishers | A's Rails API; C's worker callbacks |
| **C: Linux laptop** | One Docker worker per camera, model files | A's Rails API; B's RTSP and MediaMTX API |

Use stable LAN addresses or DHCP reservations. The browser may run on any
machine that can reach A and B. Use the actual LAN addresses throughout; do not
put `localhost` in a setting used by a different machine.

## Before running setup

### Laptop A: WSL

- Install Git, Ruby/Bundler for this repository, Python 3, `python3-venv`, and
  OpenSSH client. Install the backend's PostgreSQL dependency and start the
  database.
- Start Docker Desktop only if this WSL distro needs it for other development;
  in the three-laptop layout, worker Docker runs on C.
- Configure Rails to listen on `0.0.0.0:3000`. Permit Linux B and C to reach
  port 3000 through Windows Firewall/WSL networking. The Rails API and database
  must already work locally.
- Create an SSH key in WSL and add its public key to both B and C. Run
  `ssh-copy-id <B_USER>@<B_IP>` and `ssh-copy-id <C_USER>@<C_IP>`, then confirm
  `ssh <B_USER>@<B_IP> true` and `ssh <C_USER>@<C_IP> true` work without a
  password prompt. The setup script uses non-interactive key-based SSH.
- Keep local model files out of the worker manager's requirements; model weights
  will be read from C.

### Laptop B: Linux media/frontend host

- Install and start Docker Engine and the Docker Compose plugin, native `ffmpeg`
  with the `libx264` encoder, Node.js/npm, `curl`, and OpenSSH server.
- Check out this repository. Keep the demo inputs at
  `infrastructure/media/videos/junction1.mp4` through `junction4.mp4`.
- Update this checkout to the same project revision as A before the demo so the
  frontend and infrastructure configuration match.
- The SSH account used by A must be able to run `docker`, `ffmpeg`, read the
  videos, and edit the checkout's deployment `.env` files without `sudo`.
- Set up MediaMTX's API account in `infrastructure/media/mediamtx.yml`. Its
  username and password must match the values used by the setup prompt. The
  existing example uses API user `worker`. Keep the RTSP publish/read rules
  compatible with the worker and FFmpeg publisher.

### Laptop C: Linux worker host

- Install Docker Engine, Docker Compose plugin, OpenSSH server, and an NVIDIA
  driver. For Docker GPU access, install and configure NVIDIA Container Toolkit
  and permit the host to pull the `nvidia/cuda:12.8.1-base-ubuntu24.04` image.
  The setup script uses that image to check that Docker can access the GPU.
- Check out this repository. The SSH account used by A must be able to run
  Docker without an interactive password prompt.
- Update the checkout on C to the same project revision as A. The manager builds
  from C's `worker/` directory, including its Dockerfile and requirements files.
- Put `vehicle_best.pt` and `plate_best.pt` in a directory readable by that
  account. The setup script asks for the checkout and model paths and checks
  that both files exist.

## Configure from WSL on A

From the repository root in WSL:

```sh
python3 -m venv .venv-setup
source .venv-setup/bin/activate
python3 -m pip install -r worker-manager/requirements.txt
python3 initialize-script/setup_three_laptops.py
```

Enter A's LAN address, B and C's addresses and SSH usernames, both remote
checkout paths, C's model directory, and the MediaMTX/MinIO/shared API
credentials. Use SSH usernames, not display names. Secret prompts do not echo
typed values; pressing Enter retains a usable value from the existing local
environment or generates a shared API token where needed.

The first configuration run can report Rails or Vite as unavailable if those
services are not running yet; the environment values are still written and the
script starts MediaMTX and MinIO on B. Then start Rails on A and Vite on B, and
run the setup script again to get the full live-network preflight. Restart Rails
after the first run so it reads the updated `.env`; restart Vite so it reads the
updated `frontend/.env.local`.

The script updates only deployment environment files:

- A: `backend/.env` and `worker-manager/.env`
- B: `infrastructure/media/.env`, `infrastructure/minio/.env`, and
  `frontend/.env.local`

It preserves unrelated settings and creates timestamped `.bak-*` copies before
editing. After updating B's environment files, it runs `docker compose up -d`
for MediaMTX and MinIO so their new settings take effect. It does not install
packages, start Rails/Vite/manager, copy model/video files, or alter application
source. On a failed SSH precheck it makes no changes. If the later service
checks fail, read the reported host/port/path and fix that prerequisite before
running it again.

The generated values route the browser and workers as follows:

- Frontend on B calls Rails at `http://A:3000/api/v1`.
- Rails stores evidence in MinIO on B at port 9000 and returns B's WebRTC
  playback URL on port 8889.
- The manager on A connects to B and C over SSH. B runs an FFmpeg publisher for
  each selected video; C runs the corresponding worker container.
- Workers on C read raw RTSP and publish annotated RTSP to B on port 8554. The
  MediaMTX API on B (port 9997) registers annotated paths and their worker
  callbacks.
- Worker callbacks/signals advertise C's LAN address. B must be able to reach
  the callback port allocated on C.
- Rails proxies the live-feed signal controls to the worker, so the signal
  control token stays in backend/worker environment files and is never exposed
  to the browser.

Do not commit `.env`, `.env.local`, or generated backups. Replace demo
credentials with private values before the demo, and use this setup only on a
trusted LAN.

## Start the services

### On B: MediaMTX, MinIO, and frontend

From B's repository root:

```sh
docker compose -f infrastructure/media/docker-compose.yml up -d
docker compose -f infrastructure/minio/docker-compose.yml up -d
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Confirm MediaMTX and MinIO are running with `docker compose ... ps`. Vite prints
the frontend address, usually `http://B:5173`. Keep the Vite terminal open.

### On A: PostgreSQL, Rails, and manager

Start PostgreSQL using the local service manager, then from `backend/`:

```sh
bundle install
bin/rails db:prepare
bin/rails server -b 0.0.0.0 -p 3000
```

Create or verify the administrator account using the backend's configured seed
or admin bootstrap process. In another WSL terminal:

```sh
cd worker-manager
python3 -m pip install -r requirements.txt
python3 manager.py
```

Leave Rails and the manager running. The manager polls Rails and provisions
workers when cameras are requested; do not launch worker containers manually.

### On C: worker readiness

No worker is started manually. Keep Docker running, confirm the model files and
GPU runtime check pass, then let the manager on A provision a camera. The
manager builds the worker image on C from the remote `worker/` build context.

## Create and calibrate cameras

1. Open the Vite URL on B (or another LAN client) and sign in as an
   administrator.
2. Add a camera. The backend marks it `REQUESTED`; the manager assigns one of
   the four demo videos and provisions the B publisher and C worker.
3. Wait for `READY` and a fresh worker heartbeat. If provisioning fails, check
   the manager terminal on A, `docker logs traffic-worker-<camera-id>` on C,
   and `docker logs traffic-ffmpeg-<camera-id>` on B when FFmpeg runs in Docker
   or its configured log file when it runs as a process.
4. Open the camera calibration view. Set frame dimensions to match the stream,
   draw the stop line across the lane, and save. Calibrate against the displayed
   frame rather than guessing coordinates. Check that the worker reports the
   newer config version after saving.
5. In the monitoring view, confirm the annotated stream is visible. Open
   `http://B:8889/<camera-id>-annotated` from a LAN browser for a direct WebRTC
   playback check. Review the worker's detections and evidence records while
   the video plays.

### Simulate a signal change

The live feed has per-camera **Trigger red** and **Set green** buttons. The
displayed signal state is read from that camera's worker and refreshes every
few seconds. Set green first, then trigger red to create a clear red transition.
The worker will record a red-light violation only when a tracked vehicle
crosses that camera's calibrated stop line in the configured direction while
the signal is red and the grace period has elapsed; changing the signal alone
does not create a violation.

Rails proxies these controls using `SIGNAL_CONTROL_TOKEN`. The token on A in
`backend/.env` must exactly match the value in `worker-manager/.env`, which the
manager passes to every worker. The three-laptop setup script keeps these
values synchronized. For the current two-laptop setup, copy that existing token
from `worker-manager/.env` into `backend/.env` and restart Rails. Signal
controls require an administrator account and a fresh worker heartbeat.

The sample has four distinct source videos, so create no more than four cameras
unless the backend's demo-video list and available files are expanded. Each
video can be assigned to only one camera at a time.

## Network and firewall checklist

Restrict these ports to the listed LAN peers. Host firewalls must allow Docker
published ports as well as host services.

| Destination | Port/protocol | Allow from | Use |
|---|---:|---|---|
| A | TCP 3000 | B, C, browser | Rails API |
| A | TCP 5432 | A only unless DB is remote | PostgreSQL |
| B | TCP 22 | A | Manager starts/stops FFmpeg over SSH |
| C | TCP 22 | A | Manager builds and starts workers over SSH |
| B | TCP 8554 | C and local publisher | RTSP raw and annotated streams |
| B | TCP 9997 | C, and A for diagnostics if needed | MediaMTX control API |
| B | TCP 8889 | browser/viewer clients | WebRTC signaling and playback |
| B | UDP 8189 | browser/viewer clients | WebRTC media |
| B | TCP 8888 | browser clients only if HLS is used | HLS playback fallback |
| B | TCP 9000 | A and browser if evidence links are direct | MinIO S3 API/evidence |
| B | TCP 9001 | administrator workstation | MinIO console |
| C | TCP 8081–8112 | B | Worker viewer-hold callbacks |
| C | TCP 5001–5032 | B and browser if signal API is called directly | Worker signal API |
| B | TCP 5173 | browser/viewer clients | Vite development frontend |

Do not expose SSH, MediaMTX API, MinIO console, Rails development endpoints, or
worker control ports to the public internet. Increase the worker callback and
signal port ranges together with the manager's `CONTROL_PORT_START`,
`SIGNAL_PORT_START`, and firewall rules if the demo uses more workers.

## GPU and dependency note

Both `worker/requirements.txt` and `worker/requirements-cpu.txt` already include
the modules imported by `run_worker.py`, including Flask, Ultralytics,
EasyOCR, OpenCV (`opencv-python-headless`), NumPy, PyTorch/torchvision,
ByteTrack's `lapx`, and `python-dotenv`. No extra module is needed for the
current worker imports.

The default remains a CPU build. `worker/Dockerfile` now accepts a
`WORKER_REQUIREMENTS` build argument and defaults to `requirements-cpu.txt`.
The manager adds `--gpus all` only when `WORKER_GPU=1`. For an NVIDIA worker,
set the following in `worker-manager/.env` on A:

```dotenv
WORKER_GPU=1
WORKER_REQUIREMENTS=requirements-gpu.txt
WORKER_DEVICE=0
WORKER_IMAGE=traffic-worker:demo-gpu
```

Use a different image tag from the CPU build so the manager will build the GPU
image instead of reusing a cached CPU image. The three-laptop initializer sets
these manager build/runtime values for C automatically. It also checks Docker
GPU access before the demo. The GPU requirements pin the official PyTorch
2.10.0/torchvision 0.25.0
CUDA 12.8 pair for Python 3.12; see the [PyTorch install matrix](https://docs.pytorch.org/get-started/previous-versions/).

For the current CPU setup, leave `WORKER_GPU=0`, use
`WORKER_REQUIREMENTS=requirements-cpu.txt`, and keep the existing CPU image tag.
Those defaults preserve the current Docker Desktop configuration.

## Troubleshooting

- **SSH check fails:** run each `ssh <user>@<ip> true` from WSL, accept the
  host key, install the WSL public key on the target, and grant the account
  passwordless Docker access.
- **Video check fails:** verify all four exact filenames under B's
  `infrastructure/media/videos` and ensure A's SSH user can read them.
- **MediaMTX API check fails:** confirm the `worker` API account is enabled in
  `mediamtx.yml`, the username/password match `worker-manager/.env`, and TCP
  9997 is reachable from C.
- **Worker can't connect to Rails or MediaMTX:** check that A and B advertise
  LAN IPs, not loopback addresses, and permit the corresponding firewall ports.
- **Annotated path times out:** check B's MediaMTX logs and path state, C's
  worker logs, and whether B can reach C's allocated control callback port.
  Confirm the path has a publisher before diagnosing frontend playback.
- **WebRTC connects but has no video:** allow B's UDP 8189 from browser clients
  and set `MTX_WEBRTCADDITIONALHOSTS` on B to B's reachable LAN address.
- **No violation evidence:** first verify the worker is processing frames,
  then calibrate the stop line and signal state against the camera frame. Allow
  time for the track/crossing rule to confirm a violation.
