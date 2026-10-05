# Traffic Violation Detection System: API Contract (v1)

**Sources:** `system_architecture_proposal_v2.md`, `deployment_plan_defense.md`, `ER_Diagram_Documentation.md`

**Backend:** Rails 7 API + Action Cable, PostgreSQL, MinIO, MediaMTX

**Consumers:** Detection Worker, React Dashboard, Backend

Section 9 lists every place where this contract resolves a conflict between the three source documents or requires a schema change. Read it before writing migrations.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base URL | `http://192.168.1.100:3000/api/v1` (defense setup) |
| Format | JSON, `Content-Type: application/json`, UTF-8. The only exception is the reference-frame upload (multipart). |
| IDs | UUID strings. `violation_types` uses a `SMALLINT` internally, but the API exposes only its `code`. |
| Timestamps | ISO 8601, UTC, millisecond precision (`2026-10-04T08:14:02.311Z`). The frontend converts to Nepal Time (UTC+05:45) for display. |
| JSON keys | `snake_case` |
| Plate strings | The backend owns normalization. Clients send plates as typed or read, and the backend returns `plate_number` in normalized form. |
| Pagination | Cursor based: `?limit=50&cursor=<opaque>`. Response: `{ "data": [...], "page": { "next_cursor": "...", "has_more": true } }`. `limit` max is 100. |
| Sorting | Violation lists default to `occurred_at` descending. |
| Idempotency | Only `POST /violations` is idempotent, keyed by the client-supplied `id` (Section 4.5). |
| Deletion | No endpoint hard-deletes cameras, violations, evidence or audit entries. Officers can be deleted only while unreferenced (Section 4.8). |

### 1.1 Error envelope

Every non-2xx response uses this shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request body failed validation.",
    "details": [{ "field": "stop_line.p1.x", "message": "must be within frame_width" }],
    "request_id": "9f1c0c1e-..."
  }
}
```

`details` is present only for `422`. Error codes are listed in Appendix A.

### 1.2 Authentication

| Actor | Mechanism |
|---|---|
| Officer / Admin | `POST /auth/login` returns a JWT. Send `Authorization: Bearer <token>`. Token lifetime is 8 hours with no refresh in v1. After expiry the frontend re-authenticates. |
| Worker | Header `X-Worker-Key: <WORKER_API_KEY>`, a shared secret set as a container environment variable. The camera in the URL path identifies the worker. A per-camera token is a post-MVP hardening step. |

**Implementation (v1).** The backend uses Devise with `devise-jwt`, configured with only the `database_authenticatable` and `jwt_authenticatable` modules. Authentication is a plain match against the database:

- **Login:** Devise matches `email` and the submitted password against the `officers` row (`Password_Hash`, bcrypt). A match returns a signed JWT (HS256, signed with the Rails secret) with the claims `sub` (officer id), `iat`, `exp` and `jti`.
- **Every request:** the backend verifies the signature and expiry, then loads the officer by `sub` from the database. No matching row means `401 UNAUTHENTICATED`.
- **Role comes from the database row**, never from a token claim. A role change or an officer deletion takes effect on the next request.
- **Worker key:** the backend compares `X-Worker-Key` with `WORKER_API_KEY` from its environment. A match authorizes the call.

**Limitations (v1).** These are deliberate scope cuts for the project timeline, and the project report should list them:

| # | Limitation | Consequence |
|---|---|---|
| L1 | No refresh tokens. The token lives 8 hours. | The user logs in again after expiry. |
| L2 | No server-side token revocation (no denylist or allowlist of `jti`). | A logout only discards the token on the client. A stolen token stays valid until `exp`, unless the officer row is deleted. |
| L3 | No multi-factor authentication, login rate limiting or account lockout. | Password guessing is not throttled. |
| L4 | No password reset by email. An admin resets passwords through `PATCH /officers/{id}`. | Admin-only recovery. |
| L5 | The worker key is one shared secret for all workers, and it is not rotated. | One leaked key exposes every worker endpoint. |
| L6 | The Action Cable token travels in the URL query string. | The token can appear in server and proxy logs. Add `token` and `worker_key` to Rails `filter_parameters`. |
| L7 | The frontend keeps the token in browser storage (Section 7.1). | A cross-site scripting flaw could expose it. |
| L8 | Traffic runs over plain HTTP on the defense LAN. | Credentials and tokens are readable on the network. Terminate TLS before any real deployment. |

Hardening for these items is post-MVP work.

### 1.3 Roles and permissions

`ADMIN` includes every `OFFICER` permission.

| Resource | Worker | Officer | Admin |
|---|---|---|---|
| Cameras: create, update, calibrate | no | no | **yes** |
| Cameras: read | own config only | yes | yes |
| Signal: change | no | yes | yes |
| Signal: read | own camera | yes | yes |
| Heartbeat, reference-frame upload | **yes** (own camera) | no | no |
| Evidence presign | **yes** | no | no |
| Evidence read | no | yes | yes |
| Violations: create | **yes** | no | no |
| Violations: read | no | yes | yes |
| Violations: confirm, reject, reopen, note | no | yes | yes |
| Violations: propose vehicle | no | yes | yes |
| Violations: approve or reject vehicle proposal, create vehicle | no | no | **yes** |
| Audit log: read per violation | no | yes | yes |
| Audit log: global read | no | no | yes |
| Officers: manage | no | no | **yes** |
| Violation types, vehicles, owners: read | no | yes | yes |
| Violation types, vehicles, owners: write | no | no | no (seeds only) |

---

## 2. Resource Ownership Summary

| Resource | Created by | Updated by | Notes |
|---|---|---|---|
| `violation_types` | Seeds | Seeds | Read-only API. |
| `vehicles` | Seeds, plus admin-verified new plates | Seeds | Created through the vehicle-proposal flow (Section 4.6). **Workers never create vehicles.** |
| `owners` | Seeds | Seeds | Read-only API. Contains personal data. |
| `cameras` | Admin (the backend auto-registers the worker) | Admin; worker status fields by heartbeat | Never hard-deleted. Deactivate with `status = INACTIVE`. |
| `evidence` | Backend, from worker registration | Nobody | Worker uploads media directly to object storage; rows are immutable after insert. |
| `officers` | Admin | Admin | |
| `violations` | Worker | Officer or Admin, through action endpoints only | There is no generic `PUT` or `PATCH`. |
| `violation_audit_log` | Backend, as a side effect of a violation change | Nobody | Insert-once. No write endpoint exists. |

Any `POST`, `PUT`, `PATCH` or `DELETE` against a read-only resource returns `405 READ_ONLY_RESOURCE`.

---

## 3. Endpoint Index

| # | Method and path | Caller | Section |
|---|---|---|---|
| 1 | `POST /auth/login` | Any | 4.1 |
| 2 | `GET /auth/me` | User | 4.1 |
| 3 | `POST /auth/change-password` | User | 4.1 |
| 4 | `POST /cameras` | Admin | 4.2 |
| 5 | `GET /cameras` | User | 4.2 |
| 6 | `GET /cameras/{id}` | User | 4.2 |
| 7 | `PATCH /cameras/{id}` | Admin | 4.2 |
| 8 | `GET /cameras/{id}/config` | Worker, User | 4.3 |
| 9 | `PUT /cameras/{id}/config` | Admin | 4.3 |
| 10 | `POST /cameras/{id}/reference-frame` | Worker | 4.3 |
| 11 | `GET /cameras/{id}/reference-frame` | Admin | 4.3 |
| 11a | `POST /cameras/{id}/reference-frame/refresh` | Admin | 4.3 |
| 12 | `POST /cameras/{id}/heartbeat` | Worker | 4.3 |
| 13 | `GET /cameras/{id}/signal` | Worker, User | 4.3 |
| 14 | `PUT /cameras/{id}/signal` | User | 4.3 |
| 15 | `POST /evidence/presign` | Worker | 4.4 |
| 16 | `GET /violations/{id}/evidence` | User | 4.4 |
| 17 | `GET /evidence/{id}` | User | 4.4 |
| 18 | `POST /violations` | Worker | 4.5 |
| 19 | `GET /violations` | User | 4.5 |
| 20 | `GET /violations/{id}` | User | 4.5 |
| 21 | `POST /violations/{id}/confirm` | User | 4.5 |
| 22 | `POST /violations/{id}/reject` | User | 4.5 |
| 23 | `POST /violations/{id}/reopen` | User | 4.5 |
| 24 | `POST /violations/{id}/notes` | User | 4.5 |
| 25 | `POST /violations/{id}/vehicle` | User | 4.6 |
| 26 | `POST /violations/{id}/vehicle-proposal/approve` | Admin | 4.6 |
| 27 | `POST /violations/{id}/vehicle-proposal/reject` | Admin | 4.6 |
| 28 | `GET /violations/{id}/audit-log` | User | 4.7 |
| 29 | `GET /audit-log` | Admin | 4.7 |
| 30 | `POST /officers` | Admin | 4.8 |
| 31 | `GET /officers`, `GET /officers/{id}` | Admin (self for `{id}`) | 4.8 |
| 32 | `PATCH /officers/{id}` | Admin | 4.8 |
| 33 | `DELETE /officers/{id}` | Admin | 4.8 |
| 34 | `GET /violation-types`, `GET /vehicles`, `GET /vehicles/{id}`, `GET /vehicles/{id}/violations`, `GET /owners/{id}` | User | 4.9 |

---

## 4. Endpoints

### 4.1 Auth

**`POST /auth/login`**

```json
// request
{ "email": "officer@example.com", "password": "..." }

