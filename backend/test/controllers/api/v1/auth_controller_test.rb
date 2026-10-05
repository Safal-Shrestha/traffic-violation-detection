require "test_helper"
require_relative "../../../support/api_test_helper"

class Api::V1::AuthControllerTest < ActionDispatch::IntegrationTest
  include ApiTestHelper
  self.fixture_table_names = []

  setup { @officer = create_officer(email: "ram@example.com") }

  test "login returns a token, expiry and the officer" do
    post "/api/v1/auth/login", params: { email: "RAM@example.com", password: "password123" }, as: :json

    assert_response :ok
    body = response.parsed_body
    assert body["access_token"].present?
    assert body["expires_at"].present?
    assert_equal %w[badge_number email id name role], body["officer"].keys.sort
    assert_equal @officer.id, body.dig("officer", "id")
  end

  test "login rejects a wrong password" do
    post "/api/v1/auth/login", params: { email: "ram@example.com", password: "nope" }, as: :json

    assert_response :unauthorized
    assert_equal "INVALID_CREDENTIALS", response.parsed_body.dig("error", "code")
  end

  test "me returns the officer for a valid token and 401 otherwise" do
    get "/api/v1/auth/me", headers: auth_headers(@officer)
    assert_response :ok
    assert_equal @officer.id, response.parsed_body["id"]

    get "/api/v1/auth/me"
    assert_response :unauthorized
    assert_equal "UNAUTHENTICATED", response.parsed_body.dig("error", "code")

    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer not-a-token" }
    assert_response :unauthorized
  end

  test "a deleted officer's token stops working" do
    headers = auth_headers(@officer)
    @officer.delete

    get "/api/v1/auth/me", headers: headers
    assert_response :unauthorized
  end

  test "change-password requires the current password" do
    post "/api/v1/auth/change-password", params: { current_password: "wrong", new_password: "new-secret-1" },
                                         headers: auth_headers(@officer), as: :json
    assert_response :unprocessable_entity
    assert_equal "current_password", response.parsed_body.dig("error", "details", 0, "field")

    post "/api/v1/auth/change-password", params: { current_password: "password123", new_password: "new-secret-1" },
                                         headers: auth_headers(@officer), as: :json
    assert_response :no_content
    assert @officer.reload.valid_password?("new-secret-1")
  end
end