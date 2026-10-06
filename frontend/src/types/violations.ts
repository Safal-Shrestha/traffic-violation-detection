export type ViolationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'

export type EvidenceMediaType = 'IMAGE' | 'VIDEO'

export type EvidenceRole =
  | 'FULL_FRAME'
  | 'PLATE_CROP'
  | 'CLIP'

export type ViolationSignalState =
  | 'RED'
  | 'YELLOW'
  | 'GREEN'

export interface ViolationType {
  code: string
  name: string
  fine_amount_npr?: string
}

export interface ViolationCamera {
  id: string
  name: string
}

export interface ViolationVehicle {
  id: string
  plate_number: string
}

export interface ViolationVehicleDetail
  extends ViolationVehicle {
  province_code: string
  vehicle_category: string
  vehicle_type: string
}

export interface Evidence {
  id: string
  violation_id: string
  media_type: EvidenceMediaType
  evidence_role: EvidenceRole
  storage_provider: string
  file_size_byte: number
  duration_seconds: number | null
  checksum_sha256: string
  download_url: string
  expires_at: string
  created_at: string
}

export interface ViolationReview {
  reviewed_by: {
    id: string
    name: string
  }
  reviewed_at: string
}

export interface ViolationListItem {
  id: string
  camera: ViolationCamera
  violation_type: ViolationType
  occurred_at: string
  status: ViolationStatus
  detected_plate_raw: string | null
  plate_confidence: number | null
  vehicle: ViolationVehicle | null
  vehicle_proposal_status: string | null
  thumbnail_url: string | null
}

export interface ViolationDetail extends ViolationListItem {
  track_id: number | null
  session_id: string | null
  detection_confidence: number | null
  signal_state: ViolationSignalState | null
  vehicle: ViolationVehicleDetail | null
  review: ViolationReview | null
  vehicle_proposal: unknown | null
  metadata: Record<string, unknown>
  evidence: Evidence[]
  created_at: string
}

export interface ViolationsData {
  violations: ViolationListItem[]
}

export interface ConfirmViolationRequest {
  notes?: string
}

export interface RejectViolationRequest {
  notes: string
}

export interface ReopenViolationRequest {
  notes: string
}

export interface AddViolationNoteRequest {
  notes: string
}

export interface AuditEntry {
  [key: string]: unknown
}

export interface ViolationActionResponse {
  violation: ViolationDetail
  audit_entry: AuditEntry
}