// 200
{
  "access_token": "eyJ...",
  "expires_at": "2026-10-04T16:00:00.000Z",
  "officer": { "id": "uuid", "name": "Ram Thapa", "badge_number": "NP-1042", "role": "OFFICER", "email": "officer@example.com" }
}
```

Errors: `401 INVALID_CREDENTIALS`.

Devise's default routes are remapped to these paths. The login response uses the contract's JSON shape, and the token is returned in the body (not only in the `Authorization` response header), so the frontend reads one place.

**`GET /auth/me`** returns the `officer` object above. The frontend calls it to confirm a stored token is still valid.

**Logout** has no endpoint. The client discards the token (limitation L2).

**`POST /auth/change-password`** takes `{ "current_password": "...", "new_password": "..." }` and returns `204`. The password is stored with bcrypt or argon2 (`Password_Hash`).

---

### 4.2 Cameras (admin-managed)

#### `POST /cameras` (Admin)

Registering a camera has these side effects, all inside one transaction:

1. The backend generates `output_stream_key` as `<camera-id>-annotated`, `raw_stream_key` as `<camera-id>-raw`, and `signal_state_key`.
2. If a separate signal-state generator is deployed, its base URL is configured with
   `SIGNAL_STATE_BASE_URL`; this repository currently stores the signal key but does not
   implement that generator or a signal-state HTTP endpoint.
2. The backend registers the camera's worker automatically (`worker_status = STOPPED`). There is no separate worker endpoint.
3. `config_version` starts at `1` with `stop_line = null`.

```json
// request
{
  "name": "Maitighar Junction North",
  "district": "Kathmandu",
  "municipality": "Kathmandu Metropolitan City",
  "installed_at": "2026-10-04",
  "raw_stream_key": "ignored-by-backend",   // ignored; backend generates `<camera-id>-raw`
  "status": "ACTIVE"                        // optional, default ACTIVE
}
```

`201` returns the camera object:

```json
{
  "id": "6f0e8c1a-...",
  "name": "Maitighar Junction North",
  "district": "Kathmandu",
  "municipality": "Kathmandu Metropolitan City",
  "status": "ACTIVE",
  "installed_at": "2026-10-04",
  "output_stream_key": "6f0e8c1a-...-annotated",
  "signal_state_key": "camera_signal_6f0e8c1a-...",
  "playback": {
    "webrtc_url": "http://192.168.1.100:8889/6f0e8c1a-...-annotated",
    "hls_url": "http://192.168.1.100:8888/6f0e8c1a-...-annotated/index.m3u8"
  },
  "calibration": {
    "status": "AWAITING_WORKER",
    "calibrated": false,
    "reference_frame_ready": false,
    "frame_width": null,
    "frame_height": null,
    "red_grace_seconds": 0.0,
    "config_version": 1
  },
  "worker": {
    "status": "STOPPED",
    "online": false,
    "last_heartbeat": null,
    "fps": null,
    "image_version": null,
    "model_version": null,
    "rule_version": null
  },
  "created_at": "2026-10-04T08:00:00.000Z"
}
```

The response never includes `raw_stream_key`. The frontend does not receive raw CCTV video or its address, by design. Only the worker receives it, through its config endpoint.

The operator uses the returned `id` as `CAMERA_ID` when starting the worker container (deployment plan, Section 4).

Errors: `422 VALIDATION_FAILED` for invalid camera metadata.

#### `GET /cameras` (User)

Filters: `status`, `district`, `municipality`, `worker_status`, `calibration_status` (`AWAITING_WORKER`, `AWAITING_CALIBRATION`, `CALIBRATED`). Returns a paginated list of camera objects.

#### `GET /cameras/{id}` (User)

Returns one camera object.

#### `PATCH /cameras/{id}` (Admin)

Updatable fields: `name`, `district`, `municipality`, `installed_at`, and `status`. The stream keys are generated identifiers and are not editable. Changing `status` increments `config_version` so the worker notices. `INACTIVE` cameras are not started: the worker idles when its config shows `status != ACTIVE`.

Geometry and grace period change only through `PUT /cameras/{id}/config`.

---

### 4.3 Camera configuration, calibration, heartbeat

#### `GET /cameras/{id}/config` (Worker, User)

Supports `If-None-Match: "<config_version>"` and returns `304` when unchanged.

```json
{
  "camera_id": "6f0e8c1a-...",
  "config_version": 3,
  "status": "ACTIVE",
  "raw_stream_key": "6f0e8c1a-...-raw",
  "output_stream_key": "6f0e8c1a-...-annotated",
  "signal_state_key": "camera_signal_6f0e8c1a-...",
  "frame_width": 1280,
  "frame_height": 720,
  "stop_line": {
    "p1": { "x": 212, "y": 640 },
    "p2": { "x": 1040, "y": 655 },
    "approach_side": "below"
  },
  "red_grace_seconds": 0.5
}
```

`raw_stream_key` appears only when the caller authenticates as a worker. `stop_line` is `null` until calibrated, and a worker with a null stop line keeps streaming annotated video but runs no stop-line rules.

#### `PUT /cameras/{id}/config` (Admin)

Saves a calibration confirmed by a human. The server rejects a request without `confirmed: true`.

```json
{
  "frame_width": 1280,
  "frame_height": 720,
  "stop_line": {
    "p1": { "x": 212, "y": 640 },
    "p2": { "x": 1040, "y": 655 },
    "approach_side": "below"
  },
  "red_grace_seconds": 0.5,
  "expected_config_version": 2,
  "confirmed": true
}
```

Validation:
- `frame_width` and `frame_height` are positive integers and equal the dimensions of the stored reference frame (`422 FRAME_SIZE_MISMATCH` otherwise). A calibration needs an uploaded reference frame, so a camera in `AWAITING_WORKER` returns `409 REFERENCE_FRAME_NOT_READY`.
- Both points lie inside the frame, and `p1 != p2`.
- `approach_side` is one of `above`, `below`, `left`, `right`.
- `red_grace_seconds` is between 0 and 99.9.

`200` returns the full config object with `config_version` incremented. The backend then broadcasts `camera.config_updated` (Section 5). Errors: `409 CONFIG_VERSION_CONFLICT` when `expected_config_version` is stale, and `422 VALIDATION_FAILED`.

#### `POST /cameras/{id}/reference-frame` (Worker)

Multipart form: `image` (JPEG), `frame_width`, `frame_height`. The worker uploads a frame from its input stream on every boot, and again whenever a heartbeat response carries `reference_frame_requested: true` (see `POST /cameras/{id}/reference-frame/refresh` below).

Backend behavior:
1. Store the image in object storage at the fixed key `cameras/{id}/reference.jpg`, overwriting the previous frame. Record `frame_width`, `frame_height` and the capture time as object metadata, so no schema change is needed.
2. Clear any pending refresh request for this camera.
3. Broadcast `camera.reference_frame_ready` on `CamerasChannel` (Section 5).

Returns `201 { "captured_at": "...", "frame_width": 1280, "frame_height": 720 }`.

#### `POST /cameras/{id}/reference-frame/refresh` (Admin)

Asks the worker for a new reference frame, for example when vehicles blocked the stop line in the first frame, or after the camera moved. The backend sets a refresh flag for the camera (cached in Redis) and returns `202`. The worker sees the flag in its next heartbeat response, uploads a new frame, and the backend broadcasts `camera.reference_frame_ready` again. Errors: `409 WORKER_OFFLINE` when `worker.online` is `false`.

#### `GET /cameras/{id}/reference-frame` (Admin)

```json
{
  "url": "http://192.168.1.100:9000/...signed...",
  "expires_at": "2026-10-04T08:20:00.000Z",
  "frame_width": 1280,
  "frame_height": 720,
  "captured_at": "2026-10-04T08:05:11.000Z"
}
```

Errors: `404 REFERENCE_FRAME_NOT_READY` when the worker has not booted yet.

#### `POST /cameras/{id}/heartbeat` (Worker)

The worker sends this every 5 seconds.

```json
{
  "status": "RUNNING",
  "fps": 24.1,
  "image_version": "detection-worker:gpu-1.4.0",
  "model_version": "yolo-v1",
  "rule_version": "rules-3",
  "applied_config_version": 3,
  "error": null
}
```

`status` is one of `STARTING`, `RUNNING`, `ERROR`, `STOPPED`. The worker sends `STOPPED` on graceful shutdown.

`200` returns `{ "config_version": 3, "camera_status": "ACTIVE", "reference_frame_requested": false }`. The worker refetches its config whenever the returned `config_version` differs from `applied_config_version`, so this response acts as the poll cycle. When `reference_frame_requested` is `true`, the worker uploads a fresh reference frame.

Persistence: PostgreSQL stores only `worker_status` and `last_heartbeat`. The remaining fields are cached in Redis with a 60 second TTL and exposed in the camera object's `worker` block.

Stale detection: a scheduled job treats a `RUNNING` worker whose `last_heartbeat` is older than 30 seconds as crashed, sets `worker_status = ERROR`, and broadcasts `camera.worker_status`. The camera object's `worker.online` is `true` only when the last heartbeat is 30 seconds old or newer.

#### `GET /cameras/{id}/signal` (Worker, User)

```json
{ "state": "RED", "updated_at": "2026-10-04T08:00:00.000Z" }
```

The worker calls this at boot to obtain its initial state, then follows the `camera_signal_{id}` channel.

#### `PUT /cameras/{id}/signal` (User)

```json
{ "state": "GREEN" }
```

`state` is one of `RED`, `YELLOW`, `GREEN`. The backend persists the state, sets `updated_at`, and broadcasts `signal.changed` on the camera's signal channel. Target latency from request to worker is under 200 ms (deployment plan, test 3). Returns `200` with the signal object.

---

### 4.3.1 Camera onboarding and calibration flow

Adding a camera ends with the admin drawing the stop line. The worker supplies a still frame, the backend stores it and notifies the dashboard, and the frontend prompts the admin to calibrate.

```
 Admin (frontend)              Backend                        Worker
        |                         |                              |
 1.     |-- POST /cameras ------->|                              |
        |<-- 201 status=AWAITING_WORKER, id                      |
        |  show "waiting for worker" + CAMERA_ID                 |
        |                         |                              |
 2.     |   operator starts the worker container with CAMERA_ID  |
        |                         |<-- GET /config --------------|
        |                         |<-- heartbeat STARTING -------|
        |                         |   worker waits for a stable frame
 3.     |                         |<-- POST /reference-frame ----|
        |                         |-- store image + metadata     |
        |                         |-- status = AWAITING_CALIBRATION
        |<-- camera.reference_frame_ready (Action Cable)         |
        |                         |                              |
 4.     |  open calibration screen                               |
        |-- GET /reference-frame ->|                             |
        |<-- signed URL, frame_width, frame_height               |
        |  admin draws line, picks approach_side, confirms       |
 5.     |-- PUT /config (confirmed: true) ->|                    |
        |<-- 200 config_version+1, status=CALIBRATED             |
        |<-- camera.config_updated                               |
        |                         |<-- heartbeat (applied_config_version old)
        |                         |--> response: config_version new
 6.     |                         |<-- GET /config --------------|
        |                         |   stop-line rules now active |
