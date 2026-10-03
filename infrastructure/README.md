# Infrastructure

Focuses on service orchestration and streaming server configuration.

**Purpose:** Manages supporting services like MediaMTX, MinIO, PostgreSQL, and Redis via Docker Compose.

## 1. MediaMTX

Since this project is only simulating the CCTV camera, use pre-recorded videos. The pre recorded videos are to be loaded in ./media/videos/
Ensure that the videos are named as junction1.mp4

## A. When hosting mediaMTX and detection worker on different devices
For the two laptops on the same LAN, allow only the required ports between their private/LAN IPs.

### Laptop hosting MediaMTX

Allow inbound from the worker laptop’s IP:

| Port | Protocol | Purpose | Required |
|---|---:|---|---|
| `8554` | TCP | RTSP input from cameras/FFmpeg and RTSP output from the worker | Yes |
| `9997` | TCP | MediaMTX Control API used by the worker | Yes |
| `8889` | TCP | WebRTC playback from browsers | If using WebRTC |
| `8189` | UDP | WebRTC media transport | If using WebRTC |
| `8888` | TCP | HLS playback | Only if using HLS |


Recommended firewall scope:

```text
Allow TCP 8554 from worker-laptop-IP
Allow TCP 9997 from worker-laptop-IP
Allow TCP 8889 from viewer/browser-LAN
Allow UDP 8189 from viewer/browser-LAN
Allow TCP 8888 from viewer/browser-LAN, if HLS is used
```

The simulated cameras run as Docker containers on the MediaMTX laptop, their RTSP traffic uses the Docker network and does not require an additional host firewall rule.

### Laptop hosting the worker

Allow inbound:

| Port | Protocol | Purpose | Required |
|---|---:|---|---|
| `8081` | TCP | MediaMTX calls the worker’s `/hold` endpoint for viewer-aware publishing | Yes |
| Additional worker control port | TCP | Only if another worker uses a different `CONTROL_PORT` | Per worker |

The worker’s `CONTROL_PORT` defaults to `8081` in `run_worker.py`.

Recommended rule:

```text
Allow TCP 8081 from MediaMTX-laptop-IP
```

The worker does **not** need an inbound rule for RTSP publishing. Its FFmpeg process makes an outbound TCP connection to MediaMTX on port `8554`.

### Important configuration considerations

```

Ensure the worker uses an address that MediaMTX can reach for its callback:

```env
ADVERTISE_HOST=<worker-laptop-LAN-IP>
```

For example:

```env
ADVERTISE_HOST=192.168.1.10
```

Then the effective LAN flow is:

```text
Worker -> MediaMTX:8554       RTSP input/output
Worker -> MediaMTX:9997       API registration and polling
MediaMTX -> Worker:8081       /hold callback
Browser -> MediaMTX:8889      WebRTC signaling
Browser -> MediaMTX:8189/UDP  WebRTC media
```