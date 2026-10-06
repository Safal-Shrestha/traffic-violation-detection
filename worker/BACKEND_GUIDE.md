# ANPR Backend: How It Works

A Flask backend that detects and tracks vehicles in images or videos, then reads their number plates. It combines two YOLO models (vehicle and plate) with EasyOCR.

---

## 1. Project structure

```
anpr_backend/
├── app.py              # the entire backend (server, helpers, endpoints)
├── requirements.txt    # Python dependencies
├── vehicle_best.pt     # YOLO model: detects vehicles   (you provide)
├── plate_best.pt       # YOLO model: detects plates     (you provide)
└── static/
    └── index.html      # test frontend, served at "/"
```

---

## 2. High-level flow

```
              ┌──────────────────────────┐
 image/video →│  POST /vehicle/detect    │→ per-frame boxes, class, confidence,
              │  YOLO + tracker          │  track_id, annotated frame image
              └──────────────────────────┘
                          │  (pick a vehicle: frame + bbox)
                          ▼
              ┌──────────────────────────┐
 image + bbox→│  POST /plate/detect      │→ plate text, OCR confidence,
              │  crop → plate YOLO →     │  plate bbox, plate crop
              │  crop → EasyOCR          │
              └──────────────────────────┘
```

The two endpoints are independent. The client decides which vehicle to read a plate for, and sends the original frame plus that vehicle's bbox.

---

## 3. Dependencies

| Package | Why it's needed |
|---|---|
| **flask** | Web framework. Defines the routes (`/vehicle/detect`, `/plate/detect`, `/health`, `/`), parses uploads, returns JSON. |
| **ultralytics** | Loads and runs the YOLO `.pt` models. Provides `YOLO.predict()` for detection and `YOLO.track()` for detection plus multi-object tracking. Also provides `result.plot()` for drawing boxes on frames. |
| **easyocr** | Pretrained OCR engine. Reads text from the cropped plate image. |
| **torch** | The deep-learning runtime behind both YOLO and EasyOCR. Also used to detect whether a CUDA GPU is available (`torch.cuda.is_available()`). |
| **torchvision** | Required by ultralytics for image ops and NMS. |
| **opencv-python-headless** | Image/video I/O: decoding uploads (`cv2.imdecode`), reading video metadata (`cv2.VideoCapture`), encoding JPEGs (`cv2.imencode`), grayscale, resize and CLAHE preprocessing. The headless build has no GUI dependencies, which suits servers. |
| **numpy** | Array handling for image data and box coordinates. |
| **lapx** | Linear assignment solver used by the ByteTrack and BoT-SORT trackers to match detections to existing tracks across frames. Without it, tracking fails. |
| *(optional)* **gunicorn** | Production WSGI server, for deployments beyond `python app.py`. |

> **GPU note:** for a Linux/NVIDIA worker, install `requirements-gpu.txt` to get the pinned CUDA-enabled PyTorch and torchvision pair. Container deployments also need NVIDIA Container Toolkit and Docker's `--gpus all`; the worker manager controls that with `WORKER_GPU=1`. The CPU Docker build remains the default.

---

## 4. Configuration (top of `app.py`)

| Variable | Default | Meaning |
|---|---|---|
| `VEHICLE_MODEL_PATH` | `vehicle_best.pt` | Path to the vehicle model (env var override). |
| `PLATE_MODEL_PATH` | `plate_best.pt` | Path to the plate model (env var override). |
| `TRACKER_CFG` | `bytetrack.yaml` | Tracker config; can be `botsort.yaml`. |
| `OCR_LANGS` | `en` | Comma-separated EasyOCR languages. |
| `OCR_ALLOWLIST` | `A-Z0-9` | Only these characters can be output by OCR, which removes most noise symbols. |
| `MAX_UPLOAD_MB` | `500` | Max upload size. Larger uploads get a 413 error. |
| `VIDEO_EXTS` | `.mp4 .avi .mov …` | Extensions treated as video. |
| `PORT` | `5000` | Server port. |

### Automatic GPU/CPU switching

```python
USE_GPU = torch.cuda.is_available()
DEVICE  = "cuda:0" if USE_GPU else "cpu"
```

`DEVICE` is passed to every YOLO call (`device=DEVICE`). EasyOCR gets `gpu=USE_GPU`. On GPU, YOLO also runs in half precision (`half=USE_GPU`) for speed. No code changes are needed when moving between machines.

---

## 5. Startup (model loading)

```python
vehicle_model = YOLO(VEHICLE_MODEL_PATH)
plate_model   = YOLO(PLATE_MODEL_PATH)
ocr_reader    = easyocr.Reader(OCR_LANGS, gpu=USE_GPU)
```

All three load once when the server starts, because loading per request would be very slow. EasyOCR may download its detection and recognition weights on first run, so that start needs internet access.

