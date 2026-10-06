# Worker manager

Run this process on laptop A with Rails. It polls Rails for cameras awaiting
provisioning. Rails reserves an unused demo video when the camera is created;
the manager starts FFmpeg on laptop B over SSH and starts the per-camera worker
container on laptop C over SSH. See [deployment.md](../deployment.md) for the
complete A/B/C setup, required software, environment variables, and firewall
rules.

On A, copy `.env.example` to `.env`, configure SSH targets and LAN addresses,
then run:

```bash
python3 -m pip install -r requirements.txt
python3 manager.py
```

The manager builds `WORKER_IMAGE` on C from `WORKER_BUILD_CONTEXT_ON_C` when it
is missing. The model weights are mounted from `MODEL_DIR_ON_C` in each worker.
For a single-host setup, omit both SSH targets and use the local fallback paths.
