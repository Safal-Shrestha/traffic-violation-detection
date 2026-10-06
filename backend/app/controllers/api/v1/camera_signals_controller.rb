module Api
  module V1
    # Proxies signal reads and changes so the worker's control token stays on Rails.
    class CameraSignalsController < BaseController
      before_action :authenticate_user!
      before_action :require_admin!
      before_action :load_camera

      VALID_STATES = %w[RED YELLOW GREEN].freeze

      def show
        render json: signal_payload
      end

      def update
        state = params[:state].to_s.upcase
        unless VALID_STATES.include?(state)
          raise ApiErrors::ValidationFailed.new([
            { field: "state", message: "must be RED, YELLOW, or GREEN" }
          ])
        end

        render json: signal_payload(state: state)
      end

      private

      def load_camera
        @camera = Camera.find(params[:camera_id])
      end

      def signal_payload(state: nil)
        upstream = request_worker_signal(state: state)
        worker_state = upstream["state"].to_s.upcase
        unless VALID_STATES.include?(worker_state)
          raise ApiErrors::ApiError.new("INVALID_SIGNAL_RESPONSE", "Worker returned an invalid signal state.", :bad_gateway)
        end

        { camera_id: @camera.id, state: worker_state, updated_at: upstream["updated_at"] }
      end

      def request_worker_signal(state: nil)
        if @camera.signal_api_base_url.blank? || @camera.signal_state_key.blank? || !CameraSerializer.signal_available?(@camera)
          raise ApiErrors::ApiError.new("SIGNAL_UNAVAILABLE", "This camera's signal controller is offline.", :service_unavailable)
        end

        token = ENV["SIGNAL_CONTROL_TOKEN"].to_s
        if token.blank?
          raise ApiErrors::ApiError.new("SIGNAL_CONTROL_NOT_CONFIGURED", "Configure SIGNAL_CONTROL_TOKEN for Rails.", :service_unavailable)
        end

        base = URI.parse(@camera.signal_api_base_url)
        unless %w[http https].include?(base.scheme) && base.host.present?
          raise ApiErrors::ApiError.new("INVALID_SIGNAL_URL", "The worker signal URL is invalid.", :bad_gateway)
        end
        base.path = "#{base.path.to_s.sub(%r{/\z}, "")}/signal/#{@camera.signal_state_key}"
        uri = base
        http_class = state.present? ? Net::HTTP::Put : Net::HTTP::Get
        request = http_class.new(uri)
        request["Authorization"] = "Bearer #{token}"
        if state.present?
          request["Content-Type"] = "application/json"
          request.body = { state: state }.to_json
        end

        response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                                   open_timeout: 3, read_timeout: 3, write_timeout: 3) do |http|
          http.request(request)
        end
        unless response.is_a?(Net::HTTPSuccess)
          raise ApiErrors::ApiError.new("SIGNAL_WORKER_ERROR", "Worker signal API returned HTTP #{response.code}.", :bad_gateway)
        end

        JSON.parse(response.body)
      rescue JSON::ParserError
        raise ApiErrors::ApiError.new("INVALID_SIGNAL_RESPONSE", "Worker returned invalid signal data.", :bad_gateway)
      rescue Net::OpenTimeout, Net::ReadTimeout, Net::WriteTimeout, SocketError, Errno::ECONNREFUSED => error
        Rails.logger.warn("camera signal request failed camera_id=#{@camera.id}: #{error.class}")
        raise ApiErrors::ApiError.new("SIGNAL_WORKER_UNREACHABLE", "Could not reach this camera's signal controller.", :bad_gateway)
      rescue URI::InvalidURIError
        raise ApiErrors::ApiError.new("INVALID_SIGNAL_URL", "The worker signal URL is invalid.", :bad_gateway)
      end
    end
  end
end
