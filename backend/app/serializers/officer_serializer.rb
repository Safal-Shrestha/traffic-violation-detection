class OfficerSerializer
  def self.call(officer)
    {
      id: officer.id,
      name: officer.name,
      badge_number: officer.badge_number,
      role: officer.role.to_s.upcase,
      email: officer.email
    }
  end
end
