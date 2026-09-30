# Traffic Violation Detection System: Architecture & Requirements Proposal (v2)

## 1. Purpose and Design Principle

The system detects traffic violations at intersections, identifies the violating vehicle through Nepali number plate recognition, and delivers timestamped evidence to a review dashboard for authorities.

The central design principle: **the Detection Worker is the unit of deployment, and every camera feed is served by an identical per-camera pipeline.** A worker takes one or more camera identities and stream addresses, performs all computer vision and rule evaluation locally, and communicates with the rest of the system only through a small set of network contracts. In the project, each worker serves one camera feed. In the real-world target, one worker serves the 3-4 cameras of a junction cluster through a shared model. The per-camera pipeline is the same in both cases, and where a worker physically runs (beside the camera or in a server room) is a deployment decision.

---

## 2. Architectural Trade-off Analysis

Two independent decisions shape the system. The first concerns physical deployment and network topology. The second concerns how camera feeds are executed through the neural network.

### 2.1 System Architecture (Physical and Deployment Structure)

**Centralized Architecture.** Every camera sends raw or encoded video across the network to a single powerful server or GPU cluster, where all processing happens.
* Strengths: simple operations, one place to update and monitor, shared GPU utilization.
* Costs: sustained bandwidth per camera, added latency before a frame reaches the model, and a single failure domain for every camera.

**Distributed (Edge/Cloud) Architecture.** Small edge nodes process video locally at the junction and report only structured metadata and evidence to a central hub.
* Strengths: continuous raw video stays local, which lowers bandwidth and latency costs. A site keeps detecting through backend outages because results queue locally.
* Costs: rollout of models and code across sites, clock synchronization, health monitoring, and physical and network security of field devices.

**Position.** In real deployments, a distributed architecture takes priority because of the network bandwidth and latency needed to move video to a central server. For this project, a central server spawns multiple independent Detection Workers, one per camera feed. Each worker is built as an edge node would be: it holds its own configuration, processes its own feed, and reaches the rest of the system only through the network contracts in Section 6. The demonstration therefore runs the distributed design's software on centralized hardware, and moving a worker to an edge device requires a deployment change only.

### 2.2 System Design (Pipeline Execution Strategy)

**Individual Processing (one worker per camera feed).** Each camera feed has a dedicated worker with its own model instance. The worker reads frames only from that feed and runs inference on them one frame at a time (batch size 1). Workers run concurrently as separate processes or containers.
* Strengths: simple implementation (a new camera needs a new worker instance with identical configuration and a different input), fault isolation between cameras, independent frame rates, and per-camera scaling.
* Costs: every worker loads its own copy of the models and its own GPU context, so memory and per-process overhead grow with the camera count, and the GPU time-slices across worker processes.

**Shared-Model Processing (one worker, several camera feeds).** A single worker serves several camera feeds through one model instance. Each feed keeps its own per-camera pipeline (grabber, tracker state, rule engine, signal provider, evidence buffer, and annotated stream), while frames from the different cameras pass through the shared detector.
* Strengths: one model copy and one GPU context per node, lower memory and startup overhead per camera, and a single process to supervise and update per junction cluster. This suits an edge computer serving 3-4 nearby cameras.
* Costs: a crash or memory leak inside the worker can affect every camera it serves unless per-camera pipelines are supervised and restarted independently, plus a scheduling policy for the shared detector and demultiplexing of results back to per-camera state.

**Batch Processing (an optional mode of the shared-model worker).** Frames from Camera 1 through Camera N are stacked into a single tensor of shape `[N, C, H, W]` and pass through the GPU in one forward pass.

Batching might not be a meaningful optimization at the scale of 3-4 cameras per node. Several factors might limit its gain:
* Batching accelerates only the detection stage. Video decoding, tracking, annotated-stream encoding, and rule evaluation remain per camera and might account for most of the frame time.
* Where the GPU is already well utilized at batch size 1, a batch of 3-4 frames might add little throughput.
* Assembling a batch introduces waiting time, and cameras with different frame rates need a synchronization policy, so the latency cost might offset the throughput gain.
* Common edge inference runtimes might build engines for a fixed batch size, which complicates a camera dropping out of the group.

These points are hypotheses. Whether batching pays off is a question for further study with measurements on target hardware.

