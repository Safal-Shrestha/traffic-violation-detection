module Api
  module V1
    # Shared behaviour for the controllers in this package.
    # Authentication is opt-in per controller (before_action :authenticate_user!).
    class BaseController < ApplicationController
      include ApiErrors
      include Authenticatable
      include Paginatable

      # The contract uses flat JSON bodies, so read params from the top level.
      wrap_parameters false

      private

      def time_param(name)
        value = params[name]
        return nil if value.blank?

        Time.iso8601(value.to_s)
      rescue ArgumentError
        raise ApiErrors::ValidationFailed.new([ { field: name.to_s, message: "must be an ISO 8601 timestamp" } ])
      end
    end
  end
end
