# Registered vehicle owner. Contains personal data: restrict who can read it.
class Owner < ApplicationRecord
  has_many :vehicles, inverse_of: :owner, dependent: :nullify # mirrors the FK's ON DELETE SET NULL

  before_validation :normalize_blank_fields

  validates :name,           presence: true, length: { maximum: 150 }
  validates :email,          length: { maximum: 255 },
                             format: { with: URI::MailTo::EMAIL_REGEXP },
                             uniqueness: { case_sensitive: false },
                             allow_nil: true
  validates :phone_number,   length: { maximum: 20 }, allow_nil: true
  validates :license_number, length: { maximum: 50 }, allow_nil: true

  private

  # The unique index on email treats '' as a value, so blanks must be stored as NULL.
  def normalize_blank_fields
    self.email          = email.to_s.strip.downcase.presence
    self.phone_number   = phone_number.to_s.strip.presence
    self.license_number = license_number.to_s.strip.presence
  end
end
