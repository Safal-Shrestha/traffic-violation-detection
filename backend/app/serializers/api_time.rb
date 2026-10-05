# ISO 8601, UTC, millisecond precision (contract section 1).
module ApiTime
  def self.iso(time)
    time&.utc&.iso8601(3)
  end
end