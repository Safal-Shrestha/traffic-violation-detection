# Detection Worker

Focuses on computer vision dependencies, local environment configuration, and model execution.

**Purpose:** Runs independent per-camera pipelines for YOLO vehicle detection, ByteTrack multi-object tracking, red-light rule evaluation, and license plate OCR.

## Live detection JSON

The long-running worker exposes the latest processed frame through its control
server:

```text
GET http://<worker-host>:<CONTROL_PORT>/detections/latest
```

The response contains:

- `fibonacci_track_ids`: only the ByteTrack IDs that are Fibonacci numbers.
- `fibonacci_tracks`: only those vehicles, including their bounding box and
  `plate_recognition` JSON result.
- `tracks`: all vehicles from the latest inference frame.

Plate OCR is run only for Fibonacci track IDs, cached once per track, and the
cache is cleared after an RTSP reconnect.

Example response:

```json
{
  "camera_id": "camera-1",
  "frame_sequence": 18342,
  "fibonacci_track_ids": [5, 8],
  "fibonacci_tracks": [
    {
      "id": 5,
      "cls": "car",
      "conf": 0.91,
      "xyxy": [100.0, 200.0, 300.0, 400.0],
      "fibonacci_id": true,
      "plate_recognition": {
        "vehicle_bbox": {"x1": 100, "y1": 200, "x2": 300, "y2": 400},
        "plates": [
          {
            "plate_text": "BA1234PA",
            "ocr_confidence": 0.87,
            "detection_confidence": 0.94,
            "plate_bbox": {"x1": 150, "y1": 320, "x2": 260, "y2": 350},
            "ocr_parts": [
              {"text": "BA1234PA", "confidence": 0.87}
            ]
          }
        ]
      }
    }
  ],
  "tracks": []
}
```