```

**Calibration status.** The backend derives `calibration.status` on every read. No column stores it.

| Status | Condition | Frontend behavior |
|---|---|---|
| `AWAITING_WORKER` | `stop_line` is null and no reference frame exists | Show "waiting for worker" and the `CAMERA_ID`. |
| `AWAITING_CALIBRATION` | `stop_line` is null and a reference frame exists | Prompt the admin to calibrate. |
| `CALIBRATED` | `stop_line` is set | Show the live view. Offer "Recalibrate". |

**What the backend does**

| Responsibility | Detail |
|---|---|
| Receive the frame | `POST /cameras/{id}/reference-frame` stores the JPEG at `cameras/{id}/reference.jpg` with `frame_width`, `frame_height` and capture time as object metadata. |
| Derive status | Computed from `stop_line` and the presence of the stored frame. |
| Notify the dashboard | Broadcasts `camera.reference_frame_ready` on every upload, including refreshes. |
| Serve the frame | `GET /cameras/{id}/reference-frame` returns a short-lived signed URL plus the native dimensions. The frontend never receives the frame bytes through the API server. |
| Guard the calibration | `PUT /cameras/{id}/config` requires `confirmed: true`, matching frame dimensions, a valid line, and a current `expected_config_version`. |
| Notify the worker | The next heartbeat response carries the new `config_version`. |
| Support recalibration | `POST /cameras/{id}/reference-frame/refresh` sets a flag that the worker reads from its heartbeat response. |
| Expose a work queue | `GET /cameras?calibration_status=AWAITING_CALIBRATION` lists cameras waiting for an admin. |

**What the worker does**
- It uploads the reference frame after the stream decodes stable frames (not the first frame, which can be black or partial).
- It retries the upload with backoff until the backend accepts it.
- While the camera is uncalibrated it keeps publishing the annotated stream and runs no stop-line or red-light rules.
- It uploads a new frame whenever a heartbeat response says `reference_frame_requested: true`.

**Who gets prompted.** Only admins calibrate, so only an admin session opens the calibration screen. The event reaches every connected dashboard, and officers ignore it. An admin who was offline when the frame arrived sees the camera in `AWAITING_CALIBRATION` on the next load, through the camera list badge and the `calibration_status` filter.

---

### 4.4 Evidence (worker-generated, immutable)

The worker never sends media bytes through Rails. It requests presigned upload URLs, uploads files directly to object storage, then registers the verified object metadata inside `POST /violations`. The frontend receives a temporary `media_url` for display; it is not a download workflow.

#### `POST /evidence/presign` (Worker)

```json
{
  "camera_id": "6f0e8c1a-...",
  "violation_id": "b1d1c7c0-...",
  "items": [
    { "evidence_role": "FULL_FRAME", "media_type": "IMAGE", "content_type": "image/jpeg", "file_size_byte": 412330 },
    { "evidence_role": "PLATE_CROP", "media_type": "IMAGE", "content_type": "image/jpeg", "file_size_byte": 18221 },
    { "evidence_role": "CLIP", "media_type": "VIDEO", "content_type": "video/mp4", "file_size_byte": 3820111 }
  ]
}
```

`200`:

```json
{
  "items": [
    {
      "evidence_role": "FULL_FRAME",
      "storage_provider": "MINIO",
      "storage_key": "violations/6f0e8c1a-.../2026/10/b1d1c7c0-.../full_frame.jpg",
      "method": "PUT",
      "upload_url": "http://192.168.1.100:9000/...signed...",
      "headers": { "Content-Type": "image/jpeg" },
      "expires_at": "2026-10-04T08:20:00.000Z"
    }
  ]
}
```

Rules:
- `evidence_role` is one of `FULL_FRAME`, `PLATE_CROP`, `CLIP`. Each role appears at most once per violation.
- `media_type` is `IMAGE` for `FULL_FRAME` and `PLATE_CROP`, and `VIDEO` for `CLIP`.
- Size limits: images up to 5 MB, clips up to 50 MB.
- The same `violation_id` can be presigned again, and the backend returns the same keys. This keeps outbox retries safe.

#### `GET /violations/{id}/evidence` and `GET /evidence/{id}` (User)

```json
{
  "id": "uuid",
  "violation_id": "uuid",
  "media_type": "IMAGE",
  "evidence_role": "FULL_FRAME",
  "storage_provider": "MINIO",
  "file_size_byte": 412330,
  "duration_seconds": null,
  "checksum_sha256": "9b74c9897bac770ffc029102a200c5de...",
  "media_url": "http://192.168.1.100:9000/...signed...",
  "expires_at": "2026-10-04T08:20:00.000Z",
  "created_at": "2026-10-04T08:14:03.000Z"
}
```

`storage_key` is internal and is not returned to the frontend. `media_url` is a short-lived signed URL used by image and video elements for display. The frontend must refetch the evidence representation after `expires_at`. No `PUT`, `PATCH` or `DELETE` exists for evidence.

---

### 4.5 Violations

#### `POST /violations` (Worker)

The worker supplies the violation `id`. It derives the id deterministically (UUIDv5) from `camera_id`, loop or session identifier, `track_id` and violation type, so a retry or a replayed video loop reproduces the same id (see Section 9, item 2).

```json
{
  "id": "b1d1c7c0-...",
  "camera_id": "6f0e8c1a-...",
  "violation_type_code": "RED_LIGHT",
  "session_id": "0c52f7b2-...",
  "track_id": 87,
  "detected_plate_raw": "बा १ च ४५६७",
  "plate_confidence": 0.842,
  "detection_confidence": 0.931,
  "occurred_at": "2026-10-04T08:14:02.311Z",
  "signal_state": "RED",
  "metadata": {
    "vehicle_class": "motorcycle",
    "bbox": { "x1": 640, "y1": 420, "x2": 780, "y2": 610 },
    "frame_number": 18342,
    "video_timestamp_s": 611.4,
    "loop_iteration": 4,
    "stop_line_snapshot": { "p1": { "x": 212, "y": 640 }, "p2": { "x": 1040, "y": 655 }, "approach_side": "below" },
    "red_started_at": "2026-10-04T08:14:00.000Z",
    "model_versions": { "vehicle": "v1", "plate": "v1", "ocr": "easyocr-x" },
    "rule_version": "rules-3",
    "config_version": 3
  },
  "evidence": [
    {
      "evidence_role": "FULL_FRAME",
      "media_type": "IMAGE",
      "storage_provider": "MINIO",
      "storage_key": "violations/6f0e8c1a-.../2026/10/b1d1c7c0-.../full_frame.jpg",
      "file_size_byte": 412330,
      "duration_seconds": null,
      "checksum_sha256": "9b74c9897bac770ffc029102a200c5de..."
    }
  ]
}
```

`detected_plate_raw`, `plate_confidence`, `track_id` and `session_id` are nullable. `signal_state` is null for signal-independent types such as `NO_HELMET`. `violation_type_code` must match a seeded `violation_types.code`.

Backend behavior, in a single transaction:

1. Validate the payload, the camera (must be `ACTIVE`) and the type code.
2. Require at least one evidence item. Confirm each referenced object exists in storage and its size matches.
3. Normalize `detected_plate_raw`. Look up an existing `vehicles.plate_number`. **If found, set `vehicle_id`. If not found, leave `vehicle_id` null.** The worker path never creates a vehicle.
4. Insert the `violations` row with `status = PENDING`.
5. Insert the `evidence` rows.
6. Insert an audit row with `action = CREATED` and `officer_id = null`.
7. After commit, broadcast `violation.created`.

| Outcome | Status |
|---|---|
| First submission | `201` with the violation detail object |
| Same `id` resubmitted (retry) | `200` with the stored violation, no changes made |
| Different `id` but same `(camera_id, session_id, track_id, violation_type)` | `409 DUPLICATE_TRACK_EVENT` |
| No evidence items | `422 EVIDENCE_REQUIRED` |
| Storage object missing or size mismatch | `422 EVIDENCE_OBJECT_MISSING` |
| Camera not `ACTIVE` | `409 CAMERA_INACTIVE` |

The worker keeps failed submissions in its local outbox and retries with the same `id`. The worker treats a `409 DUPLICATE_TRACK_EVENT` as delivered and drops the outbox entry.

#### `GET /violations` (User)

| Filter | Meaning |
|---|---|
| `status` | `PENDING`, `CONFIRMED`, `REJECTED` (comma-separated allowed) |
| `camera_id` | Single camera |
| `violation_type` | Type `code` |
| `vehicle_id` | Linked vehicle |
| `plate` | Case-insensitive partial match on normalized `plate_number` or `detected_plate_raw` |
| `has_vehicle` | `true` or `false` |
| `vehicle_proposal` | `PENDING_ADMIN` returns the admin verification queue |
| `reviewed_by` | Officer id |
| `from`, `to` | `occurred_at` range |
| `max_plate_confidence` | Surfaces low-confidence reads for review |
| `include` | `thumbnail` adds a short-lived `FULL_FRAME` URL to each item |
| `sort` | `-occurred_at` (default, newest first) or `occurred_at` (oldest first) |

List item:

```json
{
  "id": "uuid",
  "camera": { "id": "uuid", "name": "Maitighar Junction North" },
  "violation_type": { "code": "RED_LIGHT", "name": "Red Light Jumping" },
  "occurred_at": "2026-10-04T08:14:02.311Z",
  "status": "PENDING",
  "detected_plate_raw": "बा १ च ४५६७",
  "plate_confidence": 0.842,
  "vehicle": { "id": "uuid", "plate_number": "..." },
  "vehicle_proposal_status": null,
  "thumbnail_url": null
}
```

#### `GET /violations/{id}` (User)

Returns the list fields plus:

```json
{
  "track_id": 87,
  "session_id": "uuid",
  "detection_confidence": 0.931,
  "signal_state": "RED",
  "violation_type": { "code": "RED_LIGHT", "name": "...", "fine_amount_npr": "1000.00" },
  "vehicle": {
    "id": "uuid",
    "plate_number": "...",
    "province_code": "...",
    "vehicle_category": "...",
    "vehicle_type": "..."
  },
  "review": { "reviewed_by": { "id": "uuid", "name": "Ram Thapa" }, "reviewed_at": "..." },
  "vehicle_proposal": null,
  "metadata": { },
  "evidence": [ { "...": "same shape as Section 4.4" } ],
  "created_at": "2026-10-04T08:14:03.000Z"
}
```

Pass `?include=owner` to add `vehicle.owner`. `review` is `null` while the violation is pending.

#### Review actions (User)

Each action runs in one transaction: it updates the violation, then inserts exactly one audit row. All return `200 { "violation": {...}, "audit_entry": {...} }`.

| Endpoint | Body | Allowed from | Result | Audit `action` |
|---|---|---|---|---|
| `POST /violations/{id}/confirm` | `{ "notes": "optional" }` | `PENDING` | `CONFIRMED`, sets `reviewed_by` and `reviewed_at` | `CONFIRMED` |
| `POST /violations/{id}/reject` | `{ "notes": "required" }` | `PENDING` | `REJECTED`, sets `reviewed_by` and `reviewed_at` | `REJECTED` |
| `POST /violations/{id}/reopen` | `{ "notes": "required" }` | `CONFIRMED`, `REJECTED` | `PENDING`, clears `reviewed_by` and `reviewed_at` together | `REOPENED` |
| `POST /violations/{id}/notes` | `{ "notes": "required" }` | any | No violation change | `NOTE_ADDED` |

Any other transition returns `409 INVALID_STATE_TRANSITION`. Missing required notes return `422`. The previous reviewer stays visible in the audit trail after a reopen.

---

### 4.6 Vehicle linking and new-plate verification

Vehicles come from seeds. A new vehicle enters the registry only when an officer finds a plate that is not in the registry and an admin verifies it.

#### `POST /violations/{id}/vehicle` (User)

```json
{ "plate_number": "BA 1 CHA 4567", "create_if_missing": false }
```

The backend normalizes the plate, then:

| Case | Behavior | Response | Audit `action` |
|---|---|---|---|
| Plate exists in `vehicles` | Sets `violations.vehicle_id` (replaces any earlier link) | `200` violation detail | `VEHICLE_LINKED` |
| Plate unknown, caller is an officer | Stores a proposal in `violations.metadata.vehicle_proposal`. No vehicle is created. | `202` with the proposal | `VEHICLE_PROPOSED` |
| Plate unknown, caller is an admin with `create_if_missing: true` | Creates the vehicle, then links it | `201` violation detail | `VEHICLE_LINKED` |
| Plate unknown, caller is an admin without the flag | Same as officer | `202` | `VEHICLE_PROPOSED` |

Proposal object:

```json
{
  "plate_number": "BA 1 CHA 4567",
  "proposed_by": "officer-uuid",
  "proposed_at": "2026-10-04T08:30:00.000Z",
  "status": "PENDING_ADMIN"
}
```

Rules:
- Officers can link or propose only while the violation is `PENDING`. Correcting a confirmed or rejected violation requires a reopen first.
- A second proposal on a violation that already has a `PENDING_ADMIN` proposal replaces it, and the audit trail keeps both.
- The backend derives `province_code`, `vehicle_category` and `vehicle_type` of a new vehicle from the plate classifier. Each is null when parsing fails. `owner_id` is null.

#### `POST /violations/{id}/vehicle-proposal/approve` (Admin)

No body. The backend creates the vehicle (or reuses it when the plate was added in the meantime), sets `vehicle_id`, marks the proposal `APPROVED`, and writes audit `VEHICLE_LINKED`. It works regardless of violation status, so an admin can approve after the officer has confirmed. Returns `200` with the violation detail. Errors: `409 NO_PENDING_PROPOSAL`.

#### `POST /violations/{id}/vehicle-proposal/reject` (Admin)

Body: `{ "notes": "required" }`. Marks the proposal `REJECTED` and leaves `vehicle_id` null. Writes audit `VEHICLE_PROPOSAL_REJECTED`. Returns `200`.

---

### 4.7 Violation audit log (read-only)

The backend writes audit rows inside the same transaction as the violation change. Each row is written once and never updated or deleted. No write endpoint exists. The database role used by the application should have `UPDATE` and `DELETE` revoked on this table (ER documentation, Section 8).

`action` values: `CREATED`, `CONFIRMED`, `REJECTED`, `REOPENED`, `VEHICLE_LINKED`, `VEHICLE_PROPOSED`, `VEHICLE_PROPOSAL_REJECTED`, `NOTE_ADDED`.

**`GET /violations/{id}/audit-log`** (User) returns entries in ascending `created_at` order:

```json
{
  "data": [
    { "id": 101, "violation_id": "uuid", "action": "CREATED", "officer": null, "notes": null, "created_at": "..." },
    { "id": 140, "violation_id": "uuid", "action": "CONFIRMED", "officer": { "id": "uuid", "name": "Ram Thapa" }, "notes": "Plate verified from crop.", "created_at": "..." }
  ]
}
```

`officer` is `null` for system actions.

**`GET /audit-log`** (Admin) is the global feed. Filters: `officer_id`, `action`, `violation_id`, `from`, `to`. Cursor pagination.

---

### 4.8 Officers (admin-managed)

**`POST /officers`** (Admin)

```json
{ "name": "Sita Sharma", "badge_number": "NP-2210", "role": "OFFICER", "email": "sita@example.com", "password": "initial-password" }
```

`201` returns the officer without `password_hash`. `role` is `ADMIN` or `OFFICER`. Errors: `422` for a duplicate `badge_number` or `email`.

**`GET /officers`** (Admin) returns a paginated list, filterable by `role`. **`GET /officers/{id}`** is allowed for an admin or for the officer's own id.

**`PATCH /officers/{id}`** (Admin) updates `name`, `badge_number`, `role`, `email`, and optionally `password` for an admin-initiated reset. Errors: `409 LAST_ADMIN` when the change would leave the system without an admin.

**`DELETE /officers/{id}`** (Admin) returns `204` only when the officer has no reviewed violations and no audit entries. Otherwise it returns `409 OFFICER_IN_USE`. Section 9 recommends an `is_active` flag so officers who have left can be disabled without deletion.

---

### 4.9 Read-only reference data (seeded)

| Endpoint | Notes |
|---|---|
| `GET /violation-types` | Returns `code`, `name`, `description`, `fine_amount_npr`. Seeded: `RED_LIGHT`, `STOP_LINE`, `NO_HELMET`. |
| `GET /vehicles` | Filters: `plate` (partial), `vehicle_category`, `vehicle_type`, `province_code`. Paginated. |
| `GET /vehicles/{id}` | Add `?include=owner` for owner details. |
| `GET /vehicles/{id}/violations` | Filter by `status`. Replaces the removed `Total_Violation` counter. Add `?count_only=true` for `{ "count": n }`. |
| `GET /owners/{id}` | Contains personal data (`name`, `email`, `phone_number`, `license_number`). Available to authenticated officers and admins only. |

---

## 5. Realtime (Action Cable)

**Endpoint:** `ws://192.168.1.100:3000/cable`

