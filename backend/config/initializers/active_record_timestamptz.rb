# Make `t.datetime` / `t.timestamps` create timestamptz columns in future migrations.
# (The migrations in this project already use t.timestamptz explicitly.)
ActiveSupport.on_load(:active_record_postgresqladapter) do
  self.datetime_type = :timestamptz
end
