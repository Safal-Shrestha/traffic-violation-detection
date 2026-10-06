export type CameraStatus = 'ACTIVE' | 'INACTIVE'

export type CalibrationStatus =
  | 'AWAITING_WORKER'
  | 'AWAITING_CALIBRATION'
  | 'CALIBRATED'

export type WorkerStatus =
  | 'STARTING'
  | 'RUNNING'
  | 'ERROR'
  | 'STOPPED'

export type SignalState = 'RED' | 'YELLOW' | 'GREEN'

export type ApproachSide =
  | 'above'
  | 'below'
  | 'left'
  | 'right'

export interface CameraPoint {
  x: number
  y: number
}

export interface StopLine {
  p1: CameraPoint
  p2: CameraPoint
  approach_side: ApproachSide
}

export interface CameraPlayback {
  webrtc_url: string
  hls_url: string | null
}

export interface CameraSignal {
  state: SignalState
  updated_at: string
}

export interface CameraCalibration {
  status: CalibrationStatus
  calibrated: boolean
  reference_frame_ready: boolean
  frame_width: number | null
  frame_height: number | null
  red_grace_seconds: number
  config_version: number
}

export interface CameraWorker {
  status: WorkerStatus
  online: boolean
  last_heartbeat: string | null
  fps: number | null
  image_version: string | null
  model_version: string | null
  rule_version: string | null
}

export interface Camera {
  id: string
  name: string
  district: string
  municipality: string
  status: CameraStatus
  installed_at: string
  output_stream_key: string
  signal_state_key: string
  playback: CameraPlayback
  signal: CameraSignal
  calibration: CameraCalibration
  worker: CameraWorker
  created_at: string
}

export interface CamerasData {
  cameras: Camera[]
}

export interface CameraConfig {
  camera_id: string
  config_version: number
  status: CameraStatus
  raw_stream_key?: string
  output_stream_key: string
  signal_state_key: string
  frame_width: number
  frame_height: number
  stop_line: StopLine | null
  red_grace_seconds: number
  signal: CameraSignal
}

export interface UpdateCameraConfigRequest {
  frame_width: number
  frame_height: number
  stop_line: StopLine
  red_grace_seconds: number
  expected_config_version: number
  confirmed: true
}

export interface ReferenceFrameUploadResponse {
  captured_at: string
  frame_width: number
  frame_height: number
}

export interface CameraCreateRequest {
  name: string
  district: string
  municipality: string
  installed_at: string
  raw_stream_key?: string
  status?: CameraStatus
}

export interface CameraUpdateRequest {
  name?: string
  district?: string
  municipality?: string
  installed_at?: string
  status?: CameraStatus
  raw_stream_key?: string
}