| Client | Connection parameters |
|---|---|
| Dashboard | `?token=<jwt>` |
| Worker | `?worker_key=<WORKER_API_KEY>&camera_id=<uuid>` |

| Channel | Subscribers | Params | Messages |
|---|---|---|---|
| `ViolationsChannel` | Users | none | `violation.created`, `violation.updated` |
| `CamerasChannel` | Users | none | `camera.worker_status`, `camera.config_updated`, `camera.reference_frame_ready` |
| `SignalChannel` (stream `camera_signal_{camera_id}`) | Users, and that camera's worker | `camera_id` | `signal.changed` |

Message payloads:

```json
// violation.created: the list-item shape from Section 4.5
{ "type": "violation.created", "data": { "id": "uuid", "camera": {}, "violation_type": {}, "occurred_at": "...", "status": "PENDING", "detected_plate_raw": "...", "plate_confidence": 0.84, "vehicle": null, "vehicle_proposal_status": null } }

// violation.updated
{ "type": "violation.updated", "data": { "id": "uuid", "status": "CONFIRMED", "vehicle_id": "uuid-or-null", "vehicle_proposal_status": null, "reviewed_by": "uuid", "reviewed_at": "...", "audit_entry_id": 140 } }

// camera.worker_status
{ "type": "camera.worker_status", "data": { "camera_id": "uuid", "status": "RUNNING", "online": true, "last_heartbeat": "..." } }

// camera.config_updated
{ "type": "camera.config_updated", "data": { "camera_id": "uuid", "config_version": 4 } }

// camera.reference_frame_ready
{ "type": "camera.reference_frame_ready", "data": { "camera_id": "uuid", "calibration_status": "AWAITING_CALIBRATION", "frame_width": 1280, "frame_height": 720, "captured_at": "..." } }

// signal.changed
{ "type": "signal.changed", "data": { "camera_id": "uuid", "state": "GREEN", "updated_at": "..." } }
```

