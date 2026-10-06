FROM python:3.12-slim

WORKDIR /app
COPY requirements-cpu.txt .
RUN pip install --no-cache-dir -r requirements-cpu.txt
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libxcb1 \
    && rm -rf /var/lib/apt/lists/*
COPY . .

CMD ["python", "run_worker.py"]
