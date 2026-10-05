# Reference frames live in object storage at a fixed key.
# Requires EvidenceStorage#object_exists?(storage_key:).
class ReferenceFrame
  def self.key(camera_id)
    "cameras/#{camera_id}/reference.jpg"
  end

  def self.exist?(camera_id)
    EvidenceStorage.new.object_exists?(storage_key: key(camera_id))
  end
end
