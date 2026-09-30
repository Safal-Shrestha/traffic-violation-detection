# Seed data for violation_types (MVP set). Idempotent; uses raw SQL so it works before models exist.
# TODO: replace the placeholder fine amounts (0) with the official NPR figures before use.
ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO violation_types (code, name, description, fine_amount_npr) VALUES
    ('RED_LIGHT', 'Red Light Violation', 'Vehicle crossed the stop line while the signal was red, after the grace period.', 50),
    ('STOP_LINE', 'Stop Line Violation', 'Vehicle stopped beyond the stop line or encroached past it.', 1000),
    ('NO_HELMET', 'Helmet Violation',    'Two-wheeler rider detected without a helmet.', 5000)
  ON CONFLICT (code) DO NOTHING;
SQL
