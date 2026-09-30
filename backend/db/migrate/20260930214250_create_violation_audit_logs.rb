class CreateViolationAuditLogs < ActiveRecord::Migration[8.1]
  def up
    create_table :violation_audit_logs do |t|
      t.references :violation, type: :uuid, null: false, index: false, foreign_key: { on_delete: :restrict }
      t.references :officer, type: :uuid, foreign_key: { on_delete: :restrict } # NULL for system actions
      t.string :action, limit: 30, null: false
      t.text :notes
      t.timestamptz :created_at, null: false, default: -> { "now()" }

      t.index [ :violation_id, :created_at ], name: "idx_violation_audit_violation_created"
      t.check_constraint "action IN ('CREATED', 'CONFIRMED', 'REJECTED', 'REOPENED', 'VEHICLE_LINKED', 'NOTE_ADDED')", name: "violation_audit_logs_action_check"
    end

    # Enforce append-only at the database level.
    execute <<~SQL
      CREATE FUNCTION violation_audit_logs_immutable() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'violation_audit_logs is append-only (% not allowed)', TG_OP;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_violation_audit_logs_immutable
        BEFORE UPDATE OR DELETE ON violation_audit_logs
        FOR EACH ROW EXECUTE FUNCTION violation_audit_logs_immutable();
    SQL
  end

  def down
    drop_table :violation_audit_logs
    execute "DROP FUNCTION IF EXISTS violation_audit_logs_immutable();"
  end
end
