class AuditEntrySerializer
  def self.call(entry)
    {
      action: entry.action.to_s.upcase,
      created_at: entry.created_at,
      id: entry.id,
      notes: entry.notes,
      officer: entry.officer && { id: entry.officer.id, name: entry.officer.name },
      violation_id: entry.violation_id
    }
  end
end
