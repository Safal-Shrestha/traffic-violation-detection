module ApiErrors
  extend ActiveSupport::Concern

  class ApiError < StandardError
    attr_reader :code, :status, :details

    def initialize(code, message, status, details = nil)
      super(message)
      @code = code
      @status = status
      @details = details
    end
  end

  class ValidationFailed < ApiError
    def initialize(details, message = "Request body failed validation.")
      super("VALIDATION_FAILED", message, :unprocessable_entity, details)
    end
  end

  def self.details_for(record)
    record.errors.map { |error| { field: error.attribute.to_s, message: error.message } }
  end

  included do
    rescue_from ApiError do |error|
      render_error(error.code, error.message, error.status, error.details)
    end

    rescue_from ActiveRecord::RecordNotFound do
      render_error("NOT_FOUND", "Resource was not found.", :not_found)
    end

    rescue_from ActiveRecord::RecordInvalid do |error|
      render_error("VALIDATION_FAILED", "Request body failed validation.",
                   :unprocessable_entity, ApiErrors.details_for(error.record))
    end

    rescue_from ActionController::ParameterMissing do |error|
      render_error("VALIDATION_FAILED", "Request body failed validation.",
                   :unprocessable_entity, [ { field: error.param.to_s, message: "is required" } ])
    end
  end

  private

  # `details` is present only for 422 (contract section 1.1).
  def render_error(code, message, status, details = nil)
    error = { code: code, message: message, request_id: request.request_id }
    error[:details] = details if details.present? && Rack::Utils.status_code(status) == 422
    render json: { error: error }, status: status
  end
end
