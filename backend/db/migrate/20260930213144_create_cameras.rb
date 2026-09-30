# Cameras: one CCTV feed and its detection worker. Per-camera configuration
class CreateCameras < ActiveRecord::Migration[8.1]
  def change
    create_table :cameras, id: :uuid do |t|
      t.string :name, limit: 100, null: false

      # Stop line in pixels of the frame_width x frame_height calibration frame.
      # Shape: {"p1": {"x": int, "y": int}, "p2": {"x": int, "y": int}, "approach_side": "above"|"below"}
      t.jsonb   :stop_line
      t.integer :frame_width
      t.integer :frame_height

      t.string :district, limit: 100
      t.string :municipality, limit: 100

      t.string :raw_stream_key, limit: 255, null: false # simulated RTSP source consumed by the worker
      t.string :output_stream_key, limit: 255              # annotated stream the frontend subscribes to

      t.string      :worker_status, limit: 20, null: false, default: "STOPPED"
      t.timestamptz :last_heartbeat

      t.string      :signal_state, limit: 10, null: false, default: "GREEN"
      t.timestamptz :signal_updated_at
      t.decimal     :red_grace_seconds, precision: 3, scale: 1, null: false, default: 0

      t.string      :status, limit: 20, null: false, default: "ACTIVE"
      t.date        :installed_at
      t.timestamptz :created_at, null: false, default: -> { "now()" }

      t.index :raw_stream_key,  unique: true
      t.index :output_stream_key, unique: true

      t.check_constraint "frame_width > 0", name: "cameras_frame_width_check"
      t.check_constraint "frame_height > 0", name: "cameras_frame_height_check"
      t.check_constraint "worker_status IN ('STOPPED', 'STARTING', 'RUNNING', 'ERROR')", name: "cameras_worker_status_check"
      t.check_constraint "signal_state IN ('RED', 'YELLOW', 'GREEN')", name: "cameras_signal_state_check"
      t.check_constraint "red_grace_seconds >= 0", name: "cameras_red_grace_check"
      t.check_constraint "status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')", name: "cameras_status_check"
      # A stop line is meaningless without its reference frame size.
      t.check_constraint "stop_line IS NULL OR (frame_width IS NOT NULL AND frame_height IS NOT NULL)", name: "cameras_stop_line_requires_frame"
      # Minimal shape validation; full validation happens in the API.
      t.check_constraint "stop_line IS NULL OR (jsonb_exists(stop_line, 'p1') AND jsonb_exists(stop_line, 'p2'))", name: "cameras_stop_line_shape"
    end
  end
end
