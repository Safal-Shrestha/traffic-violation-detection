module Api
  module V1
    class WorkerManagerController < BaseController
      before_action :authenticate_manager!

      def index
        cameras = Camera.where(provisioning_status: %w[REQUESTED ERROR]).order(:created_at)
        render json: { data: cameras.map { |camera| provisioning_payload(camera) } }
      end

      def claim
        camera = Camera.find(params[:camera_id])
        unless camera.provisioning_requested? || camera.provisioning_error?
          render json: { error: { code: "ALREADY_CLAIMED", message: "Camera is already being provisioned." } },
                 status: :conflict
          return
        end

        camera.update!(provisioning_status: "STARTING", provisioning_status_error: nil,
                       worker_status: "STARTING")
        render json: provisioning_payload(camera)
      end

      def failure
        camera = Camera.find(params[:camera_id])
        camera.update!(provisioning_status: "ERROR", provisioning_status_error: params[:message].to_s.truncate(500),
                       worker_status: "ERROR")
        render json: provisioning_payload(camera)
      end

      private

      def authenticate_manager!
        expected = ENV["WORKER_MANAGER_KEY"].to_s
        provided = request.headers["X-Worker-Manager-Key"].to_s
        return if expected.present? && ActiveSupport::SecurityUtils.secure_compare(provided, expected)

        raise ApiErrors::ApiError.new("UNAUTHENTICATED", "Invalid worker manager key.", :unauthorized)
      end

      def provisioning_payload(camera)
        {
          camera_id: camera.id, source_video: camera.source_video,
          raw_stream_key: camera.raw_stream_key, output_stream_key: camera.output_stream_key,
          signal_state_key: camera.signal_state_key, provisioning_status: camera.provisioning_status.to_s.upcase
        }
      end
    end
  end
end
