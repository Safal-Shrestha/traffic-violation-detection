module Api
  module V1
    class EvidenceController < ApplicationController
      def presign
        request_data = presign_params
        camera = Camera.find(request_data[:camera_id])
        render_error("CAMERA_INACTIVE", "Camera is not active.", :conflict) and return unless camera.active?

        items = request_data[:items].map do |item|
          role = item[:evidence_role].to_s.upcase
          media_type = item[:media_type].to_s.upcase
          content_type = item[:content_type]
          validate_presign_item!(role, media_type, content_type, item[:file_size_byte].to_i)

          storage_key = evidence_key(camera.id, request_data[:violation_id], role, content_type)
          {
            evidence_role: role,
            media_type: media_type,
            storage_provider: "MINIO",
            storage_key: storage_key,
            method: "PUT",
            upload_url: storage.presign_upload(storage_key: storage_key, content_type: content_type),
            headers: { "Content-Type" => content_type },
            expires_at: (Time.current + EvidenceStorage::PRESIGN_TTL).iso8601(3)
          }
        end

        render json: { items: items }
      rescue ActiveRecord::RecordNotFound
        render_error("CAMERA_NOT_FOUND", "Camera was not found.", :not_found)
      rescue ArgumentError => error
        render_error("VALIDATION_FAILED", error.message, :unprocessable_entity)
      end

      def show
        render json: evidence_json(Evidence.find(params[:id]))
      rescue ActiveRecord::RecordNotFound
        render_error("EVIDENCE_NOT_FOUND", "Evidence was not found.", :not_found)
      end

      def read_only
        render_error("READ_ONLY_RESOURCE", "Evidence cannot be modified or deleted.", :method_not_allowed)
      end

      def get_not_allowed
        render_error("METHOD_NOT_ALLOWED", "GET method is forbidden for this resource", :method_not_allowed)
      end

      private

      def storage
        @storage ||= EvidenceStorage.new
      end

      def presign_params
        params.permit(
          :camera_id,
          :violation_id,
          items: %i[evidence_role media_type content_type file_size_byte]
        ).tap do |permitted|
          raise ArgumentError, "camera_id is required" if permitted[:camera_id].blank?
          raise ArgumentError, "violation_id is required" if permitted[:violation_id].blank?
          raise ArgumentError, "at least one evidence item is required" if permitted[:items].blank?
        end
      end

      def validate_presign_item!(role, media_type, content_type, file_size)
        expected_type = role == "CLIP" ? "VIDEO" : "IMAGE"
        raise ArgumentError, "#{role} must be #{expected_type}" unless media_type == expected_type
        raise ArgumentError, "content_type does not match media type" unless content_type.start_with?("#{media_type.downcase}/")

        limit = media_type == "VIDEO" ? Evidence::VIDEO_MAX_BYTES : Evidence::IMAGE_MAX_BYTES
        raise ArgumentError, "file_size_byte must be between 0 and #{limit}" unless file_size.between?(0, limit)
      end

      def evidence_key(camera_id, violation_id, role, content_type)
        extension = content_type.split("/", 2).last
        "violations/#{camera_id}/#{Time.current.utc.strftime('%Y/%m')}/#{violation_id}/#{role.downcase}.#{extension}"
      end

      def evidence_json(evidence)
        evidence.as_json(
          only: %i[id violation_id media_type evidence_role storage_provider
                   content_type file_size_byte duration_seconds checksum_sha256 created_at]
        ).merge(
          "media_type" => evidence.media_type&.upcase,
          "evidence_role" => evidence.evidence_role&.upcase,
          "storage_provider" => evidence.storage_provider&.upcase,
          "media_url" => storage.presign_view(storage_key: evidence.storage_key),
          "expires_at" => (Time.current + EvidenceStorage::PRESIGN_TTL).iso8601(3)
        )
      end

      def render_error(code, message, status)
        render json: { error: { code: code, message: message, request_id: request.request_id } }, status: status
      end
    end
  end
end
