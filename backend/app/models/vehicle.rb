# Vehicle registry keyed by normalized plate. Created when a violation is recorded,
# so a vehicle can exist without an owner.
class Vehicle < ApplicationRecord
  belongs_to :owner, optional: true, inverse_of: :vehicles
  has_many :violations, inverse_of: :vehicle, dependent: :restrict_with_error

  before_validation { self.plate_number = self.class.normalize_plate(plate_number) }

  validates :plate_number,     presence: true, length: { maximum: 30 }, uniqueness: true
  validates :province_code,    length: { maximum: 10 }, allow_nil: true
  validates :vehicle_category, length: { maximum: 30 }, allow_nil: true
  validates :vehicle_type,     length: { maximum: 30 }, allow_nil: true

  # Replaces the removed Total_Violation column. Use the scope to avoid N+1 counts in lists.
  scope :with_confirmed_violation_count, lambda {
    select(<<~SQL.squish)
      vehicles.*,
      (SELECT COUNT(*) FROM violations
        WHERE violations.vehicle_id = vehicles.id AND violations.status = 'CONFIRMED') AS confirmed_violations_count
    SQL
  }

  # PLACEHOLDER normalization. Replace it once the team decides the plate script
  # (Devanagari or Latin) and the exact format; the unique index depends on this method.
  def self.normalize_plate(raw)
    raw.to_s.unicode_normalize(:nfc).gsub(/\s+/, " ").strip.upcase
  end

  # Find-or-create that is safe under concurrent workers. The unique index is the final
  # arbiter. `create_or_find_by!` is avoided because it runs the uniqueness validation
  # first, which raises RecordInvalid before the index is consulted.
  def self.for_plate!(raw)
    plate = normalize_plate(raw)
    find_by(plate_number: plate) || create!(plate_number: plate)
  rescue ActiveRecord::RecordNotUnique
    find_by!(plate_number: plate) # another worker inserted it between our find and create
  rescue ActiveRecord::RecordInvalid => e
    raise unless e.record.errors.of_kind?(:plate_number, :taken)

    find_by!(plate_number: plate)
  end

  def confirmed_violation_count
    violations.confirmed.count
  end
end
