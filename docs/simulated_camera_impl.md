# Simulated Camera and Annotated Video Backend Implementation

## 1. Objective

Build and validate the backend pipeline that:

```text
Prerecorded intersection video
        ↓
RTSP camera simulator
        ↓
Detection worker
  - frame capture
  - YOLO vehicle detection
  - ByteTrack tracking
  - frame annotation
        ↓
Annotated output RTSP stream
        ↓
MediaMTX
        ↓
Frontend
```

The first implementation should focus only on the backend and worker. The goal is to prove that a prerecorded video can be processed continuously and that the resulting annotated video can eventually be streamed to the frontend.

Do not begin with the complete violation, evidence, WebSocket, and production deployment architecture. Validate the video-processing path first.

## 2. Current Repository Architecture

The repository contains:

```text
backend/          Rails API and database
worker/           Python computer-vision worker
frontend/         Frontend application
infrastructure/   Deployment and local infrastructure files
docs/             Architecture and implementation documentation
```

The intended architecture is documented in `docs/system_architecture.md`:

```text
Simulated camera
        ↓
Detection worker
        ↓
Media server
        ↓
Frontend

Rails backend
  - camera configuration
  - worker status
  - violation metadata
  - evidence metadata
```

The frontend should receive only the annotated stream. It should never subscribe directly to the raw simulated camera stream.

Each camera has two separate stream paths:

```text
camera-1-raw
    prerecorded video published as RTSP
    worker input only

camera-1-annotated
    worker output after detection and annotation
    frontend subscription only
```

The worker must consume `camera-1-raw` over RTSP. In the RTSP-based implementation it must not open the MP4 file directly.

## 3. Existing Worker

The existing worker entrypoint is:

```text
worker/app.py
```

It currently exposes:

```text
GET  /health
POST /vehicle/detect
POST /plate/detect
GET  /
```

The worker already loads:

```python
vehicle_model = YOLO(VEHICLE_MODEL_PATH)
plate_model = YOLO(PLATE_MODEL_PATH)
ocr_reader = easyocr.Reader(...)
```

It already supports:

- YOLO vehicle detection
- ByteTrack tracking
- Annotated frames through `result.plot()`
- License-plate detection
- EasyOCR
- CPU/GPU selection
- Image and video uploads
- Base64-encoded annotated JPEG frames

Dependencies are defined in:

```text
worker/requirements.txt
worker/requirements-cpu.txt
```

### Existing endpoint limitation

`POST /vehicle/detect` is an offline batch endpoint. It:

1. Accepts a complete uploaded video.
2. Saves the video temporarily.
3. Processes the video.
4. Collects annotated frames.
5. Returns all frames as JSON.

It is not a continuous camera pipeline and should not be used as the final streaming implementation. Do not put an infinite video loop inside a normal Flask request.

## 4. Recommended Implementation Strategy

Implement the feature in stages:

1. Run MediaMTX locally.
2. Publish each prerecorded video as a looping RTSP input stream.
3. Consume the input RTSP stream from the worker.
4. Validate annotated MP4 output from the worker.
5. Publish the annotated worker output as a separate RTSP stream.
6. Add a development MJPEG stream if needed for browser debugging.
7. Add Rails camera configuration and worker heartbeats.
8. Add violation rules, evidence generation, and backend ingestion.

This sequence isolates problems and avoids debugging model inference, streaming, Rails APIs, and frontend playback simultaneously.

## 5. Stage 1: Simulate the Camera as RTSP

Use MediaMTX as the local RTSP broker. The prerecorded video is the simulated camera source, and FFmpeg publishes it to a camera-specific input path.

For the first camera:

```text
Input path: camera-1-raw
Input URL:  rtsp://localhost:8554/camera-1-raw
```

The worker will consume this URL as if it were a real CCTV camera.

Create these infrastructure files:

```text
infrastructure/
└── media/
    ├── mediamtx.yml
    └── simulate_camera.ps1
```

`mediamtx.yml` should configure the local MediaMTX instance. The default RTSP listener on port `8554` is sufficient for the initial test.

`simulate_camera.ps1` should validate the input file, start FFmpeg in real time, loop the file indefinitely, publish to the selected raw path, and stop cleanly when the process exits.

An equivalent one-camera FFmpeg command is:

```powershell
ffmpeg -re -stream_loop -1 -i .\worker\videos\intersection_01.mp4 `
  -an -c:v libx264 -preset veryfast -tune zerolatency `
  -pix_fmt yuv420p -f rtsp rtsp://localhost:8554/camera-1-raw
```

`-re` publishes at approximately the source video's natural speed. `-stream_loop -1` repeats the file. `-an` omits audio because the worker currently processes video only.

For multiple cameras, run one publisher per path:

```text
intersection_01.mp4 → camera-1-raw
intersection_02.mp4 → camera-2-raw
intersection_03.mp4 → camera-3-raw
```

Do not reuse one raw path for multiple simulated cameras.

Before starting the worker, verify that an independent RTSP client can open:

```text
rtsp://localhost:8554/camera-1-raw
```

This isolates camera simulation and MediaMTX problems from worker/model problems.

The input flow is:

```text
worker/videos/intersection_01.mp4
        ↓
FFmpeg real-time loop
        ↓
MediaMTX: camera-1-raw
        ↓
rtsp://localhost:8554/camera-1-raw
        ↓
Detection worker
```

## 6. Stage 2: Consume RTSP and Produce Annotated MP4

The first worker target is:

```text
rtsp://localhost:8554/camera-1-raw
        ↓
worker/run_worker.py
        ↓
worker/pipeline.py
        ↓
YOLO vehicle detection + ByteTrack
        ↓
worker/outputs/intersection_01_annotated.mp4
```

### Processing flow

```text
OpenCV VideoCapture("rtsp://localhost:8554/camera-1-raw")
        ↓
Read one frame
        ↓
vehicle_model.track(frame, persist=True)
        ↓
result.plot()
        ↓
OpenCV VideoWriter
```

The pipeline should:

1. Open the camera's RTSP URL.
2. Wait for the RTSP connection to become available.
3. Read the stream's width, height, and FPS.
4. Read frames sequentially.
5. Run vehicle detection and tracking.
6. Draw bounding boxes and track IDs.
7. Write the annotated frame to an output video.
8. Reconnect if the RTSP publisher temporarily disconnects.
9. Stop cleanly when the process receives a shutdown signal.

For continuous processing, tracking must remain active across frames. The existing batch endpoint uses `persist=False`, which is appropriate for separate requests but not for one long-running simulated camera.

The worker configuration should be:

```text
CAMERA_ID=camera-1
INPUT_STREAM_URL=rtsp://localhost:8554/camera-1-raw
OUTPUT_MODE=file
OUTPUT_VIDEO_PATH=worker/outputs/intersection_01_annotated.mp4
```

The worker must not open `worker/videos/intersection_01.mp4` in this stage. FFmpeg owns file-to-RTSP conversion; the worker owns RTSP-to-annotated-output processing.

## 7. Stage 3: Publish Annotated Output RTSP

After RTSP input and annotated MP4 output work, add an RTSP output sink:

```text
Input:  rtsp://localhost:8554/camera-1-raw
Output: rtsp://localhost:8554/camera-1-annotated
```

The output flow is:

```text
MediaMTX: camera-1-raw
        ↓
worker/run_worker.py
        ↓
YOLO + ByteTrack + annotation
        ↓
FFmpeg encoder or RTSP output sink
        ↓
MediaMTX: camera-1-annotated
        ↓
WebRTC/HLS playback for frontend
```

Never publish annotated frames back to `camera-1-raw`. Separate paths prevent the frontend from receiving unannotated video and avoid a feedback loop.

Use:

```text
CAMERA_ID=camera-1
INPUT_STREAM_URL=rtsp://localhost:8554/camera-1-raw
OUTPUT_MODE=rtsp
OUTPUT_STREAM_URL=rtsp://localhost:8554/camera-1-annotated
```

If OpenCV cannot reliably write the required RTSP codec/container, pipe raw frames to an FFmpeg subprocess from `worker/stream_output.py`. The detection pipeline should not know how encoding is implemented.

## 8. Stage 4: Looping and Reconnection

The prerecorded-file loop belongs to the RTSP camera simulator, not the worker. The worker should behave like a real camera client and reconnect when the source becomes unavailable.

```text
intersection_01.mp4 → camera-1-raw → worker
intersection_01.mp4 → camera-1-raw → worker
...
```

