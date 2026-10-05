# Violation shapes from contract section 4.5 (list item and detail) and 4.4 (evidence).
class ViolationSerializer
  class << self
    def list(violation)
      {
        id: violation.id,
        camera: { id: violation.camera.id, name: violation.camera.name },
        violation_type: { code: violation.violation_type.code, name: violation.violation_type.name },
        occurred_at: ApiTime.iso(violation.occurred_at),
        status: violation.status.to_s.upcase,
        detected_plate_raw: violation.detected_plate_raw,
        plate_confidence: violation.plate_confidence&.to_f,
        vehicle: vehicle(violation.vehicle),
        vehicle_proposal_status: proposal_status(violation),
        thumbnail_url: nil
      }
    end

    def detail(violation)
      type = violation.violation_type
      list(violation).except(:thumbnail_url).merge(
        track_id: violation.track_id,
        session_id: violation.session_id,
        detection_confidence: violation.detection_confidence&.to_f,
        signal_state: violation.signal_state&.upcase,
        violation_type: { code: type.code, name: type.name, fine_amount_npr: format("%.2f", type.fine_amount_npr) },
        vehicle: vehicle(violation.vehicle, detailed: true),
        review: review(violation),
        vehicle_proposal: proposal(violation),
        metadata: violation.metadata,
        evidence: evidence_list(violation),
        created_at: ApiTime.iso(violation.created_at)
      )
    end

    def proposal(violation)
      metadata = violation.metadata
      metadata.is_a?(Hash) ? metadata["vehicle_proposal"] : nil
    end

    def proposal_status(violation)
      proposal(violation)&.dig("status")
    end

    private

    def vehicle(vehicle, detailed: false)
      return nil unless vehicle

      result = { id: vehicle.id, plate_number: vehicle.plate_number }
      return result unless detailed

      result.merge(province_code: vehicle.province_code, vehicle_category: vehicle.vehicle_category,
                   vehicle_type: vehicle.vehicle_type)
    end

    # The contract returns null while the violation is pending.
    def review(violation)
      reviewer = violation.reviewed_by
      return nil unless reviewer

      { reviewed_by: { id: reviewer.id, name: reviewer.name }, reviewed_at: ApiTime.iso(violation.reviewed_at) }
    end

    def evidence_list(violation)
      storage = EvidenceStorage.new
      expires_at = ApiTime.iso(Time.current + EvidenceStorage::PRESIGN_TTL)
      violation.evidence_items.map do |item|
        {
          id: item.id,
          violation_id: item.violation_id,
          media_type: item.media_type&.upcase,
          evidence_role: item.evidence_role&.upcase,
          storage_provider: item.storage_provider&.upcase,
          file_size_byte: item.file_size_byte,
          duration_seconds: item.duration_seconds&.to_f,
          checksum_sha256: item.checksum_sha256,
          download_url: storage.presign_view(storage_key: item.storage_key),
          expires_at: expires_at,
          created_at: ApiTime.iso(item.created_at)
        }
      end
    end
  end
end