**Real-World Target.** A shared-model worker on each edge node, serving the 3-4 cameras near that node. Its expected benefits are a single model instance and GPU context (lower memory), no repeated model loading per camera, one process to deploy and monitor per junction cluster, and local processing that removes the latency of long-distance video transport. Batching remains an optional refinement inside this worker, pending the study described above.

**Project Decision.** The project uses individual processing: one worker per camera feed. The choice rests on simplicity of implementation, given the project's resources and timeframe. Adding a camera means starting another worker container with the same configuration and a different input. The worker's detector sits behind an interface that accepts one or several frames, so a shared-model or batched variant can replace the in-process model without changing the rest of the pipeline.

> **Side note: how the shared model still serves individual camera feeds to the frontend.** Sharing the model shares the computation and leaves the output separate per camera. Every detection carries the camera identity of the frame it came from, and each camera's pipeline draws bounding boxes onto its own frames and publishes them under that camera's own output stream key. The backend holds the input and output keys of every camera, and the frontend subscribes to the output key of whichever camera the operator selects. The frontend therefore always receives the annotated feed (video with bounding boxes) and never the raw CCTV video, whether one worker serves one camera or several.

### 2.3 Combined View

| | Individual worker per feed | Shared-model worker | Shared-model worker with batching |
|---|---|---|---|
| **Centralized** | **Project implementation:** a central server spawning one worker per camera | Feasible; consolidates model copies when many streams share a server | Applies at higher stream counts per GPU, where batching is most likely to help |
| **Distributed** | Feasible; duplicates the model per camera at each node | **Real-world target:** one worker per node serving 3-4 cameras | Optional refinement, subject to further study |

### 2.4 Recommendation
Adopt the distributed architecture with a shared-model worker per edge node as the real-world target, with batching as an optional refinement to be studied. Implement the project as centrally hosted, individual workers, one per camera feed, for simplicity of implementation within the available resources and timeframe. The cost of per-camera model duplication and the potential gains of the shared model are characterized through measurements (Section 9).

---

## 3. Constraints

* A three-person college project with limited hardware and a short delivery window.
* No physical IP cameras. RTSP feeds are simulated by looping 3-4 pre-recorded intersection videos.
* Advanced deployment techniques from recent literature, including shared-model and batched multi-stream inference, are outside the implementation scope.
* Deliverables: the intended architecture together with its limitations and a realistic implementation path, and a full cost-benefit analysis.

---

## 4. System Architecture

```
 [Simulated Camera: looping video -> RTSP (input stream key)]
                       |
                       v
        +-----------------------------------------------+
        |               Detection Worker                |
        |  frame grabber -> YOLO detector + tracker     |
        |          |                    |               |
        |          |            Rule Engine <-- Signal State Provider
        |          |                    |       + stop-line config
        |          |            Plate Recognition (violating tracks only)
        |          |                    |               |
        |   annotated-frame branch   Evidence Generator |
        |          |                    |               |
        |   encoder -> publish       Outbox (local)     |
        +----------|--------------------|---------------+
                   |                    |
        (output stream key)     presigned upload + metadata POST
                   |                    |
                   v                    v
           Media Server           Object Storage  <--  Backend (API + WebSocket) -- PostgreSQL
                   |                                          |
                   +------------------> Frontend <------------+
```

The diagram shows the project configuration: one worker per camera feed. In the shared-model target, several per-camera pipelines feed one detector inside a single worker, and each pipeline still publishes to its own output key.

### Stream Keys
Every camera record in the backend holds two keys, assigned at camera creation:
* **Input key:** the raw simulated feed the worker consumes.
* **Output key:** the annotated feed (vehicles with bounding boxes and track IDs) the worker publishes.

The frontend retrieves the output key from the backend and subscribes to it through the media server, which converts the stream to a browser-playable format (WebRTC or HLS). Rule evaluation proceeds independently inside the worker.

---

## 5. Component Specifications

### A. Detection Worker

**Worker structure.** A worker consists of a *detector* (model inference) and one *per-camera pipeline* for each feed it serves. In the project, a worker holds one pipeline and its own detector. In the shared-model target, several pipelines submit frames to one detector, and results return tagged with the camera identity. The detector sits behind an interface (`infer(frames) -> detections`) that accepts one or several frames, which lets shared-model and batched variants join without changing the pipeline.