The worker should not restart merely because the source video reaches its end. From the worker's perspective, the RTSP publisher should remain available across loops.

The simulator should increment `loop_iteration` at each file loop. If the worker cannot receive that value through RTSP, maintain a local source-session counter based on reconnects or add a separate telemetry channel later.

## 9. Stage 5: Loop Metadata

The camera simulator, not the worker, owns the prerecorded file loop. It should track:

```text
camera_id
session_id
loop_iteration
source_frame_index
video_timestamp_seconds
wall_clock_timestamp
```

Use the video timestamp for deterministic traffic-signal simulation. Use the loop iteration when constructing event IDs so repeated videos do not create accidental duplicates.

Example event identity:

```text
camera_id + loop_iteration + track_id + violation_type
```

## 10. Worker Files

Create the following files inside `worker/` as the implementation grows:

```text
worker/
├── app.py
├── pipeline.py
├── simulation.py
├── stream_output.py
├── worker_config.py
├── run_worker.py
├── stream_state.py
├── videos/
│   └── intersection_01.mp4
├── outputs/
│   └── intersection_01_annotated.mp4
├── rules/
├── evidence/
└── tests/
    ├── test_pipeline.py
    └── test_simulation.py
```

### `worker/pipeline.py`

Own frame processing:

- Accept a frame.
- Run YOLO detection and ByteTrack.
- Produce detection metadata.
- Produce an annotated frame.
- Do not manage HTTP routes or video files.

Suggested conceptual return value:

```text
{
  "frame": annotated_frame,
  "detections": [...],
  "frame_index": ...,
  "timestamp_seconds": ...
}
```

### `worker/simulation.py`

Own RTSP camera-client behavior:

- Open the configured RTSP URL.
- Retry when the RTSP source is temporarily unavailable.
- Maintain frame and source-session counters.
- Pass frames to the pipeline.
- Send output frames to the configured output sink.

It should not open the prerecorded MP4 in the RTSP-based implementation. The FFmpeg camera simulator owns that file.

### `worker/stream_output.py`

Own output destinations:

```text
FileOutput   → annotated MP4
MjpegOutput  → multipart HTTP stream
RtspOutput   → FFmpeg/MediaMTX
```

Start with `FileOutput`. Add the other implementations without changing the detection pipeline.

### `worker/worker_config.py`

Read and validate configuration such as:

```text
INPUT_STREAM_URL
OUTPUT_VIDEO_PATH
CAMERA_ID
OUTPUT_MODE
OUTPUT_STREAM_URL
FRAME_STRIDE
CONFIDENCE_THRESHOLD
TRACKER_CFG
```

Fail explicitly when required files or model paths do not exist. Do not silently fall back to an invalid input.

### `worker/run_worker.py`

Provide the command-line entrypoint for one RTSP-consuming worker:

```text
python run_worker.py
```

It should construct the configuration, pipeline, RTSP client, and output sink, then run the worker loop.

### `worker/stream_state.py`

For development MJPEG mode, store the latest encoded JPEG per camera:

```text
camera_id → latest JPEG bytes
```

This should be an in-memory development component, not the final persistence mechanism.

## 11. Stage 6: Development MJPEG Stream

After annotated MP4 output works, expose a simple development stream:

```text
GET /streams/<camera_id>/mjpeg
```

The response should use:

```text
Content-Type: multipart/x-mixed-replace; boundary=frame
```

The pipeline publishes the latest annotated JPEG to `stream_state.py`. The HTTP endpoint continuously yields the latest frames.

A browser can test it with:

```html
<img src="http://localhost:<worker-port>/streams/camera-1/mjpeg">
```

MJPEG is useful for proving that annotated frames are being generated and delivered, but it is only a development stream:

- It has high bandwidth usage.
- It has no audio.
- It is less efficient than WebRTC or HLS.
- Each browser connection can increase bandwidth and encoding work.

## 12. Stage 7: MediaMTX and Browser Playback

The documented production-like path is:

```text
Prerecorded MP4
        ↓
FFmpeg camera simulator
        ↓
MediaMTX raw path
        ↓
Worker reads RTSP
        ↓
YOLO + ByteTrack + annotation
        ↓
FFmpeg encoder
        ↓
RTSP publish
        ↓
MediaMTX
        ↓
WebRTC or HLS
        ↓
Frontend
```

The worker should publish an annotated stream such as:

```text
rtsp://localhost:<port>/camera-1-annotated
```

MediaMTX should expose the browser-compatible playback URL. The Rails backend should return that URL or the output stream key to the frontend.

### FFmpeg responsibility

Keep FFmpeg process management in:

```text
worker/stream_output.py
```

Do not put FFmpeg subprocess handling directly in `worker/app.py`.

The output abstraction should allow the same pipeline to use:

```text
FileOutput
MjpegOutput
RtspOutput
```

## 13. How to Use `worker/app.py`

Use the existing `app.py` as the model HTTP API initially. Do not immediately rewrite it.

Recommended short-term process model:

```text
Process 1: Flask API
  - image detection
  - uploaded-video detection
  - plate detection
  - health check

Process 2: Detection worker pipeline
  - continuous RTSP reading
  - vehicle tracking
  - annotation
  - output publishing
```

This avoids turning an upload request into a long-running stream.

### Later refactoring

After the first streaming path works, model loading can be extracted into reusable modules:

```text
worker/
├── models/
│   ├── vehicle_detector.py
│   ├── plate_detector.py
│   └── ocr_reader.py
├── app.py
└── pipeline.py
```

Both `app.py` and `pipeline.py` can then share the model service classes. This is a later cleanup; it is not required for the first backend validation.

## 14. Rails Backend Work

The Rails application currently has a minimal routes file:

```text
backend/config/routes.rb
```

The database already contains a camera schema with fields for:

- `raw_stream_key`
- `output_stream_key`
- `worker_status`
- `last_heartbeat`
- `signal_state`
- `stop_line`
- `frame_width`
- `frame_height`

These fields are defined in:

```text
backend/db/migrate/20260930213144_create_cameras.rb
```

The Rails models and routes should be implemented after the worker can produce an annotated stream.

### Rails files

Create or update:

```text
backend/config/routes.rb
backend/app/controllers/api/v1/cameras_controller.rb
backend/app/controllers/api/v1/workers_controller.rb
backend/app/controllers/api/v1/violations_controller.rb
backend/app/models/camera.rb
backend/app/models/violation.rb
```

Add request tests under:

```text
backend/test/controllers/
```

## 15. Minimum Camera API

Add endpoints such as:

```text
GET /api/v1/cameras
GET /api/v1/cameras/:id
GET /api/v1/cameras/:id/config
```

The camera configuration response should contain:

```json
{
  "id": "camera-uuid",
  "name": "Intersection 1",
  "raw_stream_key": "camera-1-raw",
  "output_stream_key": "camera-1-annotated",
  "stream_url": "http://localhost:8889/camera-1-annotated/whep",
  "frame_width": 1920,
  "frame_height": 1080,
  "stop_line": null,
  "signal_state": "GREEN",
  "red_grace_seconds": 0
}
```

For the first stream test, `stop_line` and violation processing can remain unset.

## 16. Minimum Worker Heartbeat API

Initially, worker status can be stored on the camera record:

```text
POST /api/v1/workers/:worker_id/heartbeat
```

The worker should report:

```json
{
  "camera_id": "camera-uuid",
  "status": "RUNNING",
  "fps": 12.4,
  "processed_frames": 1200,
  "model_version": "vehicle-model-v1",
  "rule_version": "rules-v1",
  "input_stream_key": "camera-1-raw",
  "output_stream_key": "camera-1-annotated",
  "error": null
}
```

Use these states:

```text
STARTING
RUNNING
ERROR
STOPPED
```

For the complete architecture, add a separate `workers` table later. The camera-level status fields are sufficient for an MVP.

## 17. Minimum Violation API

Implement this only after streaming works:

```text
POST /api/v1/violations
```

Example payload:

```json
{
  "event_id": "camera-loop-track-rule",
  "camera_id": "camera-uuid",
  "type": "RED_LIGHT",
  "occurred_at": "2026-10-02T09:30:00Z",
  "track_id": 14,
  "plate_text": "BA123PA4567",
  "plate_conf": 0.91,
  "detection_confidence": 0.88,
  "signal_state": "RED",
  "rule_version": "rules-v1",
  "model_version": "vehicle-model-v1",
  "metadata": {}
}
```

The existing violations migration already contains most of the required fields:

```text
backend/db/migrate/20260930213801_create_violations.rb
```