Delivery is best-effort. A client that was disconnected must reconcile through REST (Section 7, rule 12).

Timing targets from the defense plan: a new violation reaches the dashboard in under 1 second, and a signal change reaches the worker in under 200 ms.

---

## 6. Worker Lifecycle

```
boot
 ├─ GET  /cameras/{id}/config                  (idle if status != ACTIVE)
 ├─ POST /cameras/{id}/heartbeat   STARTING
 ├─ wait for a stable frame, then POST /cameras/{id}/reference-frame (retry with backoff)
 ├─ GET  /cameras/{id}/signal  +  subscribe SignalChannel
 ├─ start detection, publish annotated stream to output_stream_key
 └─ POST /cameras/{id}/heartbeat   RUNNING

steady state
 ├─ every 5 s: POST heartbeat → if config_version changed, GET /config
 │                              → if reference_frame_requested, upload a new frame
 ├─ on violation:
 │    POST /evidence/presign → PUT files to upload_url → POST /violations
 │    on any failure: keep in outbox, retry with the same violation id
 └─ on signal.changed: update local signal provider

shutdown
 └─ POST heartbeat STOPPED
```

---

## 7. Frontend Requirements

### 7.1 JWT handling and flow

The frontend treats the JWT as an opaque bearer credential. It reads the officer's identity and role from the login and `/auth/me` responses, and it uses `expires_at` from the login response for timing. It never decodes the token to make authorization decisions.

