# Lookup table of detectable violations. Workers reference `code`, never the numeric id.
class ViolationType < ApplicationRecord
  has_many :violations, inverse_of: :violation_type, dependent: :restrict_with_error

  validates :code, presence: true, length: { maximum: 30 }, uniqueness: true,
                   format: { with: /\A[A-Z][A-Z0-9_]*\z/, message: "must be UPPER_SNAKE_CASE" }
  validates :name, presence: true, length: { maximum: 100 }
  validates :fine_amount_npr, numericality: { greater_than_or_equal_to: 0 }

  def self.by_code!(code)
    find_by!(code: code)
  end
end
