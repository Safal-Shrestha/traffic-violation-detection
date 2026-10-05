# Central fact table: one row per detected violation event.
# The worker generates `id` so retries are idempotent; duplicates raise
# ActiveRecord::RecordNotUnique (primary key or the dedup index).
class Violation < ApplicationRecord
  class InvalidTransition < StandardError; end

  belongs_to :camera,         inverse_of: :violations
  belongs_to :violation_type, inverse_of: :violations
  belongs_to :vehicle,        optional: true, inverse_of: :violations # NULL when the plate is unreadable
  belongs_to :reviewed_by,    class_name: "Officer", optional: true, inverse_of: :reviewed_violations

  has_many :evidence_items, class_name: "Evidence", inverse_of: :violation, dependent: :restrict_with_error
  has_many :audit_logs,     class_name: "ViolationAuditLog", inverse_of: :violation, dependent: :restrict_with_error
  accepts_nested_attributes_for :evidence_items

  STATUSES      = %w[PENDING CONFIRMED REJECTED].freeze
  SIGNAL_STATES = %w[RED YELLOW GREEN].freeze

  enum :status, STATUSES.to_h { |value| [ value.downcase.to_sym, value ] }, validate: true
  # Signal state at the moment of the event; NULL for signal-independent violation types.
  enum :signal_state, SIGNAL_STATES.to_h { |value| [ value.downcase.to_sym, value ] },
       prefix: :signal, validate: { allow_nil: true }

  validates :occurred_at, presence: true
  validates :detection_confidence, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }
  validates :plate_confidence, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }, allow_nil: true
  validates :detected_plate_raw, length: { maximum: 50 }, allow_nil: true
  # Every violation needs evidence. The DB cannot enforce a minimum child count, so the model does.
  validates :evidence_items, presence: { message: "must include at least one item" }, on: :create

  after_create :log_created

  scope :newest_first, -> { order(occurred_at: :desc) }
  scope :for_plate, lambda { |plate|
    joins(:vehicle).where(vehicles: { plate_number: Vehicle.normalize_plate(plate) })
  }

  def confirm!(officer, notes: nil)
    review!(:confirmed, officer, notes)
  end

  def reject!(officer, reason:)
    raise ArgumentError, "a rejection reason is required" if reason.blank?

    review!(:rejected, officer, reason)
  end

  # Sends a reviewed violation back to the queue; the previous reviewer fields are cleared.
  def reopen!(officer, notes: nil)
    raise ArgumentError, "officer is required" if officer.nil?

    with_lock do
      raise InvalidTransition, "only reviewed violations can be reopened" if pending?

      update!(status: :pending, reviewed_by: nil, reviewed_at: nil)
      audit_logs.create!(action: :reopened, officer: officer, notes: notes)
    end
  end

  # Manual correction of the matched vehicle (for example after an officer reads the plate).
  def link_vehicle!(vehicle, officer:)
    with_lock do
      update!(vehicle: vehicle)
      audit_logs.create!(action: :vehicle_linked, officer: officer, notes: "Linked to #{vehicle.plate_number}")
    end
  end

  private

  def review!(new_status, officer, notes)
    raise ArgumentError, "officer is required" if officer.nil?

    with_lock do # row lock: two officers cannot review the same violation concurrently
      raise InvalidTransition, "cannot mark a #{status} violation as #{new_status}" unless pending?

      update!(status: new_status, reviewed_by: officer, reviewed_at: Time.current)
      audit_logs.create!(action: new_status, officer: officer, notes: notes)
    end
  end

  def log_created
    audit_logs.create!(action: :created) # system action: no officer
  end
end
