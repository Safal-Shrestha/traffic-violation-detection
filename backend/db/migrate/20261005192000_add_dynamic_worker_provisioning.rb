class AddDynamicWorkerProvisioning < ActiveRecord::Migration[8.1]
  def change
    add_column :cameras, :source_video, :string, limit: 255
    add_column :cameras, :provisioning_status, :string, limit: 20, null: false, default: "REQUESTED"
    add_column :cameras, :provisioning_status_error, :string, limit: 500
    add_column :cameras, :control_api_base_url, :string, limit: 500
    add_column :cameras, :signal_api_base_url, :string, limit: 500
    add_column :cameras, :signal_api_last_seen_at, :timestamptz

    add_check_constraint :cameras,
                         "provisioning_status IN ('REQUESTED', 'STARTING', 'READY', 'ERROR')",
                         name: "cameras_provisioning_status_check"
  end
end
