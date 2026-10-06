class MakeCameraSourceVideoUnique < ActiveRecord::Migration[8.1]
  def change
    add_index :cameras, :source_video, unique: true,
              where: "source_video IS NOT NULL", name: "index_cameras_on_unique_source_video"
  end
end
