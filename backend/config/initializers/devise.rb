require "devise"

Devise.setup do |config|
  config.jwt do |jwt|
    jwt.secret = ENV.fetch("DEVISE_JWT_SECRET_KEY", Rails.application.secret_key_base)
    jwt.expiration_time = 8.hours.to_i
  end
end
