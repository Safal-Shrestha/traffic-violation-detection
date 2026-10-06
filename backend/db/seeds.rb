# Seed data for violation_types (MVP set). Idempotent; uses raw SQL so it works before models exist.
# TODO: replace the placeholder fine amounts (0) with the official NPR figures before use.
ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO violation_types (code, name, description, fine_amount_npr) VALUES
    ('RED_LIGHT', 'Red Light Violation', 'Vehicle crossed the stop line while the signal was red, after the grace period.', 50),
    ('STOP_LINE', 'Stop Line Violation', 'Vehicle stopped beyond the stop line or encroached past it.', 1000),
    ('NO_HELMET', 'Helmet Violation',    'Two-wheeler rider detected without a helmet.', 5000)
  ON CONFLICT (code) DO NOTHING;
SQL

# Optional demo data. Keep this opt-in so normal deployment seeds do not insert
# fictional people, vehicles, or violations into a live system. Evidence media is
# synthetic and uses visibly fake DEMO plates. The committed fixture files make
# this repeatable without ffmpeg; the configured S3/MinIO bucket is still needed.
if ENV["SEED_DEMO_DATA"] == "1"
  require "digest"

  demo_camera_id = "00000000-0000-4000-8000-000000000001"
  camera = Camera.find_or_create_by!(id: demo_camera_id) do |record|
    record.name = "Demo Junction Camera"
    record.district = "Demo District"
    record.municipality = "Demo Municipality"
    record.raw_stream_key = "demo-junction-raw"
    record.output_stream_key = "demo-junction-annotated"
    record.signal_state_key = "camera_signal_demo_junction"
    record.worker_status = "STOPPED"
    record.status = "ACTIVE"
    record.provisioning_status = "READY"
    record.red_grace_seconds = 0
  end

  violation_type = ViolationType.by_code!("RED_LIGHT")
  bucket = ENV.fetch("EVIDENCE_BUCKET", "traffic-evidence")
  s3 = Aws::S3::Client.new(
    endpoint: ENV.fetch("S3_ENDPOINT"),
    region: ENV.fetch("AWS_REGION", "us-east-1"),
    access_key_id: ENV.fetch("AWS_ACCESS_KEY_ID"),
    secret_access_key: ENV.fetch("AWS_SECRET_ACCESS_KEY"),
    force_path_style: true
  )
  begin
    s3.head_bucket(bucket: bucket)
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchBucket
    s3.create_bucket(bucket: bucket)
  end

  demo_rows = 5.times.map do |index|
    number = index + 1
    suffix = format("%04d", number)
    plate = "DEMO-#{suffix}"
    owner = Owner.find_or_create_by!(email: "demo.owner#{suffix}@example.test") do |record|
      record.name = "Demo Owner #{number}"
      record.license_number = "DEMO-LIC-#{suffix}"
    end
    vehicle = Vehicle.find_or_create_by!(plate_number: plate) do |record|
      record.owner = owner
      record.province_code = "DEMO"
      record.vehicle_category = "PRIVATE"
      record.vehicle_type = %w[CAR VAN MOTORCYCLE SUV PICKUP][index]
    end
    violation_id = format("00000000-0000-4000-8000-%012d", number + 100)
    violation = Violation.find_or_initialize_by(id: violation_id)

    unless violation.persisted?
      violation.assign_attributes(
        camera: camera,
        violation_type: violation_type,
        vehicle: vehicle,
        detected_plate_raw: plate,
        plate_confidence: 0.98,
        detection_confidence: 0.97,
        occurred_at: (number * 3).hours.ago,
        signal_state: "RED",
        status: "PENDING",
        metadata: { "demo_seed" => true, "synthetic_media" => true }
      )
      # Evidence is validated on violation creation, so attach all fixture rows
      # after uploading their objects to the bucket.
    end

    [ number, suffix, plate, owner, vehicle, violation ]
  end

  asset_directory = Rails.root.join("db/seeds/evidence")
  demo_rows.each do |_number, suffix, _plate, _owner, _vehicle, violation|
    image_key = "demo/violations/#{violation.id}/plate.jpg"
    frame_key = "demo/violations/#{violation.id}/frame.jpg"
    clip_key = "demo/violations/#{violation.id}/clip.mp4"
    objects = [
      [ "FULL_FRAME", "IMAGE", "image/jpeg", frame_key, asset_directory.join("#{suffix}-frame.jpg"), nil ],
      [ "PLATE_CROP", "IMAGE", "image/jpeg", image_key, asset_directory.join("#{suffix}-plate.jpg"), nil ],
      [ "CLIP", "VIDEO", "video/mp4", clip_key, asset_directory.join("#{suffix}-clip.mp4"), 3.0 ]
    ]
    evidence_attributes = objects.map do |role, media_type, content_type, key, path, duration|
      bytes = File.binread(path)
      s3.put_object(bucket: bucket, key: key, body: bytes, content_type: content_type)
      {
        evidence_role: role,
        media_type: media_type,
        content_type: content_type,
        storage_provider: "MINIO",
        storage_key: key,
        file_size_byte: bytes.bytesize,
        checksum_sha256: Digest::SHA256.hexdigest(bytes),
        duration_seconds: duration
      }
    end

    Violation.transaction do
      pending_evidence = []
      evidence_attributes.each do |attributes|
        next if violation.persisted? && violation.evidence_items.exists?(evidence_role: attributes[:evidence_role])

        pending_evidence << violation.evidence_items.build(attributes)
      end
      if violation.persisted?
        pending_evidence.each(&:save!)
      else
        violation.save! # autosaves its three required evidence rows
      end
    end
  end
end

# Bootstrap the first administrator when credentials are explicitly supplied.
# Subsequent admins must be created through the authenticated admin API.
admin_attributes = {
  name: ENV["ADMIN_NAME"],
  badge_number: ENV["ADMIN_BADGE_NUMBER"],
  email: ENV["ADMIN_EMAIL"],
  password: ENV["ADMIN_PASSWORD"],
  role: "ADMIN"
}

if admin_attributes.values_at(:name, :badge_number, :email, :password).all?(&:present?)
  email = admin_attributes[:email].strip.downcase
  existing_admin = Officer.find_by(email: email)

  if existing_admin
    raise "ADMIN_EMAIL belongs to a non-admin officer" unless existing_admin.admin?
  else
    Officer.create!(admin_attributes.merge(email: email))
  end
end
