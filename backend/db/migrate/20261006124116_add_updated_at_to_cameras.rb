class AddUpdatedAtToCameras < ActiveRecord::Migration[8.1]
  def change
    add_column :cameras, :updated_at, :datetime
  end
end
