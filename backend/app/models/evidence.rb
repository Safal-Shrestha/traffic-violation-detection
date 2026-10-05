# Pointer to a media file in object storage. Immutable after insert: the checksum
# is the tamper indicator, so rows are never updated or deleted by the application.
class Evidence < ApplicationRecord
  self.table_name = "evidence"

  belongs_to :violation, inverse_of: :evidence_items

  enum :media_type,       { image: "IMAGE", video: "VIDEO" }, validate: true
  enum :evidence_role,    { full_frame: "FULL_FRAME", plate_crop: "PLATE_CROP", clip: "CLIP" }, validate: true
  enum :storage_provider, { s3: "S3", minio: "MINIO", gcs: "GCS" }, validate: true

  IMAGE_MAX_BYTES = 5.megabytes
  VIDEO_MAX_BYTES = 50.megabytes

  validates :storage_key, presence: true, length: { maximum: 512 },
                          uniqueness: { scope: :storage_provider }
  validates :content_type, presence: true, length: { maximum: 100 }
  validates :checksum_sha256, presence: true, format: { with: /\A[0-9a-f]{64}\z/, message: "must be 64 lowercase hex characters" }
  validates :file_size_byte, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :duration_seconds, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validate  :duration_only_for_video
  validate  :role_matches_media_type
  validate  :file_size_within_limit

  def readonly?
    persisted? || super
  end

  private

  def duration_only_for_video
    errors.add(:duration_seconds, "applies to video evidence only") if duration_seconds.present? && !video?
  end

  def role_matches_media_type
    expected = clip? ? "VIDEO" : "IMAGE"
    errors.add(:media_type, "does not match evidence role") unless media_type&.upcase == expected
  end

  def file_size_within_limit
    return if file_size_byte.blank?

    limit = video? ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES
    errors.add(:file_size_byte, "exceeds the #{limit / 1.megabyte} MB limit") if file_size_byte > limit
  end
end
