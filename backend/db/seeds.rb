# Seed data for violation_types (MVP set). Idempotent; uses raw SQL so it works before models exist.
# TODO: replace the placeholder fine amounts (0) with the official NPR figures before use.
ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO violation_types (code, name, description, fine_amount_npr) VALUES
    ('RED_LIGHT', 'Red Light Violation', 'Vehicle crossed the stop line while the signal was red, after the grace period.', 50),
    ('STOP_LINE', 'Stop Line Violation', 'Vehicle stopped beyond the stop line or encroached past it.', 1000),
    ('NO_HELMET', 'Helmet Violation',    'Two-wheeler rider detected without a helmet.', 5000)
  ON CONFLICT (code) DO NOTHING;
SQL

# Bootstrap the first administrator when credentials are explicitly supplied.
# Subsequent admins must be created through the authenticated admin API.
admin_attributes = {
  name: ENV["ADMIN_NAME"],
  badge_number: ENV["ADMIN_BADGE_NUMBER"],
  email: ENV["ADMIN_EMAIL"],
  password: ENV["ADMIN_PASSWORD"],
  role: "ADMIN"
}

if admin_attributes.values_at(:name, :badge_number, :email, :password).all?(&:present?)
  email = admin_attributes[:email].strip.downcase
  existing_admin = Officer.find_by(email: email)

  if existing_admin
    raise "ADMIN_EMAIL belongs to a non-admin officer" unless existing_admin.admin?
  else
    Officer.create!(admin_attributes.merge(email: email))
  end
end
