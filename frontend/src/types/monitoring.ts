export interface CameraPlayback {
  webrtc_url: string | null
  hls_url: string | null
}

export interface CameraSignal {
  available: boolean
  url: string | null
  last_seen_at: string | null
}

export interface CameraWorker {
  status: string | null
  online: boolean
  last_heartbeat: string | null
  fps: number | null
  image_version: string | null
  model_version: string | null
  rule_version: string | null
}

export interface CameraProvisioning {
  status: string
  source_video: string | null
  error: string | null
}

export interface Camera {
  id: string
  name: string
  district: string
  municipality: string
  status: string | null
  installed_at: string | null
  output_stream_key: string | null
  signal_state_key: string | null

  provisioning: CameraProvisioning
  signal: CameraSignal
  playback: CameraPlayback
  worker: CameraWorker
}

export interface CameraCreateRequest {
  name: string
  district: string
  municipality: string
}