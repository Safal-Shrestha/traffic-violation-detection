require "test_helper"
require_relative "../../../support/api_test_helper"

class Api::V1::CameraSignalsControllerTest < ActionDispatch::IntegrationTest
  include ApiTestHelper
  self.fixture_table_names = []

  setup do
    @admin = create_officer(role: "ADMIN")
    @camera = create_camera(
      signal_api_base_url: "http://worker.example:5002",
      signal_api_last_seen_at: 5.seconds.ago
    )
  end

  test "admin reads the worker's current signal through the backend proxy" do
    worker_response = signal_response("GREEN")
    fake_http = fake_http_response(worker_response)
    start_http = ->(_host, _port, **_options, &block) { block.call(fake_http) }
    with_signal_token do
      Net::HTTP.stub(:start, start_http) do
        get "/api/v1/cameras/#{@camera.id}/signal", headers: auth_headers(@admin)
      end
    end

    assert_response :ok
    assert_equal "GREEN", response.parsed_body["state"]
    assert_equal "GET", fake_http.last_request.method
    assert_equal "Bearer test-control-token", fake_http.last_request["Authorization"]
  end

  test "admin sets the per-camera worker signal" do
    worker_response = signal_response("RED")
    fake_http = fake_http_response(worker_response)
    start_http = ->(_host, _port, **_options, &block) { block.call(fake_http) }
    with_signal_token do
      Net::HTTP.stub(:start, start_http) do
        put "/api/v1/cameras/#{@camera.id}/signal", params: { state: "red" },
            headers: auth_headers(@admin), as: :json
      end
    end

    assert_response :ok
    assert_equal "RED", response.parsed_body["state"]
    assert_equal "PUT", fake_http.last_request.method
    assert_equal({ "state" => "RED" }, JSON.parse(fake_http.last_request.body))
    assert_equal "Bearer test-control-token", fake_http.last_request["Authorization"]
  end

  test "invalid signal state is rejected before contacting the worker" do
    put "/api/v1/cameras/#{@camera.id}/signal", params: { state: "FLASHING" },
        headers: auth_headers(@admin), as: :json

    assert_response :unprocessable_entity
    assert_equal "VALIDATION_FAILED", response.parsed_body.dig("error", "code")
  end

  private

  def signal_response(state)
    response = Net::HTTPOK.new("1.1", "200", "OK")
    response.define_singleton_method(:body) do
      { state: state, updated_at: Time.current.iso8601 }.to_json
    end
    response
  end

  def fake_http_response(response)
    http = Object.new
    http.define_singleton_method(:request) do |request|
      define_singleton_method(:last_request) { request }
      response
    end
    http
  end

  def with_signal_token(&block)
    original = ENV.method(:[])
    ENV.stub(:[], ->(key) { key == "SIGNAL_CONTROL_TOKEN" ? "test-control-token" : original.call(key) }, &block)
  end
end
