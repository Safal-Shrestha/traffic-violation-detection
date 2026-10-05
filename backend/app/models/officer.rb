# Dashboard user: traffic officer or administrator.
# `password_hash` follows the ER diagram. `has_secure_password` expects `password_digest`,
# so either rename the column or hash passwords yourself (bcrypt/argon2) before assigning.
class Officer < ApplicationRecord
  extend Devise::Models

  ROLES = %w[ADMIN OFFICER].freeze

  enum :role, ROLES.to_h { |value| [ value.downcase.to_sym, value ] }, validates: true

  devise :database_authenticatable, :jwt_authenticatable,
         jwt_revocation_strategy: Devise::JWT::RevocationStrategies::Null

  alias_attribute :encrypted_password, :password_hash

  has_many :reviewed_violations, class_name: "Violation", foreign_key: :reviewed_by_id, inverse_of: :reviewed_by, dependent: :restrict_with_error
  has_many :audit_logs, class_name: "ViolationAuditLog", inverse_of: :officer, dependent: :restrict_with_error

  before_validation :normalize_email

  validates :name, presence: true, length: { maximum: 150 }
  validates :badge_number,  presence: true, length: { maximum: 30 }, uniqueness: true
  validates :email, presence: true, length: { maximum: 255 }, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }, uniqueness: { case_sensitive: false }
  validates :role, presence: true
  validates :password_hash, presence: true, on: :create

  def role
    super&.upcase
  end

  def admin?
    role == "ADMIN"
  end

  def officer?
    role == "OFFICER"
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase.presence
  end
end
