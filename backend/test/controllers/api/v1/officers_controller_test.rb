require "test_helper"
require_relative "../../../support/api_test_helper"

class Api::V1::OfficersControllerTest < ActionDispatch::IntegrationTest
  include ApiTestHelper
  self.fixture_table_names = []

  setup do
    @admin = create_officer(role: "ADMIN")
    @officer = create_officer
  end

  test "admin creates an officer and the response omits credentials" do
    post "/api/v1/officers", params: {
      name: "Sita Sharma", badge_number: "NP-2210", role: "OFFICER", email: "sita@example.com", password: "initial-password"
    }, headers: auth_headers(@admin), as: :json

    assert_response :created
    body = response.parsed_body
    assert_equal %w[badge_number email id name role], body.keys.sort
    assert Officer.find(body["id"]).valid_password?("initial-password")
  end

  test "create validates role, uniqueness and required fields" do
    post "/api/v1/officers", params: { name: "X", badge_number: @officer.badge_number, role: "SUPER",
                                       email: @officer.email.upcase, password: "pw" },
                             headers: auth_headers(@admin), as: :json

    assert_response :unprocessable_entity
    fields = response.parsed_body.dig("error", "details").map { |d| d["field"] }
    assert_includes fields, "role"
    assert_includes fields, "badge_number"
    assert_includes fields, "email"
  end

  test "officers cannot manage officers" do
    post "/api/v1/officers", params: { name: "X" }, headers: auth_headers(@officer), as: :json
    assert_response :forbidden
    assert_equal "FORBIDDEN", response.parsed_body.dig("error", "code")

    get "/api/v1/officers", headers: auth_headers(@officer)
    assert_response :forbidden
  end

  test "requests without a token get 401" do
    get "/api/v1/officers"
    assert_response :unauthorized
  end

  test "index filters by role and paginates with cursors" do
    3.times { create_officer }

    get "/api/v1/officers", params: { role: "OFFICER", limit: 2 }, headers: auth_headers(@admin)
    assert_response :ok
    first_page = response.parsed_body
    assert_equal 2, first_page["data"].size
    assert first_page.dig("page", "has_more")
    assert(first_page["data"].all? { |o| o["role"] == "OFFICER" })

    get "/api/v1/officers", params: { role: "OFFICER", limit: 2, cursor: first_page.dig("page", "next_cursor") },
                            headers: auth_headers(@admin)
    second_page = response.parsed_body
    assert_equal 2, second_page["data"].size
    assert_empty(first_page["data"].map { |o| o["id"] } & second_page["data"].map { |o| o["id"] })
    refute second_page.dig("page", "has_more")
  end

  test "limit above 100 is rejected" do
    get "/api/v1/officers", params: { limit: 101 }, headers: auth_headers(@admin)
    assert_response :unprocessable_entity
  end

  test "an officer can read their own record but not another" do
    get "/api/v1/officers/#{@officer.id}", headers: auth_headers(@officer)
    assert_response :ok

    get "/api/v1/officers/#{@admin.id}", headers: auth_headers(@officer)
    assert_response :forbidden

    get "/api/v1/officers/#{@officer.id}", headers: auth_headers(@admin)
    assert_response :ok
  end

  test "admin updates an officer and resets the password" do
    patch "/api/v1/officers/#{@officer.id}", params: { name: "New Name", password: "reset-password" },
                                             headers: auth_headers(@admin), as: :json
    assert_response :ok
    assert_equal "New Name", response.parsed_body["name"]

    post "/api/v1/auth/login", params: { email: @officer.email, password: "reset-password" }, as: :json
    assert_response :ok
  end

  test "blank password on update is rejected" do
    patch "/api/v1/officers/#{@officer.id}", params: { password: "" }, headers: auth_headers(@admin), as: :json
    assert_response :unprocessable_entity
  end

  test "the last admin cannot be demoted, but can once another admin exists" do
    patch "/api/v1/officers/#{@admin.id}", params: { role: "OFFICER" }, headers: auth_headers(@admin), as: :json
    assert_response :conflict
    assert_equal "LAST_ADMIN", response.parsed_body.dig("error", "code")
    assert_equal "ADMIN", @admin.reload.role

    create_officer(role: "ADMIN")
    patch "/api/v1/officers/#{@admin.id}", params: { role: "OFFICER" }, headers: auth_headers(@admin), as: :json
    assert_response :ok
  end

  test "delete removes an unreferenced officer" do
    delete "/api/v1/officers/#{@officer.id}", headers: auth_headers(@admin)
    assert_response :no_content
    assert_nil Officer.find_by(id: @officer.id)
  end

  test "delete is refused for an officer with audit entries" do
    camera = create_camera
    violation = create_violation(camera: camera, violation_type: create_violation_type)
    ViolationAuditLog.record!(violation: violation, officer: @officer, action: "NOTE_ADDED", notes: "seen")

    delete "/api/v1/officers/#{@officer.id}", headers: auth_headers(@admin)
    assert_response :conflict
    assert_equal "OFFICER_IN_USE", response.parsed_body.dig("error", "code")
  end

  test "delete is refused for the last admin" do
    delete "/api/v1/officers/#{@admin.id}", headers: auth_headers(@admin)
    assert_response :conflict
    assert_equal "LAST_ADMIN", response.parsed_body.dig("error", "code")
  end
end
