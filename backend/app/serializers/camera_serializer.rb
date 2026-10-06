# Camera object from contract section 4.2. It never exposes raw_stream_key.
class CameraSerializer
  ONLINE_WINDOW = 30.seconds

  def self.worker_meta_key(camera_id)
    "camera:#{camera_id}:worker_meta" # written by the heartbeat endpoint, 60 s TTL
  end

  def self.calibration_status(camera, reference_frame_ready)
    return "CALIBRATED" if camera.stop_line.present?

    reference_frame_ready ? "AWAITING_CALIBRATION" : "AWAITING_WORKER"
  end

  def self.call(camera)
    frame_ready = ReferenceFrame.exist?(camera.id)
    meta = (Rails.cache.read(worker_meta_key(camera.id)) || {}).with_indifferent_access
    heartbeat = camera.last_heartbeat

    {
      id: camera.id,
      name: camera.name,
      district: camera.district,
      municipality: camera.municipality,
      status: camera.status.to_s.upcase.presence,
      installed_at: camera.installed_at&.iso8601,
      output_stream_key: camera.output_stream_key,
      signal_state_key: camera.signal_state_key,
      provisioning: {
        status: camera.provisioning_status.to_s.upcase,
        source_video: camera.source_video,
        error: camera.provisioning_status_error
      },
      signal: {
        available: signal_available?(camera),
        url: signal_url(camera),
        last_seen_at: ApiTime.iso(camera.signal_api_last_seen_at)
      },
      playback: {
        webrtc_url: camera.output_stream_key.present? ? "#{playback_base}/#{camera.output_stream_key}" : nil,
        hls_url: camera.output_stream_key.present? ? "#{hls_base}/#{camera.output_stream_key}/index.m3u8" : nil
      },
      calibration: {
        status: calibration_status(camera, frame_ready),
        calibrated: camera.stop_line.present?,
        reference_frame_ready: frame_ready,
        frame_width: camera.frame_width,
        frame_height: camera.frame_height,
        red_grace_seconds: camera.red_grace_seconds.to_f,
        config_version: camera.config_version
      },
      worker: {
        status: camera.worker_status.to_s.upcase.presence,
        online: heartbeat.present? && heartbeat >= ONLINE_WINDOW.ago,
        last_heartbeat: ApiTime.iso(heartbeat),
        fps: meta[:fps],
        image_version: meta[:image_version],
        model_version: meta[:model_version],
        rule_version: meta[:rule_version]
      },
      created_at: ApiTime.iso(camera.created_at)
    }
  end

  def self.playback_base
    ENV.fetch("MEDIAMTX_PLAYBACK_BASE", "http://localhost:8889")
  end

  def self.hls_base
    ENV.fetch("MEDIAMTX_HLS_BASE", "http://localhost:8888")
  end

  def self.signal_available?(camera)
    camera.signal_api_base_url.present? &&
      camera.signal_api_last_seen_at.present? &&
      camera.signal_api_last_seen_at >= ONLINE_WINDOW.ago
  end

  def self.signal_url(camera)
    return nil if camera.signal_api_base_url.blank? || camera.signal_state_key.blank?

    "#{camera.signal_api_base_url.chomp('/')}/signal/#{camera.signal_state_key}"
  end
end
