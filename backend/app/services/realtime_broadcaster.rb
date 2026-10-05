# Action Cable broadcasts. Delivery is best-effort, so a broadcast failure never fails the request.
module RealtimeBroadcaster
  module_function

  def violation_created(violation)
    broadcast("violations", "violation.created", ViolationSerializer.list(violation))
  end

  def violation_updated(violation, audit_entry)
    broadcast("violations", "violation.updated",
              id: violation.id,
              status: violation.status.to_s.upcase,
              vehicle_id: violation.vehicle_id,
              vehicle_proposal_status: ViolationSerializer.proposal_status(violation),
              reviewed_by: violation.reviewed_by&.id,
              reviewed_at: ApiTime.iso(violation.reviewed_at),
              audit_entry_id: audit_entry.id)
  end

  def broadcast(stream, type, data)
    ActionCable.server.broadcast(stream, { type: type, data: data })
  rescue StandardError => e
    Rails.logger.warn("Broadcast #{type} failed: #{e.class}: #{e.message}")
  end
end