### Locks

```python
vehicle_lock, plate_lock, ocr_lock = threading.Lock(), ...
```

Flask runs requests on multiple threads, but the YOLO tracker keeps per-video state and the models aren't thread-safe. Each lock ensures only one request uses a given model at a time. The trade-off is that requests are processed sequentially per model. For more throughput, run several worker processes (e.g. gunicorn `-w 2`). Each worker loads its own copy of the models, so mind the GPU memory.

---

## 6. Helper functions

### Error handling
- **`ApiError(message, status=400)`**: custom exception. Raised anywhere in the code to produce a clean JSON error.
- **`handle_api_error`**: converts `ApiError` into `{"error": "..."}` with the right HTTP status.
- **`too_large`**: handles HTTP 413 for oversized uploads.

### Image encoding/decoding
- **`encode_jpg_b64(img, quality)`**: BGR numpy image → JPEG → base64 string. Used for returning frames and plate crops in JSON.
- **`decode_image_bytes(data)`**: raw bytes → BGR numpy image. Raises `ApiError` if the data isn't a valid image.

### Request parsing
- **`get_param(name, default)`**: reads a parameter from form-data, the query string, or a JSON body (in that order). This lets clients send parameters any way they like.
- **`to_bool(v, default)`**: turns `"true"`, `"1"`, `"yes"`, `"on"` etc. into booleans.
- **`parse_boxes(raw)`**: normalises many bbox formats into a list of `[x1, y1, x2, y2]`. Accepts `"[x1,y1,x2,y2]"`, `"x1,y1,x2,y2"`, `[[...],[...]]` (multiple boxes), or dicts `{"x1":…,"y1":…,"x2":…,"y2":…}`.
- **`clamp_box(box, w, h)`**: sorts coordinates, rounds to integers, and clips the box to the image bounds. Raises an error if the box is empty or fully outside the image.
- **`load_image_from_request()`**: gets an image from a multipart upload (`image` or `file`) or from JSON `image_base64` (data-URL prefixes are stripped).

---

## 7. Endpoint: `POST /vehicle/detect`

### Input (multipart/form-data)

| Field | Default | Description |
|---|---|---|
| `file` | required | Image or video. |
| `conf` | 0.25 | Minimum detection confidence. |
| `iou` | 0.5 | NMS overlap threshold. |
| `frame_stride` | 1 | Process every Nth video frame (speeds things up). |
| `max_frames` | none | Stop after N processed frames. |
| `include_images` | true | Include the annotated frame as base64 JPEG. |
| `only_tracked` | false | Drop detections that have no track ID (video). |
| `jpg_quality` | 85 | JPEG quality of returned frames. |

### How it decides image vs video
By file extension (`VIDEO_EXTS`) or by a `video/*` MIME type.

### Image path
1. Decode the bytes to an image.
2. Run `vehicle_model.track(img, …)` under `vehicle_lock`.
3. Build one frame payload and return it.

### Video path
1. Save the upload to a temporary file, because OpenCV and ultralytics read videos from disk.
2. Read `fps` and total frames with `cv2.VideoCapture`.
3. Call `vehicle_model.track(source=path, stream=True, vid_stride=stride, persist=False, …)`.
   - `stream=True` yields results frame by frame, so a long video isn't held in memory all at once.
   - `persist=False` creates a fresh tracker for each request, so IDs don't leak between videos.
   - Each detected object gets a **track ID** that stays the same across frames, which is how the same car can be followed through the video.
4. For each result, build a frame payload and collect unique track IDs by class.
5. Delete the temp file in a `finally` block, even if something fails.

### Core functions
- **`extract_detections(result)`**: converts a YOLO result into a list of dicts: `track_id`, `class_id`, `class_name`, `confidence`, `bbox {x1,y1,x2,y2}`. `track_id` is `null` when the tracker hasn't confirmed an ID (e.g. a low-confidence object).
- **`frame_payload(result, frame_index, fps, include_images, jpg_quality)`**: builds the per-frame response: `frame_index`, `timestamp_sec`, `width`, `height`, `detections`, plus `image_base64` (from `result.plot()`, which draws boxes, labels and IDs) when images are enabled. `frame_index` is the real source frame number (`i * stride`).

### Response (video example)
```json
{
  "type": "video", "device": "cuda:0", "fps": 30.0,
  "source_total_frames": 900, "frame_stride": 5, "total_frames": 180,
  "unique_vehicles": 12,
  "unique_vehicles_by_class": {"car": 9, "truck": 2, "bus": 1},
  "frames": [
    {
      "frame_index": 0, "timestamp_sec": 0.0, "width": 1920, "height": 1080,
      "detections": [
        {"track_id": 1, "class_id": 2, "class_name": "car", "confidence": 0.91,
         "bbox": {"x1": 120.5, "y1": 80.2, "x2": 640.0, "y2": 420.7}}
      ],
      "image_base64": "<jpeg>", "image_mime": "image/jpeg"
    }
  ]
}
```

