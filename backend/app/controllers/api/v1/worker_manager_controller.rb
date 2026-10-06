module Api
  module V1
    class WorkerManagerController < BaseController
      before_action :authenticate_manager!

      def index
        cameras = Camera.where(provisioning_status: %w[REQUESTED ERROR])
                         .or(Camera.where(provisioning_status: "STARTING", updated_at: ...2.minutes.ago))
                         .or(Camera.where(provisioning_status: "READY", last_heartbeat: ...Camera::HEARTBEAT_TIMEOUT.ago))
                         .order(:created_at)
        used_videos = Camera.where.not(source_video: nil).pluck(:source_video)
        render json: { data: cameras.map { |camera| provisioning_payload(camera) },
                       available_videos: Camera::DEMO_SOURCE_VIDEOS - used_videos }
      end

      def claim
        camera = Camera.find(params[:camera_id])
        source_video = params[:source_video].to_s
        Camera.transaction do
          Camera.connection.execute("SELECT pg_advisory_xact_lock(71204, 1)")
          camera.lock!
          stale_start = camera.provisioning_starting? && camera.updated_at < 2.minutes.ago
          stale_worker = camera.provisioning_ready? &&
            (camera.last_heartbeat.nil? || camera.last_heartbeat < Camera::HEARTBEAT_TIMEOUT.ago)
          unless camera.provisioning_requested? || camera.provisioning_error? || stale_start || stale_worker
            raise ApiErrors::ApiError.new("ALREADY_CLAIMED", "Camera is already being provisioned.", :conflict)
          end
          if camera.source_video.present?
            source_video = camera.source_video
          elsif !Camera::DEMO_SOURCE_VIDEOS.include?(source_video) || Camera.where(source_video: source_video).where.not(id: camera.id).exists?
            raise ApiErrors::ApiError.new("SOURCE_VIDEO_UNAVAILABLE", "Selected demo video is unavailable.", :conflict)
          end
          camera.update!(source_video: source_video, provisioning_status: "STARTING",
                         provisioning_status_error: nil, worker_status: "STARTING")
        end
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
