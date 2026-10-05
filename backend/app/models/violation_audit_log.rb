# Append-only history of actions on a violation. The database trigger rejects
# UPDATE and DELETE; `readonly?` stops them earlier, inside Rails.
class ViolationAuditLog < ApplicationRecord
  self.table_name = "violation_audit_logs"

  ACTIONS = %w[CREATED CONFIRMED REJECTED REOPENED VEHICLE_LINKED VEHICLE_PROPOSED VEHICLE_PROPOASL_REJECTED NOTE_ADDED]

  belongs_to :violation, inverse_of: :audit_logs
  belongs_to :officer, optional: true, inverse_of: :audit_logs # NULL for system actions

  validates :action, inclusion: { in: ACTIONS }

  scope :chronological, -> { order(:created_at, :id) }

  def readonly?
    persisted? || super
  end

  def self.record!(violation:, action:, officer: nil, notes: nil)
    create!(violation: violation, officer: officer, action: action, notes: notes.presence)
  end
end
