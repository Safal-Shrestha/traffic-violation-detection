# Worker manager

Current setup: run this process in WSL on Windows `192.168.1.5` beside Rails.
It polls Rails for cameras awaiting provisioning, starts native FFmpeg on Linux
`192.168.1.9` over SSH, and starts the CPU-only worker through the local Docker
Desktop engine. The worker uses bridge networking with published ports. See
[deployment.md](../deployment.md) for SSH setup, Docker Desktop integration,
environment variables, and firewall rules.

The prior three-laptop arrangement (remote video host and remote worker host)
is retained in `.env.example` as commented settings. To restore it, configure
both SSH targets and host networking as described in the legacy section of
[deployment.md](../deployment.md).

In WSL, copy `.env.example` to `.env`, configure the Linux video path and shared
secrets, authorize the WSL SSH key on Linux, enable Docker Desktop integration
for the distro, then run:

```bash
python3 -m pip install -r requirements.txt
python3 manager.py
```

The manager builds `WORKER_IMAGE` locally from `WORKER_BUILD_CONTEXT` when it
is missing and mounts `MODEL_DIR` in each worker. It uses SSH only for the
Linux video host; an empty `WORKER_SSH_TARGET` selects Docker Desktop locally.
