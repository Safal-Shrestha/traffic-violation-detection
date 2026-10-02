# Dashboard user: traffic officer or administrator.
# `password_hash` follows the ER diagram. `has_secure_password` expects `password_digest`,
# so either rename the column or hash passwords yourself (bcrypt/argon2) before assigning.
class Officer < ApplicationRecord
  enum :role, { admin: "ADMIN", officer: "OFFICER" }, validate: true

  has_many :reviewed_violations, class_name: "Violation", foreign_key: :reviewed_by_id,
                                 inverse_of: :reviewed_by, dependent: :restrict_with_error
  has_many :audit_logs, class_name: "ViolationAuditLog",
                        inverse_of: :officer, dependent: :restrict_with_error

  before_validation :normalize_email

  validates :name,          presence: true, length: { maximum: 150 }
  validates :badge_number,  presence: true, length: { maximum: 30 }, uniqueness: true
  validates :email,         presence: true, length: { maximum: 255 },
                            format: { with: URI::MailTo::EMAIL_REGEXP },
                            uniqueness: { case_sensitive: false }
  validates :password_hash, presence: true

  private

  def normalize_email
    self.email = email.to_s.strip.downcase.presence
  end
end
