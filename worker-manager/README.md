# Demo worker manager

Run this process on the laptop that owns the demo videos and launches worker
containers. It polls Rails for cameras with `REQUESTED` provisioning status,
assigns one unused demo video, starts FFmpeg on the canonical
`<camera-id>-raw` path, and starts one worker container for that camera.

Copy `.env.example` to `.env`, adjust the LAN addresses, then run:

```bash
python3 manager.py
```

The manager uses a prebuilt `WORKER_IMAGE`. If that image does not exist, it
builds it from `WORKER_BUILD_CONTEXT` before reconciling cameras. Docker must be
available to the manager process.
