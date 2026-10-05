require "test_helper"
require_relative "../../../support/api_test_helper"

class Api::V1::ViolationAuditLogsControllerTest < ActionDispatch::IntegrationTest
  include ApiTestHelper
  self.fixture_table_names = []

  setup do
    @admin = create_officer(role: "ADMIN")
    @officer = create_officer
    @violation = create_violation(camera: create_camera, violation_type: create_violation_type)
    ViolationAuditLog.record!(violation: @violation, officer: @officer, action: "CONFIRMED", notes: "ok")
    ViolationAuditLog.record!(violation: @violation, officer: @admin, action: "NOTE_ADDED", notes: "note")
  end

  test "per-violation timeline is ascending and system entries have a null officer" do
    get "/api/v1/violations/#{@violation.id}/audit-log", headers: auth_headers(@officer)

    assert_response :ok
    data = response.parsed_body["data"]
    assert_equal %w[CREATED CONFIRMED NOTE_ADDED], data.map { |e| e["action"] }
    assert_nil data.first["officer"]
    assert_equal({ "id" => @officer.id, "name" => @officer.name }, data[1]["officer"])
    assert_equal %w[action created_at id notes officer violation_id], data.first.keys.sort
  end

  test "per-violation timeline returns 404 for an unknown violation and 401 without a token" do
    get "/api/v1/violations/#{SecureRandom.uuid}/audit-log", headers: auth_headers(@officer)
    assert_response :not_found

    get "/api/v1/violations/#{@violation.id}/audit-log"
    assert_response :unauthorized
  end

  test "global feed is admin only" do
    get "/api/v1/audit-log", headers: auth_headers(@officer)
    assert_response :forbidden

    get "/api/v1/audit-log", headers: auth_headers(@admin)
    assert_response :ok
    assert_equal 3, response.parsed_body["data"].size
    assert_equal "NOTE_ADDED", response.parsed_body.dig("data", 0, "action"), "newest first"
  end

  test "global feed filters by action, officer and violation" do
    get "/api/v1/audit-log?action=CONFIRMED", headers: auth_headers(@admin)
    assert_equal %w[CONFIRMED], response.parsed_body["data"].map { |e| e["action"] }

    get "/api/v1/audit-log", params: { officer_id: @admin.id }, headers: auth_headers(@admin)
    assert_equal %w[NOTE_ADDED], response.parsed_body["data"].map { |e| e["action"] }

    get "/api/v1/audit-log", params: { violation_id: SecureRandom.uuid }, headers: auth_headers(@admin)
    assert_empty response.parsed_body["data"]

    get "/api/v1/audit-log", params: { from: "yesterday" }, headers: auth_headers(@admin)
    assert_response :unprocessable_entity
  end

  test "global feed paginates with cursors" do
    get "/api/v1/audit-log", params: { limit: 2 }, headers: auth_headers(@admin)
    page = response.parsed_body
    assert_equal 2, page["data"].size
    assert page.dig("page", "has_more")

    get "/api/v1/audit-log", params: { limit: 2, cursor: page.dig("page", "next_cursor") }, headers: auth_headers(@admin)
    rest = response.parsed_body
    assert_equal %w[CREATED], rest["data"].map { |e| e["action"] }
    refute rest.dig("page", "has_more")
    assert_nil rest.dig("page", "next_cursor")

    get "/api/v1/audit-log", params: { cursor: "garbage" }, headers: auth_headers(@admin)
    assert_response :unprocessable_entity
  end
end