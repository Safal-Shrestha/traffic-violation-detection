module Api
  module V1
    class WorkerHeartbeatsController < BaseController
      before_action :authenticate_worker!
      before_action :load_camera

      def create
        attrs = params.permit(:status, :control_api_base_url, :signal_api_base_url)
        details = []
        details << { field: "status", message: "must be a valid worker status" } if attrs[:status].present? &&
          !Camera::WORKER_STATUSES.include?(attrs[:status].to_s.upcase)
        details.concat(url_errors(attrs))
        raise ApiErrors::ValidationFailed.new(details) if details.any?

        now = Time.current
        @camera.update!(
          worker_status: attrs[:status].presence&.upcase || "RUNNING",
          last_heartbeat: now,
          control_api_base_url: attrs[:control_api_base_url].presence,
          signal_api_base_url: attrs[:signal_api_base_url].presence,
          signal_api_last_seen_at: attrs[:signal_api_base_url].present? ? now : @camera.signal_api_last_seen_at,
          provisioning_status: "READY",
          provisioning_status_error: nil
        )
        render json: { camera_id: @camera.id, status: @camera.worker_status.to_s.upcase,
                       online: @camera.online?, config_version: @camera.config_version }
      end

      private

      def authenticate_worker!
        expected = ENV["WORKER_API_KEY"].to_s
        provided = request.headers["X-Worker-Key"].to_s
        return if expected.present? && ActiveSupport::SecurityUtils.secure_compare(provided, expected)

        raise ApiErrors::ApiError.new("UNAUTHENTICATED", "Invalid worker key.", :unauthorized)
      end

      def load_camera
        @camera = Camera.find(params[:camera_id])
      end

      def url_errors(attrs)
        %i[control_api_base_url signal_api_base_url].filter_map do |field|
          value = attrs[field].to_s
          next if value.blank?

          uri = URI.parse(value)
          next if %w[http https].include?(uri.scheme) && uri.host.present?

          { field: field.to_s, message: "must be an absolute HTTP or HTTPS URL" }
        rescue URI::InvalidURIError
          { field: field.to_s, message: "must be an absolute HTTP or HTTPS URL" }
        end
      end
    end
  end
end
