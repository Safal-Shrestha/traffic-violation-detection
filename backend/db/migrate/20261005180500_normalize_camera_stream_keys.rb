class NormalizeCameraStreamKeys < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL
      UPDATE cameras
      SET raw_stream_key = id::text || '-raw',
          output_stream_key = id::text || '-annotated'
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
