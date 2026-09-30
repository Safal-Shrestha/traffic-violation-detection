class CreateOwners < ActiveRecord::Migration[8.1]
  def change
    create_table :owners, id: :uuid do |t|
      t.string :name, limit: 150, null: false
      t.string :email, limit: 255
      t.string :phone_number, limit: 20
      t.string :license_number, limit: 50
      
      t.index :email, unique: true
    end
  end
end
