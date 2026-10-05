module Api
  module V1
    class ViolationsController < BaseController
      def index
        violations = filtered_violations
        render json: {
          data: violations.map { |violation| violation_json(violation, list: true) },
          page: { next_cursor: nil, has_more: false }
        }
      end

      def show
        render json: violation_json(Violation.includes(:camera, :violation_type, :vehicle, :evidence_items).find(params[:id]))
      rescue ActiveRecord::RecordNotFound
        render_error("VIOLATION_NOT_FOUND", "Violation was not found.", :not_found)
      end

      def create
        if (existing = Violation.find_by(id: permitted_violation[:id]))
          return render json: violation_json(existing), status: :ok
        end

        violation = build_violation
        Violation.transaction do
          verify_evidence_objects!(violation.evidence_items)
          violation.save!
        end
        RealtimeBroadcaster.violation_created(violation)

        render json: violation_json(violation), status: :created
      rescue ActiveRecord::RecordInvalid => error
        render_error(
          error.record.errors.of_kind?(:evidence_items, :blank) ? "EVIDENCE_REQUIRED" : "VALIDATION_FAILED",
          "Request body failed validation.",
          :unprocessable_entity,
          error.record.errors.to_hash
        )
      rescue ActiveRecord::RecordNotFound
        render_error("REFERENCE_NOT_FOUND", "A referenced camera or violation type was not found.", :not_found)
      rescue ActiveRecord::RecordNotUnique
        render_error("DUPLICATE_TRACK_EVENT", "This violation was already recorded for the worker session.", :conflict)
      rescue EvidenceStorage::ObjectNotFound
        render_error("EVIDENCE_OBJECT_MISSING", "An evidence object was not found in storage.", :unprocessable_entity)
      rescue ArgumentError => error
        render_error("EVIDENCE_OBJECT_MISSING", error.message, :unprocessable_entity)
      end

      def evidence
        violation = Violation.find(params[:id])
        render json: { evidence: violation.evidence_items.map { |item| evidence_json(item) } }
      rescue ActiveRecord::RecordNotFound
        render_error("VIOLATION_NOT_FOUND", "Violation was not found.", :not_found)
      end

      private

      def build_violation
        attrs = permitted_violation.except(:violation_type_code, :evidence, :id)
        attrs[:id] = permitted_violation[:id] if permitted_violation[:id].present?
        attrs[:violation_type] = ViolationType.by_code!(permitted_violation[:violation_type_code]) if permitted_violation[:violation_type_code].present?

        camera = Camera.find(attrs[:camera_id])
        raise ActiveRecord::RecordInvalid.new(camera) unless camera.active?

        attrs[:vehicle] = Vehicle.find_by(plate_number: Vehicle.normalize_plate(attrs[:detected_plate_raw])) if attrs[:detected_plate_raw].present?
        violation = Violation.new(attrs)
        attach_evidence!(violation)
        violation
      end

      def permitted_violation
        params.require(:violation).permit(
          :id, :camera_id, :violation_type_id, :violation_type_code, :vehicle_id, :track_id, :session_id,
          :detected_plate_raw, :plate_confidence, :detection_confidence,
          :occurred_at, :signal_state, :status, metadata: {},
          evidence: %i[evidence_role media_type content_type storage_provider storage_key
                       file_size_byte duration_seconds checksum_sha256]
        )
      end

      def attach_evidence!(violation)
        (permitted_violation[:evidence] || []).each do |item|
          violation.evidence_items.build(item)
        end
      end

      def verify_evidence_objects!(items)
        storage = EvidenceStorage.new
        items.each do |item|
          storage.verify_object!(
            storage_key: item.storage_key,
            file_size_byte: item.file_size_byte,
            content_type: item.content_type
          )
        end
      end

      def filtered_violations
        violations = Violation.includes(:camera, :violation_type, :vehicle).newest_first
        violations = violations.where(status: params[:status].to_s.split(",")) if params[:status].present?
        violations = violations.where(camera_id: params[:camera_id]) if params[:camera_id].present?
        violations = violations.where(vehicle_id: params[:vehicle_id]) if params[:vehicle_id].present?
        violations = violations.where(violation_type: { code: params[:violation_type] }) if params[:violation_type].present?
        violations = violations.where("occurred_at >= ?", params[:from]) if params[:from].present?
        violations = violations.where("occurred_at <= ?", params[:to]) if params[:to].present?

        if params[:has_vehicle].to_s == "true"
          violations = violations.where.not(vehicle_id: nil)
        elsif params[:has_vehicle].to_s == "false"
          violations = violations.where(vehicle_id: nil)
        end

        if params[:plate].present?
          plate = Vehicle.normalize_plate(params[:plate])
          violations = violations.left_joins(:vehicle).where(
            "vehicles.plate_number ILIKE :plate OR violations.detected_plate_raw ILIKE :plate",
            plate: "%#{ActiveRecord::Base.sanitize_sql_like(plate)}%"
          )
        end

        params[:sort].to_s == "occurred_at" ? violations.reorder(occurred_at: :asc) : violations
      end

      def violation_json(violation, list: false)
        result = {
          id: violation.id,
          camera: { id: violation.camera.id, name: violation.camera.name },
          violation_type: {
            code: violation.violation_type.code,
            name: violation.violation_type.name
          },
          occurred_at: violation.occurred_at,
          status: violation.status&.upcase,
          detected_plate_raw: violation.detected_plate_raw,
          plate_confidence: violation.plate_confidence,
          vehicle: vehicle_json(violation.vehicle),
          vehicle_proposal_status: nil
        }
        return result.merge("thumbnail_url" => thumbnail_url(violation)) if list

        result.merge(
          track_id: violation.track_id,
          session_id: violation.session_id,
          detection_confidence: violation.detection_confidence,
          signal_state: violation.signal_state&.upcase,
          violation_type: result[:violation_type].merge(fine_amount_npr: violation.violation_type.fine_amount_npr),
          review: review_json(violation),
          vehicle: vehicle_json(violation.vehicle, detailed: true),
          metadata: violation.metadata,
          evidence: violation.evidence_items.map { |item| evidence_json(item) },
          created_at: violation.created_at
        )
      end

      def vehicle_json(vehicle, detailed: false)
        return unless vehicle

        result = { id: vehicle.id, plate_number: vehicle.plate_number }
        result.merge(
          province_code: vehicle.province_code,
          vehicle_category: vehicle.vehicle_category,
          vehicle_type: vehicle.vehicle_type
        ) if detailed
        result
      end

      def review_json(violation)
        return { reviewed_by: nil, reviewed_at: nil } unless violation.reviewed_by

        {
          reviewed_by: { id: violation.reviewed_by.id, name: violation.reviewed_by.name },
          reviewed_at: violation.reviewed_at
        }
      end

      def thumbnail_url(violation)
        return unless params[:include].to_s.split(",").include?("thumbnail")

        evidence = violation.evidence_items.find { |item| item.full_frame? }
        evidence && evidence_json(evidence)[:media_url]
      end

      def evidence_json(evidence)
        {
          id: evidence.id,
          violation_id: evidence.violation_id,
          media_type: evidence.media_type&.upcase,
          evidence_role: evidence.evidence_role&.upcase,
          storage_provider: evidence.storage_provider&.upcase,
          content_type: evidence.content_type,
          file_size_byte: evidence.file_size_byte,
          duration_seconds: evidence.duration_seconds,
          checksum_sha256: evidence.checksum_sha256,
          media_url: EvidenceStorage.new.presign_view(storage_key: evidence.storage_key),
          expires_at: (Time.current + EvidenceStorage::PRESIGN_TTL).iso8601(3),
          created_at: evidence.created_at
        }
      end

      def render_error(code, message, status, details = nil)
        error = { code: code, message: message, request_id: request.request_id }
        error[:details] = details if details
        render json: { error: error }, status: status
      end
    end
  end
end
