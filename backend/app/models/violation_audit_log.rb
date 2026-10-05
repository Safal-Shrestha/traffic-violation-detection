# Append-only history of actions on a violation. The database trigger rejects
# UPDATE and DELETE; `readonly?` stops them earlier, inside Rails.
class ViolationAuditLog < ApplicationRecord
  self.table_name = "violation_audit_logs"

  belongs_to :violation, inverse_of: :audit_logs
  belongs_to :officer, optional: true, inverse_of: :audit_logs # NULL for system actions

  enum :action, {
    created: "CREATED", confirmed: "CONFIRMED", rejected: "REJECTED",
    reopened: "REOPENED", vehicle_linked: "VEHICLE_LINKED", vehicle_proposed: "VEHICLE_PROPOSED", vehicle_proposal_rejected: "VEHICLE_PROPOSAL_REJECTED", note_added: "NOTE_ADDED"
  }, validate: true

  scope :chronological, -> { order(:created_at, :id) }

  def readonly?
    persisted? || super
  end

  def self.record!(violation:, action:, officer: nil, notes: nil)
    create!(violation: violation, officer: officer, action: action, notes: notes.presence)
  end
end
