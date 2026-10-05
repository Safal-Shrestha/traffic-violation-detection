require "test_helper"

class Api::V1::EvidenceControllerTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  setup do
    camera_id = SecureRandom.uuid
    Camera.insert_all!([ { id: camera_id, name: "Test camera", raw_stream_key: "test-camera-#{camera_id}" } ])
    @camera = Camera.find(camera_id)
    @violation_type = ViolationType.create!(code: "RED_LIGHT", name: "Red light", fine_amount_npr: 500)
    @violation = Violation.new(
      camera: @camera,
      violation_type: @violation_type,
      detection_confidence: 0.95,
      occurred_at: Time.current
    )
    @violation.save!(validate: false)
  end

  test "worker can presign evidence uploads" do
    with_fake_storage do
      post api_v1_evidence_presign_path, params: {
        camera_id: @camera.id,
        violation_id: @violation.id,
        items: [ {
          evidence_role: "FULL_FRAME",
          media_type: "IMAGE",
          content_type: "image/jpeg",
          file_size_byte: 1024
        } ]
      }
    end

    assert_response :success
    item = response.parsed_body.fetch("items").first
    assert_equal "MINIO", item["storage_provider"]
    assert_equal "PUT", item["method"]
    assert_equal "https://minio.test/upload", item["upload_url"]
  end

  test "evidence is registered through violation creation" do
    with_fake_storage do
      assert_difference("Evidence.count", 1) do
        post api_v1_violations_path, params: {
          violation: {
            camera_id: @camera.id,
            violation_type_id: @violation_type.id,
            detection_confidence: 0.95,
            occurred_at: Time.current,
            evidence: [ valid_evidence_attributes ]
          }
        }
      end
    end

    assert_response :created
    assert_equal "https://minio.test/view", response.parsed_body["evidence"].first["media_url"]
  end

  test "frontend can read evidence with a media URL" do
    evidence = Evidence.create!(valid_evidence_attributes.merge(violation_id: @violation.id))
    with_fake_storage { get api_v1_evidence_path(evidence) }

    assert_response :success
    assert_equal evidence.id, response.parsed_body["id"]
    assert_equal "https://minio.test/view", response.parsed_body["media_url"]
    refute response.parsed_body.key?("storage_key")
  end

  test "frontend can read evidence belonging to a violation" do
    evidence = Evidence.create!(valid_evidence_attributes.merge(violation_id: @violation.id))
    with_fake_storage { get evidence_api_v1_violation_path(@violation) }

    assert_response :success
    assert_equal [ evidence.id ], response.parsed_body["evidence"].map { |item| item["id"] }
  end

  test "evidence cannot be updated or deleted" do
    evidence = Evidence.create!(valid_evidence_attributes.merge(violation_id: @violation.id))

    patch api_v1_evidence_path(evidence), params: { evidence: { storage_key: "changed" } }
    assert_response :method_not_allowed

    delete api_v1_evidence_path(evidence)
    assert_response :method_not_allowed
    assert Evidence.exists?(evidence.id)
  end

  private

  def with_fake_storage
    original_new = EvidenceStorage.method(:new)
    storage = fake_storage
    EvidenceStorage.define_singleton_method(:new) { |*| storage }
    yield
  ensure
    EvidenceStorage.define_singleton_method(:new, original_new)
  end

  def fake_storage
    @fake_storage ||= Struct.new(:upload_url, :view_url) do
      def presign_upload(**)
        upload_url
      end

      def presign_view(**)
        view_url
      end

      def verify_object!(**)
        true
      end
    end.new("https://minio.test/upload", "https://minio.test/view")
  end

  def valid_evidence_attributes
    {
      evidence_role: "FULL_FRAME",
      media_type: "IMAGE",
      content_type: "image/jpeg",
      storage_provider: "MINIO",
      storage_key: "violations/#{@camera.id}/#{SecureRandom.uuid}/full_frame",
      file_size_byte: 1024,
      checksum_sha256: "a" * 64
    }
  end
end
