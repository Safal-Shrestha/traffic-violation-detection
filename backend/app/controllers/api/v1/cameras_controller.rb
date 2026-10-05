module Api
  module V1
    class CamerasController < BaseController
      CAMERA_STATUSES = %w[ACTIVE INACTIVE MAINTENANCE].freeze
      WORKER_STATUSES = %w[STOPPED STARTING RUNNING ERROR].freeze
      CALIBRATION_STATUSES = %w[AWAITING_WORKER AWAITING_CALIBRATION CALIBRATED].freeze
      CONFIG_ONLY_FIELDS = %w[stop_line red_grace_seconds frame_width frame_height config_version].freeze

      before_action :authenticate_user!
      before_action :require_admin!, only: %i[create update]
      before_action :load_camera, only: %i[show update]
      before_action :reject_config_only_fields!, only: :update

      def index
        scope = Camera.all
        scope = scope.where(status: validated_filter(:status, CAMERA_STATUSES)) if params[:status].present?
        scope = scope.where(worker_status: validated_filter(:worker_status, WORKER_STATUSES)) if params[:worker_status].present?
        scope = scope.where(district: params[:district]) if params[:district].present?
        scope = scope.where(municipality: params[:municipality]) if params[:municipality].present?
        if params[:calibration_status].present?
          scope = filter_by_calibration(scope, validated_filter(:calibration_status, CALIBRATION_STATUSES))
        end

        rows, page = paginate(scope)
        render json: { data: rows.map { |camera| CameraSerializer.call(camera) }, page: page }
      end

      def show
        render json: CameraSerializer.call(@camera)
      end

      # Registers the camera and its worker record in one transaction (contract 4.2).
      def create
        attrs = camera_params
        details = validation_details(attrs)
        raise ApiErrors::ValidationFailed.new(details) if details.any?

        id = SecureRandom.uuid
        camera = Camera.new(
          id: id,
          name: attrs[:name].to_s.strip,
          district: attrs[:district],
          municipality: attrs[:municipality],
          installed_at: parsed_date(attrs[:installed_at]),
          status: attrs[:status].presence || "ACTIVE",
          raw_stream_key: attrs[:raw_stream_key].to_s.strip.presence || "live/#{id}_in",
          output_stream_key: "live/#{id}_out",
          signal_state_key: "camera_signal_#{id}",
          worker_status: "STOPPED",
          config_version: 1,
          red_grace_seconds: 0,
          signal_state: "RED",
          signal_updated_at: Time.current
        )
        Camera.transaction { camera.save! }
        render json: CameraSerializer.call(camera), status: :created
      rescue ActiveRecord::RecordNotUnique
        raise ApiErrors::ValidationFailed.new([ { field: "raw_stream_key", message: "has already been taken" } ])
      end

      # Changing status or raw_stream_key increments config_version so the worker notices.
      def update
        attrs = camera_params
        details = validation_details(attrs, camera: @camera)
        raise ApiErrors::ValidationFailed.new(details) if details.any?

        %i[name district municipality raw_stream_key].each do |field|
          @camera[field] = attrs[field].to_s.strip if attrs.key?(field)
        end
        @camera.status = attrs[:status] if attrs[:status].present?
        @camera.installed_at = parsed_date(attrs[:installed_at]) if attrs.key?(:installed_at)
        @camera.config_version += 1 if @camera.status_changed? || @camera.raw_stream_key_changed?

        @camera.save!
        render json: CameraSerializer.call(@camera)
      rescue ActiveRecord::RecordNotUnique
        raise ApiErrors::ValidationFailed.new([ { field: "raw_stream_key", message: "has already been taken" } ])
      end

      private

      def camera_params
        params.permit(:name, :district, :municipality, :installed_at, :raw_stream_key, :status)
      end

      def load_camera
        @camera = Camera.find(params[:id])
      end

      # Geometry and grace period change only through PUT /cameras/{id}/config.
      def reject_config_only_fields!
        details = CONFIG_ONLY_FIELDS.select { |field| params.key?(field) }.map do |field|
          { field: field, message: "can only be changed through PUT /cameras/{id}/config" }
        end
        raise ApiErrors::ValidationFailed.new(details) if details.any?
      end

      def validation_details(attrs, camera: nil)
        details = []
        if (camera.nil? || attrs.key?(:name)) && attrs[:name].to_s.strip.empty?
          details << { field: "name", message: "can't be blank" }
        end
        if attrs[:status].present? && !CAMERA_STATUSES.include?(attrs[:status])
          details << { field: "status", message: "must be one of #{CAMERA_STATUSES.join(', ')}" }
        end
        if attrs[:installed_at].present? && parsed_date(attrs[:installed_at]).nil?
          details << { field: "installed_at", message: "must be a date (YYYY-MM-DD)" }
        end
        details.concat(raw_stream_key_details(attrs, camera))
      end

      def raw_stream_key_details(attrs, camera)
        return [] unless camera ? attrs.key?(:raw_stream_key) : attrs[:raw_stream_key].present?

        key = attrs[:raw_stream_key].to_s.strip
        return [ { field: "raw_stream_key", message: "can't be blank" } ] if key.empty?

        taken = Camera.where(raw_stream_key: key).where.not(id: camera&.id).exists?
        taken ? [ { field: "raw_stream_key", message: "has already been taken" } ] : []
      end

      def parsed_date(value)
        return nil if value.blank?

        Date.iso8601(value.to_s)
      rescue ArgumentError
        nil
      end

      def validated_filter(name, allowed)
        value = params[name].to_s.upcase
        return value if allowed.include?(value)

        raise ApiErrors::ValidationFailed.new([ { field: name.to_s, message: "must be one of #{allowed.join(', ')}" } ])
      end

      # calibration.status is derived (contract 4.3.1), so uncalibrated cameras are
      # resolved against the stored reference frame, then paginated as a normal relation.
      def filter_by_calibration(scope, wanted)
        return scope.where.not(stop_line: nil) if wanted == "CALIBRATED"

        ids = scope.where(stop_line: nil).select do |camera|
          CameraSerializer.calibration_status(camera, ReferenceFrame.exist?(camera.id)) == wanted
        end.map(&:id)
        scope.where(id: ids)
      end
    end
  end
end