## 18. Rules and Evidence After Streaming

Once the annotated stream is stable, add:

```text
worker/rules/
worker/evidence/
```

The next processing stages should be:

1. Load per-camera geometry.
2. Scale stop-line coordinates from calibration resolution to stream resolution.
3. Implement a simulated signal provider based on video timestamp.
4. Detect red-light violations using tracked vehicle state.
5. Run plate recognition only for violating tracks.
6. Capture snapshots and short clips.
7. Store pending evidence in a local outbox.
8. Upload evidence through backend-presigned URLs.
9. Post violation metadata to Rails.

Do not run plate OCR on every frame. It should run only for tracks that produce a violation.

## 19. Validation Plan

### Milestone 1: Existing model API

Validate:

```text
GET /health
POST /vehicle/detect with a short MP4
POST /plate/detect with a test frame and vehicle bounding box
```

### Milestone 2: RTSP camera input

Acceptance criteria:

- MediaMTX starts successfully.
- FFmpeg publishes the prerecorded video to `camera-1-raw`.
- An independent RTSP client can open `rtsp://localhost:8554/camera-1-raw`.
- The video loops without requiring the worker to restart.
- The raw input path is distinct from the annotated output path.

### Milestone 3: Continuous annotated file

Acceptance criteria:

- The simulation process starts.
- The model loads successfully.
- Frames are processed sequentially.
- Bounding boxes are visible in the output.
- Track IDs persist across adjacent frames.
- Output FPS is reasonable.
- The output video is playable.
- The output duration is close to the source duration.
- The process stops cleanly.

### Milestone 4: Annotated RTSP output

Acceptance criteria:

- The worker reads only `camera-1-raw`.
- The worker publishes only `camera-1-annotated`.
- `camera-1-annotated` contains bounding boxes and track IDs.
- `camera-1-raw` remains unannotated.
- A temporary RTSP disconnect causes retry/reconnection instead of an unrecoverable crash.

### Milestone 5: MJPEG stream

Acceptance criteria:

```text
GET /streams/camera-1/mjpeg
```

returns changing annotated frames continuously.

### Milestone 6: MediaMTX browser playback

Acceptance criteria:

```text
worker → RTSP → MediaMTX → browser-compatible WebRTC/HLS
```

The stream must contain annotations and must not expose the raw camera feed to the frontend.

### Milestone 7: Rails configuration

Seed one camera:

```text
camera-1
raw_stream_key: camera-1-raw
output_stream_key: camera-1-annotated
worker_status: RUNNING
```

The worker should eventually obtain configuration from Rails instead of relying entirely on hard-coded values.

### Milestone 8: Heartbeats and errors

Verify that Rails receives:

- Worker state
- FPS
- Processed-frame count
- Model version
- Rule version
- Last error

## 20. What Not to Do Initially

Do not:

1. Treat the complete JSON response from `/vehicle/detect` as a live stream.
2. Return every annotated frame as base64 JSON for frontend playback.
3. Put an infinite video loop inside a Flask request.
4. Run YOLO inference in the Rails backend.
5. Make the frontend call the model directly.
6. Run plate OCR on every frame.
7. Implement shared-model multi-camera processing yet.
8. Implement batched inference yet.
9. Add evidence uploads before annotated streaming works.
10. Rewrite the existing model endpoints before the separate pipeline is validated.

## 21. Recommended First Deliverable

The first complete backend deliverable should be:

```text
One prerecorded video
        ↓
FFmpeg RTSP camera simulator
        ↓
MediaMTX: camera-1-raw
        ↓
One long-running worker process
        ↓
YOLO vehicle detection + ByteTrack
        ↓
Annotated MP4 output
```

The second deliverable should be:

```text
FFmpeg camera simulator
  → camera-1-raw RTSP
  → worker
        ↓
Annotated MJPEG development stream
```

The production-like deliverable should then be:

```text
prerecorded MP4
  → FFmpeg
  → camera-1-raw RTSP
  → worker
  → camera-1-annotated RTSP
  → MediaMTX
  → WebRTC/HLS
  → frontend
```

The essential separation is:

```text
Detection pipeline produces annotated frames.
Stream output publishes annotated frames.
Rails stores configuration and metadata.
MediaMTX delivers browser-compatible video.
Frontend subscribes only to the annotated output stream.
```