**Video processing.** A grabber thread reads the input stream and keeps only the most recent frame, dropping stale frames under load. The detector identifies vehicles per frame, and the tracker links detections into persistent track IDs across frames (ByteTrack via the YOLO framework's tracking mode). Each pipeline owns its tracker instance, since track state belongs to a single stream. Every rule operates on tracks.

**Annotated stream branch.** Frames with drawn boxes and IDs flow to an encoder that publishes to the camera's output key. This branch drops frames under backpressure, so a slow viewer cannot delay violation detection. Publishing can be gated on viewer presence as an edge bandwidth optimization.

**Stop-line and calibration data.** The worker fetches per-camera configuration from the backend: stop-line polyline (plus exit line or region of interest where a rule needs it), the reference resolution the geometry was drawn at, the signal profile, and the rule-set version. Coordinates scale from the reference resolution to the stream resolution.

**Signal State Provider.** Traffic light state comes from an interface with two implementations: a *Simulated* provider (current) and a *Real* provider (future signal-controller integration). The simulated provider follows a scripted phase timeline keyed to the **video timestamp**, so results are deterministic and reproducible across loops and runs.

**Rule Engine.** Rules are plugins with a common interface, evaluating a per-frame context (tracks, signal state, geometry) and returning violation events. The red-light rule runs a per-track state machine: a track crossing the stop line in the direction of travel while the signal is red (after a configurable grace period) produces a violation event. Additional violation types register as new plugins.

**License Plate Recognition.** Plate detection and OCR run only for tracks that produced a violation. Recognition aggregates results across several frames of the track and selects the consensus reading, then applies Nepali plate format validation and classification.

**Evidence Generation.** A ring buffer of recent frames supports a clip covering a window before and after the event. The worker produces a snapshot, plate crop, and clip, and assembles the metadata payload.

**Delivery and Resilience.** Each event has a deterministic `event_id` derived from camera, loop iteration, track ID, and violation type, which makes retries idempotent and prevents duplicate records when the source video loops. Files upload directly to object storage through presigned URLs, then the worker posts metadata to the backend. A local outbox stores pending events and retries delivery while the backend is unreachable.

**Updates.** Rule parameters and geometry are versioned data, pulled by the worker. Rule logic and models ship as versioned container images. The worker reports its image, model, and rule versions in every heartbeat.

### B. Backend

* **Camera Management:** camera metadata, input and output stream keys, per-camera configuration, reference frames, and configuration versions.
* **Worker Management:** registration, heartbeats, and reported versions.
* **Evidence Management:** violation records, object-storage keys, query, filtering, plate search, and review status.
* **Global Violation Rules:** the authoritative store of rule parameters and versions, giving consistent behavior across intersections.
* **Streaming and Events Services:** WebSocket delivery of new violations and worker status to clients. Video travels through the media server.

### C. Frontend (Police / Admin Interface)

* **Live monitoring:** subscribe to a camera's output stream and view real-time bounding boxes. The frontend camera view shows the current traffic light state and provides a control to change it, even though the light is simulated. The frontend always shows the annotated feed and never the raw camera video.
* **Evidence review:** violation list, detail view with snapshot, plate crop, clip, and timestamps, plus plate search and status management.
* **Camera calibration:** the dashboard shows a reference frame captured from the camera's input stream, and the operator draws the stop line (and any exit line or region) on it. The frontend saves the geometry with the reference resolution, and the operator confirms it before it becomes the active version. Workers pick up the new configuration version at their next poll. Human confirmation of the line is the intended design for evidence that authorities rely on.

---

## 6. Data Contracts

| Interface | Purpose |
|---|---|
| `GET /cameras/{id}/config` | Stop-line geometry, reference resolution, signal profile, rule-set version, stream keys |
| `PUT /cameras/{id}/config` | Saves confirmed calibration from the frontend as a new configuration version |
| `POST /cameras/{id}/reference-frame` | Worker uploads a frame from the input stream for calibration |
| `POST /workers/{id}/heartbeat` | Worker health, FPS, image, model, and rule versions |
| `POST /evidence/presign` | Presigned upload URLs for snapshot, plate crop, and clip |
| `POST /violations` | Violation metadata with `event_id`, `camera_id`, `type`, `occurred_at`, `plate_text`, `plate_conf`, `track_id`, storage keys, `rule_version`, `model_version` |

The `violations` table is range-partitioned by month, so its uniqueness constraint includes the partition key: `UNIQUE (event_id, occurred_at)`.

---

## 7. Global Rules and Synchronization

Rule behavior is split by kind:
* **Parameters** (grace period, enabled rules, thresholds) are data owned by the backend and pulled by workers with a version number.
* **Logic** is code delivered as versioned container images, using standard image tagging for distribution.

Together they give consistent enforcement across cameras while each worker executes locally.

---

## 8. Edge Operational Concerns

* **Clock synchronization** across workers, since evidence timestamps carry weight.
* **Store-and-forward** through the outbox during backend outages.
* **Health monitoring** through heartbeats and version reporting.
* **Model and rule rollout** through image tags and configuration versions.
* **Device security** for field hardware, including credentials for presigned upload and API access.
* **Per-camera fault isolation** in a shared-model worker, through supervised per-camera pipelines that restart independently, so one stalled feed leaves the other cameras of the node running.

---

## 9. Cost-Benefit Analysis

The analysis covers two comparisons, using measured values from the project's own pipeline wherever the project implements the configuration.

### 9.1 Architecture: Distributed versus Centralized

| Factor | Distributed (edge) | Centralized | Measurement |
|---|---|---|---|
| Continuous bandwidth | Evidence and metadata only | One sustained video stream per camera | Stream bitrate of the test videos; clip size × violations per day |
| Compute | Modest device per 2-4 cameras | Shared GPU with higher utilization | Detector + tracker + plate FPS on the development machine and under CPU and memory limits |
| Failure domain | One site | All cameras | Behavior under simulated backend outage |
| Operations | Rollout, monitoring, security per site | Single location | Qualitative, from Section 8 |
| Latency | Local decision | Depends on link | Per-stage latency (grab, detect, rule, upload) |

Edge-class performance is characterized by running the worker with restricted CPU and memory (container limits) and CPU inference runtimes such as ONNX or OpenVINO, and reporting the resulting FPS. Hardware prices are added from current quotations at the time of writing.

### 9.2 Execution Strategy: Individual, Shared-Model, and Batched

| Factor | Individual workers (project) | Shared-model worker (target) | Shared-model worker with batching (optional) |
|---|---|---|---|
| GPU memory | One model copy and GPU context per camera | One per node | One per node |
| Throughput | Aggregate FPS across concurrent workers | Expected to match or exceed individual workers on shared hardware | Might improve where batch size 1 underuses the GPU |
| Latency | Independent per feed | Queueing at the shared detector | Adds the wait for the batch to fill |
| Fault isolation | Full | Requires per-pipeline supervision | Coupled through the batch |
| Implementation effort | Lowest | Moderate | Highest |

Measurement plan: the project measures GPU memory and aggregate FPS with 1 to 4 concurrent individual workers, and measures the memory of a single worker to estimate the saving from consolidating model copies. An offline detector benchmark compares FPS at batch size 1 with batch sizes of 2 to 4. It gives an estimate of the shared-model and batching gains without building either pipeline.

### 9.3 Detection Quality
Detection quality is evaluated against hand-labeled ground truth for each test video, reporting precision and recall for violations and accuracy for plate recognition.

---

## 10. Limitations

* Cameras are simulated by looping recorded video.
* The traffic signal is simulated using the Police/Admin Interface during live monitoring.
* Edge performance is emulated through resource limits, since real edge hardware is unavailable.
* Calibration assumes a fixed camera, and a moved camera requires recalibration.
* Each project worker holds its own model instance, so GPU memory and contention grow with the worker count. The shared-model worker and batched inference are described and left unimplemented, and their benefits are estimated from offline benchmarks.
* Fleet-scale rollout, remote device management, and techniques from recent literature are described but left unimplemented.
* Tracking accuracy depends on the tracker's behavior under occlusion near the stop line, and it is validated per test video.

---

## 11. Implementation Scope

| Component | Status |
|---|---|
| Detection worker: detection, tracking, red-light rule, plate recognition, evidence generation, outbox | Implemented |
| Individual worker per camera feed, running as independent containers on separate videos | Implemented |
| Simulated cameras and signal timeline | Simulated |
| Annotated output stream and live monitoring | Implemented |
| Backend APIs, camera and evidence management, WebSocket events | Implemented |
| Frontend dashboard, evidence review, calibration tool | Implemented |
| Additional violation rules (stop-line encroachment, helmet) | Implemented as time permits; the plugin interface is in place |
| Shared-model multi-stream worker (real-world target) | Described only |
| Batched inference, shared inference service, on-demand stream publishing, fleet rollout, real signal controller, real edge hardware | Described only, with batching subject to further study |
