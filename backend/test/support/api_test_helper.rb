module ApiTestHelper
  def auth_headers(officer)
    token, = Warden::JWTAuth::UserEncoder.new.call(officer, :officer, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  def create_officer(role: "OFFICER")
    suffix = SecureRandom.hex(6)
    Officer.create!(
      name: role == "ADMIN" ? "Test admin" : "Test officer",
      badge_number: "BADGE-#{suffix}",
      role: role,
      email: "#{role.downcase}-#{suffix}@example.com",
      password_hash: "test-password"
    )
  end

  def create_camera
    Camera.create!(
      name: "Test camera",
      raw_stream_key: "camera-#{SecureRandom.hex(6)}"
    )
  end

  def create_violation_type
    suffix = SecureRandom.hex(4).upcase
    ViolationType.create!(
      code: "TEST_#{suffix}",
      name: "Test violation",
      fine_amount_npr: 500
    )
  end

  def create_violation(camera:, violation_type:)
    violation = Violation.new(
      camera: camera,
      violation_type: violation_type,
      detection_confidence: 0.95,
      occurred_at: Time.current,
      signal_state: "RED"
    )
    violation.save!(validate: false)
    violation
  end
end
