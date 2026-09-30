class CreateViolationTypes < ActiveRecord::Migration[8.1]
  def change
    create_table :violation_types, id: :smallserial do |t|
      t.string :code, limit: 30, null: false
      t.string :name, limit: 100, null: false
      t.text :description
      t.decimal :fine_amount_npr, precision: 10, scale: 2, null: false

      t.index :code, unique: true
      t.check_constraint "fine_amount_npr >= 0", name: "violation_types_fine_check"
    end
  end
end
