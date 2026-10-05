# The JWT is verified (signature + expiry), then the officer is loaded from the database.
# The role always comes from the database row, never from a token claim.
module Authenticatable
  extend ActiveSupport::Concern

  private

  def current_officer
    @current_officer
  end

  def authenticate_user!
    token = request.authorization.to_s[/\ABearer\s+(\S+)\z/i, 1]
    raise unauthenticated_error if token.nil?

    payload = Warden::JWTAuth::TokenDecoder.new.call(token)
    @current_officer = Officer.find_by(id: payload["sub"])
    raise unauthenticated_error if @current_officer.nil?
  rescue JWT::DecodeError
    raise unauthenticated_error
  end

  def require_admin!
    return if current_officer&.admin?

    raise ApiErrors::ApiError.new("FORBIDDEN", "You are not permitted to perform this action.", :forbidden)
  end

  def unauthenticated_error
    ApiErrors::ApiError.new("UNAUTHENTICATED", "Missing, invalid or expired token.", :unauthorized)
  end
end
