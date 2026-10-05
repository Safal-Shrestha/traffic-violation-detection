require "test_helper"
require_relative "../../../support/api_test_helper"

class Api::V1::CamerasControllerTest < ActionDispatch::IntegrationTest
  include ApiTestHelper
  self.fixture_table_names = []

  setup do
    @admin = create_officer(role: "ADMIN")
    @officer = create_officer
    stub_reference_frame(false)
  end

  teardown { restore_reference_frame }

  test "admin registers a camera and the backend generates keys and the worker record" do
    post "/api/v1/cameras", params: {
      name: "Maitighar Junction North", district: "Kathmandu", municipality: "Kathmandu Metropolitan City",
      installed_at: "2026-10-04", raw_stream_key: "live/cam_north_in"
    }, headers: auth_headers(@admin), as: :json

    assert_response :created
    body = response.parsed_body
    assert_equal "live/#{body['id']}_out", body["output_stream_key"]
    assert_equal "camera_signal_#{body['id']}", body["signal_state_key"]
    assert_equal "ACTIVE", body["status"]
    assert_equal "2026-10-04", body["installed_at"]
    refute body.key?("signal")
    assert_equal "AWAITING_WORKER", body.dig("calibration", "status")
    assert_equal false, body.dig("calibration", "calibrated")
    assert_equal 1, body.dig("calibration", "config_version")
    assert_equal "STOPPED", body.dig("worker", "status")
    assert_equal false, body.dig("worker", "online")
    assert body.dig("playback", "webrtc_url").end_with?("/live/#{body['id']}_out")
    assert_nil body.dig("playback", "hls_url")
    refute body.key?("raw_stream_key"), "the frontend must never receive the raw stream key"
    assert_equal "live/cam_north_in", Camera.find(body["id"]).raw_stream_key
  end

  test "raw_stream_key is generated when omitted" do
    post "/api/v1/cameras", params: { name: "Cam" }, headers: auth_headers(@admin), as: :json

    assert_response :created
    assert_equal "live/#{response.parsed_body['id']}_in", Camera.find(response.parsed_body["id"]).raw_stream_key
  end

  test "create validates name, status, date and duplicate raw_stream_key" do
    existing = create_camera
    post "/api/v1/cameras", params: { name: " ", status: "BROKEN", installed_at: "04/10/2026",
                                      raw_stream_key: existing.raw_stream_key },
                            headers: auth_headers(@admin), as: :json

    assert_response :unprocessable_entity
    error = response.parsed_body["error"]
    assert_equal "VALIDATION_FAILED", error["code"]
    assert_equal %w[installed_at name raw_stream_key status], error["details"].map { |d| d["field"] }.sort
  end

  test "officers can read cameras but not create or update them" do
    camera = create_camera

    post "/api/v1/cameras", params: { name: "Cam" }, headers: auth_headers(@officer), as: :json
    assert_response :forbidden

    patch "/api/v1/cameras/#{camera.id}", params: { name: "Renamed" }, headers: auth_headers(@officer), as: :json
    assert_response :forbidden

    get "/api/v1/cameras/#{camera.id}", headers: auth_headers(@officer)
    assert_response :ok
    assert_equal camera.id, response.parsed_body["id"]
  end

  test "unauthenticated requests get 401" do
    get "/api/v1/cameras"
    assert_response :unauthorized
  end

  test "show returns 404 NOT_FOUND for an unknown camera" do
    get "/api/v1/cameras/#{SecureRandom.uuid}", headers: auth_headers(@admin)
    assert_response :not_found
    assert_equal "NOT_FOUND", response.parsed_body.dig("error", "code")
  end

  test "index paginates and filters" do
    create_camera(district: "Lalitpur")
    create_camera(district: "Kathmandu")
    create_camera(district: "Kathmandu")

    get "/api/v1/cameras", params: { limit: 2 }, headers: auth_headers(@officer)
    assert_response :ok
    page = response.parsed_body
    assert_equal 2, page["data"].size
    assert page.dig("page", "has_more")

    get "/api/v1/cameras", params: { limit: 2, cursor: page.dig("page", "next_cursor") }, headers: auth_headers(@officer)
    assert_equal 1, response.parsed_body["data"].size

    get "/api/v1/cameras", params: { district: "Kathmandu" }, headers: auth_headers(@officer)
    assert_equal 2, response.parsed_body["data"].size
  end

  test "index filters by derived calibration status" do
    waiting = create_camera
    calibrated = create_camera
    calibrated.update_columns(stop_line: { p1: { x: 1, y: 2 }, p2: { x: 3, y: 4 }, approach_side: "below" })

    get "/api/v1/cameras", params: { calibration_status: "CALIBRATED" }, headers: auth_headers(@admin)
    assert_equal [ calibrated.id ], response.parsed_body["data"].map { |c| c["id"] }

    get "/api/v1/cameras", params: { calibration_status: "AWAITING_WORKER" }, headers: auth_headers(@admin)
    assert_equal [ waiting.id ], response.parsed_body["data"].map { |c| c["id"] }

    stub_reference_frame(true)
    get "/api/v1/cameras", params: { calibration_status: "AWAITING_CALIBRATION" }, headers: auth_headers(@admin)
    assert_equal [ waiting.id ], response.parsed_body["data"].map { |c| c["id"] }
    assert_equal true, response.parsed_body.dig("data", 0, "calibration", "reference_frame_ready")

    get "/api/v1/cameras", params: { calibration_status: "NOPE" }, headers: auth_headers(@admin)
    assert_response :unprocessable_entity
  end

  test "worker online reflects the heartbeat age" do
    camera = create_camera
    camera.update_columns(worker_status: "RUNNING", last_heartbeat: 5.seconds.ago)
    get "/api/v1/cameras/#{camera.id}", headers: auth_headers(@admin)
    assert_equal true, response.parsed_body.dig("worker", "online")

    camera.update_columns(last_heartbeat: 2.minutes.ago)
    get "/api/v1/cameras/#{camera.id}", headers: auth_headers(@admin)
    assert_equal false, response.parsed_body.dig("worker", "online")
    assert_equal "RUNNING", response.parsed_body.dig("worker", "status")
  end

  test "patching descriptive fields keeps config_version" do
    camera = create_camera
    patch "/api/v1/cameras/#{camera.id}", params: { name: "Renamed", district: "Bhaktapur" },
                                          headers: auth_headers(@admin), as: :json

    assert_response :ok
    assert_equal "Renamed", response.parsed_body["name"]
    assert_equal 1, response.parsed_body.dig("calibration", "config_version")
  end

  test "changing status or raw_stream_key increments config_version" do
    camera = create_camera

    patch "/api/v1/cameras/#{camera.id}", params: { status: "INACTIVE" }, headers: auth_headers(@admin), as: :json
    assert_response :ok
    assert_equal "INACTIVE", response.parsed_body["status"]
    assert_equal 2, response.parsed_body.dig("calibration", "config_version")

    patch "/api/v1/cameras/#{camera.id}", params: { raw_stream_key: "live/new_in" }, headers: auth_headers(@admin), as: :json
    assert_equal 3, response.parsed_body.dig("calibration", "config_version")

    patch "/api/v1/cameras/#{camera.id}", params: { status: "INACTIVE" }, headers: auth_headers(@admin), as: :json
    assert_equal 3, response.parsed_body.dig("calibration", "config_version"), "unchanged status must not bump the version"
  end

  test "patch rejects geometry fields that belong to PUT config" do
    camera = create_camera
    patch "/api/v1/cameras/#{camera.id}", params: { stop_line: { p1: { x: 1, y: 1 } }, red_grace_seconds: 2 },
                                          headers: auth_headers(@admin), as: :json

    assert_response :unprocessable_entity
    assert_equal %w[red_grace_seconds stop_line], response.parsed_body.dig("error", "details").map { |d| d["field"] }.sort
    assert_nil camera.reload.stop_line
  end

  test "patch rejects a raw_stream_key used by another camera" do
    other = create_camera
    camera = create_camera
    patch "/api/v1/cameras/#{camera.id}", params: { raw_stream_key: other.raw_stream_key },
                                          headers: auth_headers(@admin), as: :json

    assert_response :unprocessable_entity
    assert_equal "raw_stream_key", response.parsed_body.dig("error", "details", 0, "field")
  end
end
