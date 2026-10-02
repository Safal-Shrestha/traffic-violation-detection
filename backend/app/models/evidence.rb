# Pointer to a media file in object storage. Immutable after insert: the checksum
# is the tamper indicator, so rows are never updated or deleted by the application.
class Evidence < ApplicationRecord
  self.table_name = "evidence"

  belongs_to :violation, inverse_of: :evidence_items

  enum :media_type,       { image: "IMAGE", video: "VIDEO" }, validate: true
  enum :evidence_role,    { full_frame: "FULL_FRAME", plate_crop: "PLATE_CROP", clip: "CLIP" }, validate: true
  enum :storage_provider, { s3: "S3", minio: "MINIO", gcs: "GCS" }, validate: true

  validates :storage_key, presence: true, length: { maximum: 512 },
                          uniqueness: { scope: :storage_provider }
  validates :checksum_sha256, presence: true, format: { with: /\A[0-9a-f]{64}\z/, message: "must be 64 lowercase hex characters" }
  validates :file_size_byte, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :duration_seconds, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validate  :duration_only_for_video

  def readonly?
    persisted? || super
  end

  private

  def duration_only_for_video
    errors.add(:duration_seconds, "applies to video evidence only") if duration_seconds.present? && !video?
  end
end
