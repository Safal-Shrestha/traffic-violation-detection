require "test_helper"

class Api::V1::ViolationsControllerTest < ActionDispatch::IntegrationTest
  include ApiTestHelper
  include ActionCable::TestHelper
  self.fixture_table_names = []

  setup do
    @camera = create_camera
    @violation_type = create_violation_type
  end

  test "worker creation writes a CREATED audit row with no officer and broadcasts violation.created" do
    id = SecureRandom.uuid
    assert_broadcasts("violations", 1) { post_violation(id) }

    assert_response :created
    entries = ViolationAuditLog.where(violation_id: id)
    assert_equal [ "CREATED" ], entries.pluck(:action)
    assert_nil entries.first.officer_id
  end

  test "a retry with the same id adds no second audit row or broadcast" do
    id = SecureRandom.uuid
    post_violation(id)

    assert_no_broadcasts("violations") { post_violation(id) }
    assert_response :ok
    assert_equal 1, ViolationAuditLog.where(violation_id: id).count
  end

  test "a rejected creation leaves no audit row" do
    id = SecureRandom.uuid
    post_violation(id, evidence: [])

    assert_response :unprocessable_entity
    assert_equal 0, ViolationAuditLog.where(violation_id: id).count
  end

  private

  def post_violation(id, evidence: [ evidence_attributes(@camera) ])
    with_fake_storage do
      post "/api/v1/violations", params: {
        violation: { id: id, camera_id: @camera.id, violation_type_code: @violation_type.code,
                     detection_confidence: 0.95, occurred_at: Time.current, signal_state: "RED",
                     metadata: { frame_number: 10 }, evidence: evidence }
      }
    end
  end
end
