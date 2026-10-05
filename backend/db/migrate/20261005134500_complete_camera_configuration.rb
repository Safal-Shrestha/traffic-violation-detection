class CompleteCameraConfiguration < ActiveRecord::Migration[8.1]
  def change
    add_column :cameras, :signal_state, :string, limit: 10, default: "RED"
    add_column :cameras, :config_version, :integer, null: false, default: 1

    remove_check_constraint :cameras, name: "cameras_stop_line_requires_frame"
  end
end
