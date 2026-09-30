class CreateOfficers < ActiveRecord::Migration[8.1]
  def change
    create_table :officers, id: :uuid do |t|
      t.string :name, limit: 150, null: false
      t.string :badge_number, limit: 30, null: false
      t.string :role, limit: 20, null: false
      t.string :email, limit: 255, null: false
      t.string :password_hash, limit: 255, null: false
      t.timestamptz :created_at, null: false, default: -> { "now()" }

      t.index :badge_number, unique: true
      t.index :email, unique: true
      t.check_constraint "role IN ('ADMIN', 'OFFICER')", name: "officers_role_check"
    end
  end
end