**Storage.** Keep the token and `expires_at` in an auth context (React state) and mirror them in `sessionStorage` so a page refresh keeps the session. `sessionStorage` is per tab, so each tab signs in separately and a closed tab loses the session. Do not use cookies in v1, and do not write the token to logs (limitation L7).

**Login and session flow**

```
 Operator            Frontend                         Backend (Devise)
    |                   |                                   |
    |-- email, pw ----->|                                   |
    |                   |-- POST /auth/login -------------->|
    |                   |                                   |-- match email + password in DB
    |                   |<-- 200 access_token, expires_at, officer
    |                   |  store token + expires_at + officer
    |                   |  connect Action Cable (?token=)   |
    |                   |  schedule expiry timer            |
    |                   |                                   |
    |   (any API call)  |-- Authorization: Bearer <token> ->|
    |                   |                                   |-- verify signature + exp
    |                   |                                   |-- load officer by sub from DB
    |                   |<-- 200 data  |  401 UNAUTHENTICATED
    |                   |                                   |
    |   (page refresh)  |  read sessionStorage              |
    |                   |  missing or past expires_at ----> go to login
    |                   |  otherwise -- GET /auth/me ------>|
    |                   |<-- 200 officer  |  401 -> clear + go to login
    |                   |                                   |
    |   (expiry or 401) |  clear token, close cable,        |
    |                   |  remember current route,          |
    |                   |  go to login, return after login  |
    |                   |                                   |
    |   (logout click)  |  clear token + cached data,       |
    |                   |  close cable, go to login         |
```

**Steps in order**

1. **Login.** Submit `POST /auth/login`. On `200`, store `access_token`, `expires_at` and `officer`, open the Action Cable connection with the token, and route to the review queue. On `401 INVALID_CREDENTIALS`, show an inline "email or password incorrect" message and keep the form.
2. **Attach the token.** One shared HTTP client adds `Authorization: Bearer <token>` to every request. No component builds its own headers.
3. **Restore on load.** On app start, read `sessionStorage`. If the token is absent or `expires_at` has passed, go to login. Otherwise call `GET /auth/me`. A `200` restores the session and refreshes the stored `officer` (the role can change on the server). A `401` clears the session.
4. **Handle `401` globally.** The shared HTTP client intercepts any `401` from a user endpoint, clears the session, closes the cable, stores the current route, redirects to login, and returns to the stored route after a successful login. A failed login request is excluded from this interceptor.
5. **Handle `403` locally.** A `403 FORBIDDEN` leaves the session intact. Show "not permitted" and, if the screen was reachable, hide the control that caused it.
6. **Expiry.** Run a timer against `expires_at`. Five minutes before expiry, show a banner asking the operator to finish and save work. At expiry, run the same path as a `401`. There is no silent renewal in v1 (limitation L1).
7. **Action Cable.** Connect with `?token=<jwt>`. If the server rejects the connection, treat it as a `401`. After a re-login, open a new connection with the new token. Drop the old one first.
8. **Logout.** Clear the token, `officer`, and any cached lists or owner data, close the cable, then route to login. No API call is made (limitation L2).
9. **Role-aware UI.** Drive admin-only screens and controls from `officer.role` in the auth context. The backend authorizes every call regardless.

