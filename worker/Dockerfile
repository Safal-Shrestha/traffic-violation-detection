FROM python:3.12-slim

WORKDIR /app
ARG WORKER_REQUIREMENTS=requirements-cpu.txt
COPY requirements*.txt ./
RUN test -f "${WORKER_REQUIREMENTS}" \
    && pip install --no-cache-dir -r "${WORKER_REQUIREMENTS}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libxcb1 \
    && rm -rf /var/lib/apt/lists/*
COPY . .

CMD ["python", "run_worker.py"]
