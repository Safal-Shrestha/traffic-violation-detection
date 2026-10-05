# Shared helpers for the integration tests. Include with `include ApiTestHelper`.
module ApiTestHelper
  def create_officer(role: "OFFICER", **overrides)
    token = SecureRandom.hex(4)
    Officer.create!({
      name: "Test #{role.downcase} #{token}", badge_number: "NP-#{token}", role: role,
      email: "#{token}@example.com", password: "password123"
    }.merge(overrides))
  end

  def auth_headers(officer)
    token, = Warden::JWTAuth::UserEncoder.new.call(officer, :officer, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  def create_camera(**attrs)
    id = SecureRandom.uuid
    Camera.insert_all!([{
      id: id, name: "Test camera", raw_stream_key: "test-camera-#{id}",
      output_stream_key: "live/#{id}_out", signal_state_key: "camera_signal_#{id}",
      created_at: Time.current
    }.merge(attrs)])
    Camera.find(id)
  end

  def create_violation_type
    ViolationType.create!(code: "RED_LIGHT_#{SecureRandom.hex(4).upcase}", name: "Red light", fine_amount_npr: 500)
  end

  # Builds a violation with one evidence item and the CREATED audit row the worker path writes.
  def create_violation(camera:, violation_type:, **attrs)
    violation = Violation.new({
      camera_id: camera.id, violation_type: violation_type, detection_confidence: 0.95,
      occurred_at: Time.current, signal_state: "RED", metadata: { frame_number: 10 }
    }.merge(attrs))
    violation.evidence_items.build(evidence_attributes(camera))
    violation.save!
    # ViolationAuditLog.record!(violation: violation, action: "CREATED") #turning this off results to no errors
    violation
  end

  def evidence_attributes(camera)
    {
      evidence_role: "FULL_FRAME", media_type: "IMAGE", content_type: "image/jpeg",
      storage_provider: "MINIO", storage_key: "violations/#{camera.id}/#{SecureRandom.uuid}/full_frame.jpg",
      file_size_byte: 1024, checksum_sha256: "a" * 64
    }
  end

  # Same technique as the existing violations test: replace EvidenceStorage.new for the block.
  def with_fake_storage
    original_new = EvidenceStorage.method(:new)
    storage = Struct.new(:upload_url, :view_url) do
      def verify_object!(**) = true
      def presign_view(**) = view_url
      def object_exists?(**) = false
    end.new("https://minio.test/upload", "https://minio.test/view")
    EvidenceStorage.define_singleton_method(:new) { |*| storage }
    yield
  ensure
    EvidenceStorage.define_singleton_method(:new, original_new)
  end

  # Camera serialization asks object storage whether a reference frame exists.
  def stub_reference_frame(ready)
    @original_reference_frame_exist ||= ReferenceFrame.method(:exist?)
    ReferenceFrame.define_singleton_method(:exist?) { |_camera_id| ready }
  end

  def restore_reference_frame
    return unless @original_reference_frame_exist

    ReferenceFrame.define_singleton_method(:exist?, @original_reference_frame_exist)
  end
end