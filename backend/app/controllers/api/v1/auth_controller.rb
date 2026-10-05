module Api
  module V1
    class AuthController < BaseController
      before_action :authenticate_user!, only: %i[me change_password]

      def login
        officer = Officer.find_by("lower(email) = ?", params[:email].to_s.strip.downcase)
        unless officer&.valid_password?(params[:password].to_s)
          raise ApiErrors::ApiError.new("INVALID_CREDENTIALS", "Email or password is incorrect.", :unauthorized)
        end

        token, = Warden::JWTAuth::UserEncoder.new.call(officer, :officer, nil)
        expires_at = Time.at(Warden::JWTAuth::TokenDecoder.new.call(token)["exp"])
        render json: { access_token: token, expires_at: ApiTime.iso(expires_at),
                       officer: OfficerSerializer.call(officer) }
      end

      def me
        render json: OfficerSerializer.call(current_officer)
      end

      def change_password
        unless current_officer.valid_password?(params[:current_password].to_s)
          raise ApiErrors::ValidationFailed.new([{ field: "current_password", message: "is incorrect" }])
        end

        current_officer.update!(password: params[:new_password].to_s)
        head :no_content
      end
    end
  end
end