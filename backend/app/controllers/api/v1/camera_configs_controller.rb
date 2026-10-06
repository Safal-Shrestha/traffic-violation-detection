module Api
  module V1
    class CameraConfigsController < BaseController
      def show
        authenticate_worker_or_admin!
        camera = Camera.find(params[:camera_id])
        render json: config_payload(camera)
      end

      def update
        authenticate_user!
        require_admin!
        camera = Camera.find(params[:camera_id])
        expected = params[:expected_config_version].to_i
        if expected != camera.config_version
          raise ApiErrors::ApiError.new("CONFIG_VERSION_CONFLICT", "Camera configuration changed; reload it.", :conflict)
        end

        camera.assign_attributes(
          stop_line: params.require(:stop_line).permit(:approach_side, p1: %i[x y], p2: %i[x y]).to_h,
          frame_width: params.require(:frame_width), frame_height: params.require(:frame_height),
          red_grace_seconds: params.fetch(:red_grace_seconds, camera.red_grace_seconds)
        )
        camera.config_version += 1
        camera.save!
        render json: config_payload(camera)
      end

      private

      def authenticate_worker!
        expected = ENV["WORKER_API_KEY"].to_s
        provided = request.headers["X-Worker-Key"].to_s
        return if expected.present? && ActiveSupport::SecurityUtils.secure_compare(provided, expected)

        raise ApiErrors::ApiError.new("UNAUTHENTICATED", "Invalid worker key.", :unauthorized)
      end

      # Workers read their config with the worker key. The calibration UI reads
      # the same payload as an authenticated administrator.
      def authenticate_worker_or_admin!
        expected = ENV["WORKER_API_KEY"].to_s
        provided = request.headers["X-Worker-Key"].to_s
        return if expected.present? && ActiveSupport::SecurityUtils.secure_compare(provided, expected)

        authenticate_user!
        require_admin!
      end

      def config_payload(camera)
        { camera_id: camera.id, status: camera.status.to_s.upcase,
          config_version: camera.config_version, stop_line: camera.stop_line,
          frame_width: camera.frame_width, frame_height: camera.frame_height,
          red_grace_seconds: camera.red_grace_seconds.to_f }
      end
    end
  end
end
