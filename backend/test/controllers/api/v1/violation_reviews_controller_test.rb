require "test_helper"
require_relative "../../../support/api_test_helper"

class Api::V1::ViolationReviewsControllerTest < ActionDispatch::IntegrationTest
  include ApiTestHelper
  include ActionCable::TestHelper
  self.fixture_table_names = []

  setup do
    @officer = create_officer
    @camera = create_camera
    @violation = create_violation(camera: @camera, violation_type: create_violation_type)
  end

  test "confirm sets CONFIRMED, records the reviewer and appends an audit row" do
    assert_broadcasts("violations", 1) { review(:confirm, notes: "Plate verified from crop.") }

    assert_response :ok
    body = response.parsed_body
    assert_equal "CONFIRMED", body.dig("violation", "status")
    assert_equal @officer.id, body.dig("violation", "review", "reviewed_by", "id")
    assert body.dig("violation", "review", "reviewed_at").present?
    assert_equal "CONFIRMED", body.dig("audit_entry", "action")
    assert_equal @officer.id, body.dig("audit_entry", "officer", "id")
    assert_equal "Plate verified from crop.", body.dig("audit_entry", "notes")
    assert_equal %w[CREATED CONFIRMED], audit_actions
    assert_equal 1, body.dig("violation", "evidence").size
    assert body.dig("violation", "evidence", 0, "download_url").present?
    refute body.dig("violation", "evidence", 0).key?("storage_key")
  end

  test "confirm works without notes" do
    review(:confirm)
    assert_response :ok
    assert_nil response.parsed_body.dig("audit_entry", "notes")
  end

  test "reject requires notes" do
    review(:reject)
    assert_response :unprocessable_entity
    assert_equal "notes", response.parsed_body.dig("error", "details", 0, "field")
    assert_equal "PENDING", @violation.reload.status.to_s.upcase
    assert_equal %w[CREATED], audit_actions

    review(:reject, notes: "Plate belongs to a different vehicle.")
    assert_response :ok
    assert_equal "REJECTED", response.parsed_body.dig("violation", "status")
    assert_equal %w[CREATED REJECTED], audit_actions
  end

  test "reopen requires notes, clears the review and keeps the earlier reviewer in the audit trail" do
    review(:confirm)
    review(:reopen)
    assert_response :unprocessable_entity

    review(:reopen, notes: "Second look needed.")
    assert_response :ok
    body = response.parsed_body
    assert_equal "PENDING", body.dig("violation", "status")
    assert_nil body.dig("violation", "review")
    @violation.reload
    assert_nil @violation.reviewed_by
    assert_nil @violation.reviewed_at

    get "/api/v1/violations/#{@violation.id}/audit-log", headers: auth_headers(@officer)
    data = response.parsed_body["data"]
    assert_equal %w[CREATED CONFIRMED REOPENED], data.map { |e| e["action"] }
    assert_equal @officer.id, data[1].dig("officer", "id")
  end

  test "invalid transitions return 409 and write no audit row" do
    review(:confirm)
    assert_response :ok

    review(:confirm)
    assert_response :conflict
    assert_equal "INVALID_STATE_TRANSITION", response.parsed_body.dig("error", "code")

    review(:reject, notes: "too late")
    assert_response :conflict

    @violation.reload
    review(:reopen, notes: "ok")
    review(:reopen, notes: "again")
    assert_response :conflict
    assert_equal %w[CREATED CONFIRMED REOPENED], audit_actions
  end

  test "notes append an audit row without touching the violation" do
    review(:notes)
    assert_response :unprocessable_entity

    assert_broadcasts("violations", 1) { review(:notes, notes: "Called the owner.") }
    assert_response :ok
    assert_equal "PENDING", response.parsed_body.dig("violation", "status")
    assert_equal "NOTE_ADDED", response.parsed_body.dig("audit_entry", "action")

    review(:confirm)
    review(:notes, notes: "Also allowed after confirmation.")
    assert_response :ok
    assert_equal %w[CREATED NOTE_ADDED CONFIRMED NOTE_ADDED], audit_actions
  end

  test "review actions need a valid token" do
    review(:confirm, as: nil)
    assert_response :unauthorized
    assert_equal "UNAUTHENTICATED", response.parsed_body.dig("error", "code")
    assert_equal %w[CREATED], audit_actions
  end

  test "unknown violation returns 404" do
    with_fake_storage do
      post "/api/v1/violations/#{SecureRandom.uuid}/confirm", headers: auth_headers(@officer), as: :json
    end
    assert_response :not_found
    assert_equal "NOT_FOUND", response.parsed_body.dig("error", "code")
  end

  test "audit entries cannot be modified or deleted" do
    entry = ViolationAuditLog.where(violation_id: @violation.id).first
    assert_raises(ActiveRecord::ReadOnlyRecord) { entry.update!(notes: "edited") }
    assert_raises(ActiveRecord::ReadOnlyRecord) { entry.destroy! }
  end

  private

  def review(action, as: @officer, **body)
    with_fake_storage do
      post "/api/v1/violations/#{@violation.id}/#{action}", params: body,
                                                              headers: as ? auth_headers(as) : {}, as: :json
    end
  end

  def audit_actions
    ViolationAuditLog.where(violation_id: @violation.id).order(:id).pluck(:action)
  end
end