### 7.2 Requirements checklist

The frontend must implement every item below. Items marked **MUST** protect evidence integrity, security, or the correctness of what the operator sees. The backend enforces the same rules where it can, and the frontend still has to behave correctly so the operator sees accurate state.

| # | Requirement | Why it matters |
|---|---|---|
| 1 | **MUST show only the annotated stream.** Use `playback.webrtc_url` (or `hls_url`) from the camera object. Never request, construct, or display a raw stream address. | The architecture requires that the frontend never receives raw CCTV video. |
| 2 | **MUST convert every timestamp** from UTC to Nepal Time (UTC+05:45) for display, and send UTC to the API. | Evidence timestamps carry legal weight, and a wrong offset misleads reviewers. |
| 3 | **MUST draw calibration in the reference frame's native pixel coordinates.** Read `frame_width` and `frame_height` from `GET /cameras/{id}/reference-frame`. Scale mouse positions from the displayed (CSS) size back to native pixels before saving. | A stop line drawn in screen coordinates shifts the detection line and produces wrong violations. |
| 4 | **MUST require explicit operator confirmation** before `PUT /cameras/{id}/config`: show the drawn line over the reference frame, then send `confirmed: true` only after the operator confirms. Include `approach_side` and `expected_config_version`. | Human confirmation of the line is the intended design for evidence that authorities rely on. |
| 5 | Validate before saving: `p1 != p2`, both points inside the frame, `approach_side` chosen. On `409 CONFIG_VERSION_CONFLICT`, reload the config and ask the operator to redo the confirmation. Do not overwrite silently. | Prevents two admins from overwriting each other. |
| 6 | Handle `404`/`409 REFERENCE_FRAME_NOT_READY` by telling the operator the camera's worker must be running first, and offer a retry. | Calibration depends on the worker's first upload. |
| 7 | **Signal control:** show the current state from the camera object, update it from `signal.changed`, and send `PUT /cameras/{id}/signal` on toggle. After a toggle, treat the server broadcast as the truth: if an optimistic update disagrees with the broadcast, the broadcast wins. | The light is simulated, and operators must see the state the worker is actually using. |
| 8 | **Evidence URLs expire.** Fetch evidence when the detail view opens, read `expires_at`, and refetch the evidence list when a URL has expired or an image or clip fails to load. Never store signed URLs persistently. | Signed URLs control access to evidence. |
| 9 | **Review actions:** require notes for reject and reopen. After any action, replace local state with the returned `violation` and `audit_entry`. On `409 INVALID_STATE_TRANSITION`, reload the violation and tell the operator someone else already changed it. | Two officers can open the same violation. |
| 10 | **Plate handling:** show `detected_plate_raw`, `plate_confidence`, and the linked `vehicle.plate_number` separately. Flag reads below a configurable confidence threshold (default 0.7) and let the operator correct the plate through the vehicle endpoint. Show a "no vehicle linked" state when `vehicle` is null. Send the plate as typed. The backend normalizes it. | Unreadable or unmatched plates still produce reviewable violations. |
| 11 | **New-plate flow:** when `POST /violations/{id}/vehicle` returns `202`, show the violation as "vehicle pending admin verification". Admins get a verification queue (`GET /violations?vehicle_proposal=PENDING_ADMIN`) with approve and reject (notes required on reject). Hide approve, reject and `create_if_missing` from non-admins. | Vehicles join the registry only after admin verification. |
| 12 | **Realtime reconciliation:** subscribe to the channels in Section 5 with automatic reconnect and backoff. On every (re)connect, refetch the active violation list and the visible camera objects. Deduplicate incoming messages by `id`. Never treat the socket as the source of truth. | Action Cable delivery is best-effort. |
| 13 | **Audit trail is read-only.** Render `GET /violations/{id}/audit-log` as a timeline with no edit or delete controls. | The log is insert-once. |
| 14 | **No delete controls** for violations, evidence, cameras or audit entries. Deactivate cameras through `status = INACTIVE`. Show the officer delete action only with the `OFFICER_IN_USE` handling in place. | These resources are never hard-deleted. |
| 15 | **Worker status:** render `worker.online` and `worker.status` from the API, and display `online = false` as offline even when `status` says `RUNNING`. Update from `camera.worker_status`. | A crashed worker leaves a stale `RUNNING` status until the stale-heartbeat job runs. |
| 16 | **Session handling follows Section 7.1:** one shared HTTP client attaches the token, a global `401` handler clears the session and redirects to login, the token is never decoded for authorization or written to logs, and admin-only screens are hidden from officers. The UI gating is a convenience. The backend authorizes every call. | Defense in depth, and consistent behavior across screens. |
| 17 | **Camera creation:** after `POST /cameras`, display the new camera `id` with a copy button, labeled as the `CAMERA_ID` for the worker container, and show a "waiting for worker" state (`calibration.status = AWAITING_WORKER`). If no `camera.reference_frame_ready` event arrives within 60 seconds, show a hint to check that the worker container is running with that `CAMERA_ID`. | The operator needs the id to start the worker (deployment plan, Section 4). |
| 18 | **Owner personal data:** fetch owner details only when an officer opens a vehicle or violation that needs them. Never include owner fields in exports, logs, screenshots prepared for the demo, or analytics. | The `owners` table holds personal data. |
| 19 | **Error handling:** parse the error envelope, show `message` to the operator, map `details[].field` to form fields on `422`, and log `request_id` for debugging. | Consistent behavior across screens. |
| 20 | **Lists:** use cursor pagination (`next_cursor`), preserve filters across pages, and default the review queue to `status=PENDING` sorted newest first. | Matches the review-queue index. |
| 21 | **MUST prompt the admin to calibrate a new camera** (Section 4.3.1). When an admin session receives `camera.reference_frame_ready` and the camera is `AWAITING_CALIBRATION`, open the calibration screen automatically (or show a blocking prompt with an "Open calibration" action), fetch the frame through `GET /cameras/{id}/reference-frame`, and let the admin draw the stop line. After a restart or reconnect, find uncalibrated cameras through `GET /cameras?calibration_status=AWAITING_CALIBRATION` and show a badge on each one. Auto-open only for `AWAITING_CALIBRATION` or for a refresh the same admin requested. Show a "Recalibrate" action on `CALIBRATED` cameras that calls `POST /cameras/{id}/reference-frame/refresh`. Mark uncalibrated cameras clearly in the camera list, and state that stop-line and red-light detection stay off until calibration is saved. Hide the prompt from officers. | A camera without a stop line detects nothing for its signal rules, so the dashboard has to drive calibration. |