---

## 8. Endpoint: `POST /plate/detect`

### Input

| Field | Default | Description |
|---|---|---|
| `image` (file) or `image_base64` (JSON) | required | The full frame/image. |
| `bbox` | whole image | Vehicle bbox `[x1,y1,x2,y2]`, or a list of boxes, in the coordinates of the supplied image. |
| `conf` | 0.25 | Plate detection threshold. |
| `pad` | 0.05 | Padding ratio added around the plate crop before OCR. |
| `include_images` | false | Return the plate crop as base64. |

### Pipeline (per bbox)
1. `clamp_box` keeps the bbox inside the image, then the vehicle region is cropped.
2. `plate_model.predict()` runs on the **vehicle crop**. Searching a small crop is faster and more accurate than searching the whole frame.
3. Plates are sorted by detection confidence (highest first).
4. Each plate box is padded slightly and cropped.
5. `read_plate_text()` runs OCR on the plate crop.
6. The plate bbox is mapped back to full-image coordinates (by adding the vehicle crop offset) so the client can draw it on the original image.

### OCR functions
- **`preprocess_for_ocr(crop)`**: converts to grayscale, upscales if the crop is under 64 px tall (small plates are the most common cause of OCR errors), then applies CLAHE (local contrast enhancement) to help with glare and shadows.
- **`read_plate_text(plate_crop)`**:
  1. Runs `easyocr.readtext` with `allowlist=A-Z0-9`.
  2. EasyOCR returns text fragments with positions. Fragments are sorted top to bottom and grouped into lines when their vertical centres are close. This handles **two-line plates**.
  3. Within each line, fragments are sorted left to right and joined into one string.
  4. Returns `(text, average_confidence, raw_parts)`.

### Response
```json
{
  "device": "cuda:0",
  "results": [{
    "vehicle_bbox": {"x1": 120, "y1": 80, "x2": 640, "y2": 420},
    "plates": [{
      "plate_text": "MH12AB1234",
      "ocr_confidence": 0.87,
      "detection_confidence": 0.93,
      "plate_bbox": {"x1": 300.1, "y1": 360.4, "x2": 460.9, "y2": 410.2},
      "ocr_parts": [{"text": "MH12AB1234", "confidence": 0.87}]
    }]
  }]
}
```
If no plate is found, `plates` is an empty list.

---

## 9. Other routes and middleware

- **`GET /health`**: returns status, active device, GPU name, model paths and the vehicle model's class names. Useful for checking that the server is up and that the GPU was detected.
- **`GET /`**: serves `static/index.html`, the test UI.
- **`add_cors` (`after_request`)**: adds `Access-Control-Allow-*` headers so a frontend served from another origin or port can call the API. It currently allows **any** origin (`*`). Restrict it to your frontend's domain if you deploy this publicly.

---

## 10. Running it

```bash
pip install -r requirements.txt
python app.py                       # http://localhost:5000

# custom model paths / port
VEHICLE_MODEL_PATH=/models/v.pt PLATE_MODEL_PATH=/models/p.pt PORT=8000 python app.py
```

Quick tests:
```bash
curl http://localhost:5000/health
curl -F "file=@traffic.mp4" -F "frame_stride=5" http://localhost:5000/vehicle/detect
curl -F "image=@frame.jpg" -F "bbox=[120,80,640,420]" http://localhost:5000/plate/detect
```

---

## 11. Limitations and tips

- **Response size:** base64 frames make video responses large. Use `frame_stride`, `max_frames`, or `include_images=false`. Frames are only one part of the response, since every detection and track ID is still returned.
- **Send original frames to `/plate/detect`.** The annotated frame from `/vehicle/detect` has boxes drawn on it, which can hurt OCR accuracy.
- **Sequential processing:** the locks serialise requests per model. Scale with multiple worker processes if you need concurrency.
- **Single-image tracking IDs:** with one frame the tracker has no history, so IDs can be `null` for low-confidence detections.
- **Plate formats:** the OCR allowlist is `A-Z0-9`. Edit `OCR_ALLOWLIST` and `OCR_LANGS` for other character sets or scripts. The code returns raw OCR text and doesn't validate it against a country's plate format. You can add a regex check or a character-confusion fix (e.g. `O`/`0`, `I`/`1`) after `read_plate_text` if you know your plate format.
- **Upload limit:** the 500 MB default is set in `MAX_UPLOAD_MB`.
- **Security for public deployment:** the CORS header allows any origin, there is no authentication, and the built-in Flask server is for development. Put the app behind gunicorn plus a reverse proxy, restrict CORS and add authentication before exposing it to the internet.
