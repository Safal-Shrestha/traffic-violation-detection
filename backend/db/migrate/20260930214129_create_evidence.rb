class CreateEvidence < ActiveRecord::Migration[8.1]
  def change
    create_table :evidence, id: :uuid do |t|
      t.references :violation, type: :uuid, null: false, foreign_key: { on_delete: :restrict }

      t.string  :media_type, limit: 10,  null: false
      t.string  :evidence_role, limit: 20,  null: false
      t.string  :storage_key, limit: 512, null: false
      t.string  :storage_provider, limit: 20,  null: false
      t.bigint  :file_size_byte
      t.decimal :duration_seconds, precision: 6, scale: 2
      t.column  :checksum_sha256, "char(64)", null: false
      t.timestamptz :created_at, null: false, default: -> { "now()" }

      t.index [ :storage_provider, :storage_key ], unique: true, name: "uq_evidence_storage"

      t.check_constraint "media_type IN ('IMAGE', 'VIDEO')", name: "evidence_media_type_check"
      t.check_constraint "evidence_role IN ('FULL_FRAME', 'PLATE_CROP', 'CLIP')", name: "evidence_role_check"
      t.check_constraint "storage_provider IN ('S3', 'MINIO', 'GCS')", name: "evidence_provider_check"
      t.check_constraint "file_size_byte >= 0", name: "evidence_size_check"
      t.check_constraint "duration_seconds >= 0", name: "evidence_duration_check"
      t.check_constraint "checksum_sha256 ~ '^[0-9a-f]{64}$'", name: "evidence_checksum_check"
      # Duration applies to video only.
      t.check_constraint "media_type = 'VIDEO' OR duration_seconds IS NULL", name: "evidence_duration_video_only"
    end
  end
end