---

## 8. Test Scenarios Mapped to the Contract

| Defense test (deployment plan) | Endpoints and channels exercised |
|---|---|
| 2. Red-light violation | `POST /evidence/presign`, `POST /violations`, `ViolationsChannel` `violation.created`, `GET /violations/{id}` |
| 3. Live traffic control | `PUT /cameras/{id}/signal`, `SignalChannel` `signal.changed` |
| 4. Edge fault isolation | `POST /cameras/{id}/heartbeat` stops, `camera.worker_status` shows offline for that camera only |
| 5. Store-and-forward | `POST /violations` retried with the same `id`, returns `201` the first time and `200` or `409 DUPLICATE_TRACK_EVENT` for repeats |
| Onboarding a camera | `POST /cameras` (status `AWAITING_WORKER`), `GET /cameras/{id}/config`, `POST /cameras/{id}/reference-frame`, `CamerasChannel` `camera.reference_frame_ready` (status `AWAITING_CALIBRATION`), `GET /cameras/{id}/reference-frame`, `PUT /cameras/{id}/config` (status `CALIBRATED`), `camera.config_updated`, heartbeat returns the new `config_version` |

---

## 9. Assumptions, Source Conflicts and Schema Changes

### 9.1 Conflicts between the source documents and how this contract resolves them

| # | Conflict | Resolution in this contract |
|---|---|---|
| 1 | ER Section 6.1 has the backend upsert a `Vehicles` row on every violation. Your ownership rule says vehicles come only from seeds. | The backend only matches existing vehicles. New vehicles come from the admin-verified proposal flow (Section 4.6). **Update ER Section 6.1 and the "Vehicles" rationale to match.** |
| 2 | The architecture uses a deterministic `event_id` with `UNIQUE (event_id, occurred_at)`. The ER uses a worker-generated `Violation.Id` plus a `(Camera_Id, Session_Id, Track_Id, Violation_Type_Id)` dedup index. | The worker derives `Violation.Id` as a UUIDv5 of camera, loop or session, track and type. One value serves as both `event_id` and primary key. The dedup index stays as a second guard. |
| 3 | The architecture says the violations table is range-partitioned by month. The ER defers partitioning for the MVP. | The contract follows the ER (no partitioning). |
| 4 | The architecture defines `/workers/{id}/heartbeat`. The ER has no workers table, and your rule says the backend adds the worker automatically. | Worker identity equals camera identity. The heartbeat is `POST /cameras/{id}/heartbeat`. |
| 5 | The architecture says "WebSocket". The deployment plan uses Rails 7 Action Cable and a channel named `camera_signal_cam_04`. | Section 5 defines Action Cable channels. `signal_state_key` holds the signal stream name. |
| 6 | The deployment plan uses ids like `cam_01`. The ER uses UUID primary keys. | The contract uses UUIDs everywhere. Set `CAMERA_ID` to the camera UUID in the `docker run` commands. If you prefer readable ids, add a unique `Code` column to `Cameras` and accept it in paths. |
| 7 | ER Section 4.1 does not list `Signal_State` and `Signal_Updated_At`, but Sections 6.4 and 10.1 say they exist. | The contract assumes both columns exist on `Cameras`. **Add them to the Section 4.1 table.** |
| 8 | The architecture requires versioned configuration. The ER has no version column. | See schema change A below. |

### 9.2 Schema changes this contract needs

| ID | Change | Reason |
|---|---|---|
| A | Add `Config_Version INTEGER NOT NULL DEFAULT 1` to `Cameras` | Workers detect new calibration, status and stream changes through the heartbeat response. |
| B | Add `Signal_State` (`RED`, `YELLOW`, `GREEN`) and `Signal_Updated_At` to `Cameras` (see conflict 7) | Persist the state the toggle sets. |
| C | Store `Signal_State_Key` as `camera_signal_{camera_id}` | Defines the Action Cable stream name. |
| D | Recommended: add `Is_Active BOOLEAN NOT NULL DEFAULT true` to `Officers` | Lets an admin disable departed officers while keeping their audit history. |
| F | Map Devise's `encrypted_password` to the ER column `Password_Hash` (for example `alias_attribute` or a column rename). Add no other Devise columns. | Devise expects its own column name. The modules in use need only email and the password hash. |
| E | No schema change: `Violation_Audit_Log.Action` gains `VEHICLE_PROPOSED` and `VEHICLE_PROPOSAL_REJECTED`, and `Violation.Metadata` holds `vehicle_proposal`. | The column has no `CHECK`, so only the documentation changes. |

### 9.3 Open questions

1. **Plate script.** Normalized plates in Devanagari or Latin transliteration? OCR output, the unique index on `plate_number`, the `plate` search filter and the seeds must all use the same form. The contract carries `plate_number` as an opaque normalized string until this is settled.
2. **Backend launching workers.** The contract registers the worker record automatically on camera creation. It does not specify whether the backend also starts the container. The deployment plan starts containers by hand with `docker run`. Decide which applies and document it in the deployment plan.
3. **Signal override versus scripted timeline.** The architecture describes a scripted phase timeline, and the frontend toggle can override it. Define whether an override holds until the next toggle or until the next scripted phase.
4. **`approach_side` values.** The contract allows `above`, `below`, `left`, `right`. Drop the field if the rule engine derives direction from tracked motion.
5. **Global rule parameters.** The architecture describes a backend store of rule parameters with versions, but the ER has no table for it. This contract carries only `red_grace_seconds` per camera and reports `rule_version` in heartbeats and violation metadata.

---

## Appendix A: Error Codes

| HTTP | Code | Used when |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Missing, invalid or expired token or worker key |
| 401 | `INVALID_CREDENTIALS` | Login failed |
| 403 | `FORBIDDEN` | Role lacks permission |
| 404 | `NOT_FOUND` | Unknown resource |
| 404 | `REFERENCE_FRAME_NOT_READY` | No reference frame uploaded yet |
| 405 | `READ_ONLY_RESOURCE` | Write attempted on seeded or immutable resources |
| 409 | `INVALID_STATE_TRANSITION` | Review action not allowed from the current status |
| 409 | `CONFIG_VERSION_CONFLICT` | Stale `expected_config_version` |
| 409 | `DUPLICATE_TRACK_EVENT` | Same track, type and session already recorded under another id |
| 409 | `CAMERA_INACTIVE` | Worker submitted to a non-`ACTIVE` camera |
| 409 | `NO_PENDING_PROPOSAL` | Approve or reject with no pending vehicle proposal |
| 409 | `LAST_ADMIN` | Change would remove the final admin |
| 409 | `OFFICER_IN_USE` | Officer referenced by reviews or audit entries |
| 422 | `VALIDATION_FAILED` | Body or parameter validation failed |
| 422 | `EVIDENCE_REQUIRED` | Violation submitted without evidence |
| 422 | `EVIDENCE_OBJECT_MISSING` | Referenced storage object absent or size mismatch |
| 422 | `FRAME_SIZE_MISMATCH` | Calibration `frame_width` or `frame_height` differs from the stored reference frame |
| 409 | `REFERENCE_FRAME_NOT_READY` | `PUT /cameras/{id}/config` before any reference frame exists |
| 409 | `WORKER_OFFLINE` | Reference-frame refresh requested while the worker is offline |
