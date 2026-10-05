module Api
  module V1
    # Review actions from contract section 4.5. Each action updates the violation and
    # inserts exactly one audit row inside the same transaction.
    class ViolationReviewsController < BaseController
      before_action :authenticate_user!

      def confirm
        apply(audit_action: "CONFIRMED", from: %w[PENDING], to: "CONFIRMED", notes_required: false)
      end

      def reject
        apply(audit_action: "REJECTED", from: %w[PENDING], to: "REJECTED", notes_required: true)
      end

      def reopen
        apply(audit_action: "REOPENED", from: %w[CONFIRMED REJECTED], to: "PENDING", notes_required: true)
      end

      def notes
        apply(audit_action: "NOTE_ADDED", from: nil, to: nil, notes_required: true)
      end

      private

      def apply(audit_action:, from:, to:, notes_required:)
        notes = params[:notes].to_s.strip.presence
        if notes_required && notes.nil?
          raise ApiErrors::ValidationFailed.new([ { field: "notes", message: "can't be blank" } ])
        end

        violation = entry = nil
        Violation.transaction do
          # The row lock makes two officers acting on the same violation serialize,
          # so the second one receives INVALID_STATE_TRANSITION.
          violation = Violation.lock.find(params[:id])
          change_status!(violation, from, to) if to
          entry = ViolationAuditLog.record!(violation: violation, officer: current_officer,
                                            action: audit_action, notes: notes)
        end

        RealtimeBroadcaster.violation_updated(violation, entry)
        render json: { violation: ViolationSerializer.detail(violation),
                       audit_entry: AuditEntrySerializer.call(entry) }
      end

      def change_status!(violation, from, to)
        current = violation.status.to_s.upcase
        unless from.include?(current)
          raise ApiErrors::ApiError.new("INVALID_STATE_TRANSITION",
                                        "A #{current} violation cannot move to #{to}.", :conflict)
        end

        if to == "PENDING"
          violation.reviewed_by = nil
          violation.reviewed_at = nil
        else
          violation.reviewed_by = current_officer
          violation.reviewed_at = Time.current
        end
        violation.status = to
        violation.save!
      end
    end
  end
end
