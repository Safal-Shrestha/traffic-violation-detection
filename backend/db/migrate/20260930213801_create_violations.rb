
class CreateViolations < ActiveRecord::Migration[8.1]
  def change
    create_table :violations, id: :uuid do |t|
      t.references :camera, type: :uuid, null: false, index: false, foreign_key: { on_delete: :restrict }
      t.references :violation_type, type: :smallint, null: false, foreign_key: { on_delete: :restrict }
      t.references :vehicle, type: :uuid, foreign_key: { on_delete: :restrict }

      t.integer :track_id   # YOLO tracking id; unique only within one worker session
      t.uuid :session_id # one run of the worker; with track_id forms the dedup key

      t.string :detected_plate_raw, limit: 50 # OCR output before normalization
      t.decimal :plate_confidence, precision: 4, scale: 3
      t.decimal :detection_confidence, precision: 4, scale: 3, null: false

      t.timestamptz :occurred_at, null: false
      t.string :signal_state, limit: 10  # snapshot; NULL for signal-independent types

      t.string :status, limit: 20, null: false, default: "PENDING"
      t.references :reviewed_by, type: :uuid, foreign_key: { to_table: :officers, on_delete: :restrict }
      t.timestamptz :reviewed_at

      t.jsonb :metadata, null: false, default: {}
      t.timestamptz :created_at, null: false, default: -> { "now()" }

      # Review queue: pending violations, newest first.
      t.index [:status, :occurred_at], order: { occurred_at: :desc }, name: "idx_violations_status_occurred"
      # Per-camera history.
      t.index [:camera_id, :occurred_at], order: { occurred_at: :desc }, name: "idx_violations_camera_occurred"
      # Deduplication: one violation per tracked vehicle, per type, per worker session.
      t.index [:camera_id, :session_id, :track_id, :violation_type_id],
              unique: true,
              where: "track_id IS NOT NULL AND session_id IS NOT NULL",
              name: "uq_violations_dedup"

      t.check_constraint "plate_confidence BETWEEN 0 AND 1", name: "violations_plate_conf_check"
      t.check_constraint "detection_confidence BETWEEN 0 AND 1", name: "violations_detection_conf_check"
      t.check_constraint "signal_state IN ('RED', 'YELLOW', 'GREEN')", name: "violations_signal_state_check"
      t.check_constraint "status IN ('PENDING', 'CONFIRMED', 'REJECTED')", name: "violations_status_check"
      # A review always records both who and when.
      t.check_constraint "(reviewed_by_id IS NULL) = (reviewed_at IS NULL)", name: "violations_review_consistency"
    end
  end
end
