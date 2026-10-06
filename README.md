# Traffic Violation Detection System

An automated, edge-distributed traffic violation detection system built using computer vision and deep learning. The system identifies traffic light violations at intersections using Nepali number plate recognition (ANPR), processes feeds locally on edge workers, and delivers timestamped evidence to a central review dashboard for traffic authorities.

For the current three-laptop A/B/C camera provisioning setup, see [deployment.md](deployment.md).

---

## Key Features

* **Distributed Edge Pipeline:** Independent Detection Workers process per-camera video feeds locally, isolating failures and reducing network bandwidth.
* **YOLO & ByteTrack Detection:** High-speed vehicle detection and persistent multi-object tracking across video frames.
* **Red-Light Violation Engine:** Rule engine evaluating vehicle trajectories against configurable stop-lines and real-time signal states.
* **Nepali ANPR / License Plate OCR:** Targeted license plate extraction and OCR performed exclusively on violating vehicles.
* **Live Operator Dashboard:** Real-time WebRTC camera feed streaming with manual traffic light override controls.
* **Interactive Stop-Line Calibration:** Web-based canvas tool for drawing stop-lines on reference frames with dynamic coordinate scaling.
* **Resilient Evidence Delivery:** Built-in local outbox queue ensuring store-and-forward delivery during central backend outages.

---

## Architecture Overview


```
[Simulated RTSP Stream] ──> [Edge Detection Worker (Python / YOLO / ByteTrack)]
│
├─── RTSP Stream ──> [MediaMTX Server] ──> WebRTC Video
│
└─── REST / Action Cable ──> [Rails 7 API]
                      │
┌─────────────────────┴─────────────────────┐
▼                                           ▼
[PostgreSQL DB]                     [MinIO Object Storage]
(Partitioned Logs)                (Snapshot / Clip Evidence)
│                                           │
└─────────────────────┬─────────────────────┘
                      ▼
            [React Operator Dashboard]
```

---

## Tech Stack

* **Computer Vision Worker:** Python 3.10, PyTorch / ONNX Runtime / OpenVINO, YOLOv8/v10, ByteTrack, PaddleOCR
* **Central Backend API:** Ruby on Rails 7 (API mode), Action Cable (WebSockets)
* **Databases & Cache:** PostgreSQL 15+ (monthly range partitioned tables), Redis
* **Media & Storage:** MediaMTX (RTSP to WebRTC), MinIO (S3-compatible storage)
* **Frontend Dashboard:** React.js, TypeScript, TailwindCSS
* **Containerization:** Docker, Docker Compose
