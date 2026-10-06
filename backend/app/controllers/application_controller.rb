class ApplicationController < ActionController::API
   before_action :set_cors_headers

  def cors_preflight_check
    render plain: '', status: :ok
  end

  private

  def set_cors_headers
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Accept, Authorization, Token'
  end
end
