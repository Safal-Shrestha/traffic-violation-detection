# One CCTV feed and its detection worker. Holds per-camera configuration:
# stop line, red-light grace period, signal lookup key, worker health.
class Camera < ApplicationRecord
  HEARTBEAT_TIMEOUT = 30.seconds
  APPROACH_SIDES    = %w[above below].freeze
  STATUSES           = %w[ACTIVE INACTIVE MAINTENANCE].freeze
  WORKER_STATUSES    = %w[STOPPED STARTING RUNNING ERROR].freeze
  PROVISIONING_STATUSES = %w[REQUESTED STARTING READY ERROR].freeze
  STOP_LINE_POINTS   = %w[p1 p2].freeze
  DEMO_SOURCE_VIDEOS = %w[junction1.mp4 junction2.mp4 junction3.mp4 junction4.mp4].freeze

  enum :status,        STATUSES.to_h { |value| [ value.downcase.to_sym, value ] }, validate: true
  enum :worker_status, WORKER_STATUSES.to_h { |value| [ value.downcase.to_sym, value ] },
       prefix: :worker, validate: true
  enum :provisioning_status, PROVISIONING_STATUSES.to_h { |value| [ value.downcase.to_sym, value ] },
       validate: true
  has_many :violations, inverse_of: :camera, dependent: :restrict_with_error

  before_validation :normalize_blank_keys

  validates :name,           presence: true, length: { maximum: 100 }
  validates :raw_stream_key, presence: true, length: { maximum: 255 }, uniqueness: true
  validates :output_stream_key, length: { maximum: 255 }, uniqueness: true, allow_nil: true
  validates :signal_state_key, length: { maximum: 255 }, uniqueness: true, allow_nil: true
  validates :source_video, length: { maximum: 255 },
            inclusion: { in: DEMO_SOURCE_VIDEOS },
            allow_nil: true
  validates :source_video, uniqueness: true, allow_nil: true
  validates :control_api_base_url, :signal_api_base_url, length: { maximum: 500 }, allow_nil: true
  validates :frame_width, :frame_height, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :red_grace_seconds, numericality: { greater_than_or_equal_to: 0 }
  validate  :stop_line_must_be_valid

  def calibrated?
    stop_line.present?
  end

  # Worker is considered online when it reports RUNNING and its heartbeat is fresh.
  def online?
    worker_running? && last_heartbeat.present? && last_heartbeat > HEARTBEAT_TIMEOUT.ago
  end

  def record_heartbeat!(status = nil)
    attrs = { last_heartbeat: Time.current }
    attrs[:worker_status] = status if status
    update!(attrs)
  end

  PROVISIONING_STATUSES.each do |status|
    define_method(:"provisioning_#{status.downcase}?") do
      provisioning_status == status.downcase
    end
  end

  private

  # Unique indexes treat '' as a value, so blank keys are stored as NULL.
  def normalize_blank_keys
    self.output_stream_key = output_stream_key.to_s.strip.presence
    self.signal_state_key = signal_state_key.to_s.strip.presence
  end

  # Mirrors the DB checks and adds geometry validation the database cannot express.
  # Expected shape: {"p1": {"x": 1, "y": 2}, "p2": {"x": 3, "y": 4}, "approach_side": "above"|"below"}
  def stop_line_must_be_valid
    return if stop_line.nil?
    return errors.add(:stop_line, "must be an object") unless stop_line.is_a?(Hash)
    return errors.add(:stop_line, "requires frame_width and frame_height") if frame_width.nil? || frame_height.nil?

    STOP_LINE_POINTS.each do |key|
      point = stop_line[key]
      x, y  = point.is_a?(Hash) ? [ point["x"], point["y"] ] : [ nil, nil ]
      inside = x.is_a?(Numeric) && y.is_a?(Numeric) && x.between?(0, frame_width) && y.between?(0, frame_height)
      errors.add(:stop_line, "#{key} needs numeric x and y inside the #{frame_width}x#{frame_height} frame") unless inside
    end

    errors.add(:stop_line, "endpoints must differ") if stop_line["p1"] == stop_line["p2"]

    side = stop_line["approach_side"]
    errors.add(:stop_line, "approach_side must be one of #{APPROACH_SIDES.join(', ')}") if side && !APPROACH_SIDES.include?(side)
  end
end
