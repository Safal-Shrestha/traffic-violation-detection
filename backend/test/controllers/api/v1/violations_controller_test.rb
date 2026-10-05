require "test_helper"

class Api::V1::ViolationsControllerTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  setup do
    camera_id = SecureRandom.uuid
    Camera.insert_all!([ { id: camera_id, name: "Test camera", raw_stream_key: "test-camera-#{camera_id}" } ])
    @camera = Camera.find(camera_id)
    @violation_type = ViolationType.create!(code: "RED_LIGHT", name: "Red light", fine_amount_npr: 500)
  end

  test "worker creates a violation with registered evidence" do
    with_fake_storage do
      assert_difference([ "Violation.count", "Evidence.count" ], 1) do
        post api_v1_violations_path, params: {
          violation: valid_violation_attributes.merge(
            id: SecureRandom.uuid,
            violation_type_code: "RED_LIGHT",
            evidence: [ valid_evidence_attributes ]
          )
        }
      end
    end

    assert_response :created
    assert_equal "RED_LIGHT", response.parsed_body.dig("violation_type", "code")
    assert_equal 1, response.parsed_body.fetch("evidence").size
  end

  test "retries with the same id return the stored violation" do
    id = SecureRandom.uuid
    with_fake_storage do
      post api_v1_violations_path, params: {
        violation: valid_violation_attributes.merge(id: id, violation_type_code: "RED_LIGHT",
                                                     evidence: [ valid_evidence_attributes ])
      }
      assert_response :created

      assert_no_difference([ "Violation.count", "Evidence.count" ]) do
        post api_v1_violations_path, params: {
          violation: valid_violation_attributes.merge(id: id, violation_type_code: "RED_LIGHT",
                                                       evidence: [ valid_evidence_attributes ])
        }
      end
    end

    assert_response :success
  end

  test "frontend can list and show violations" do
    violation = Violation.new(valid_violation_attributes.merge(violation_type: @violation_type))
    violation.save!(validate: false)

    get api_v1_violations_path
    assert_response :success
    assert_equal violation.id, response.parsed_body.fetch("data").first["id"]

    get api_v1_violation_path(violation)
    assert_response :success
    assert_equal violation.id, response.parsed_body["id"]
  end

  private

  def with_fake_storage
    original_new = EvidenceStorage.method(:new)
    storage = Struct.new(:upload_url, :view_url) do
      def verify_object!(**)
        true
      end

      def presign_view(**)
        view_url
      end
    end.new("https://minio.test/upload", "https://minio.test/view")
    EvidenceStorage.define_singleton_method(:new) { |*| storage }
    yield
  ensure
    EvidenceStorage.define_singleton_method(:new, original_new)
  end

  def valid_violation_attributes
    {
      camera_id: @camera.id,
      detection_confidence: 0.95,
      occurred_at: Time.current,
      signal_state: "RED",
      metadata: { frame_number: 10 }
    }
  end

  def valid_evidence_attributes
    {
      evidence_role: "FULL_FRAME",
      media_type: "IMAGE",
      content_type: "image/jpeg",
      storage_provider: "MINIO",
      storage_key: "violations/#{@camera.id}/#{SecureRandom.uuid}/full_frame.jpg",
      file_size_byte: 1024,
      checksum_sha256: "a" * 64
    }
  end
end
