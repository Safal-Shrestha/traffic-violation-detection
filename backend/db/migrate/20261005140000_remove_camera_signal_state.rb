class RemoveCameraSignalState < ActiveRecord::Migration[8.1]
  def change
    remove_column :cameras, :signal_state, :string
    remove_column :cameras, :signal_updated_at, :timestamptz
  end
end
