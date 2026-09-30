class CreateVehicles < ActiveRecord::Migration[8.1]
  def change
    create_table :vehicles, id: :uuid do |t|
      t.string :plate_number, limit: 30, null: false
      t.string :province_code, limit: 10
      t.string :vehicle_category, limit: 30
      t.string :vehicle_type, limit: 30
      t.references :owner, type: :uuid, foreign_key: { on_delete: :nullify }
      t.timestamptz :created_at, null: false, default: -> { "now()" }

      t.index :plate_number, unique: true
    end
  end
end
