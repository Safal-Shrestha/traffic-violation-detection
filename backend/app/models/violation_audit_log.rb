# Append-only history of actions on a violation. The database trigger rejects
# UPDATE and DELETE; `readonly?` stops them earlier, inside Rails.
class ViolationAuditLog < ApplicationRecord
  belongs_to :violation, inverse_of: :audit_logs
  belongs_to :officer, optional: true, inverse_of: :audit_logs # NULL for system actions

  enum :action, {
    created: "CREATED", confirmed: "CONFIRMED", rejected: "REJECTED",
    reopened: "REOPENED", vehicle_linked: "VEHICLE_LINKED", note_added: "NOTE_ADDED"
  }, validate: true

  scope :chronological, -> { order(:created_at, :id) }

  def readonly?
    persisted? || super
  end
end
