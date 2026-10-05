module Api
  module V1
    class OfficersController < BaseController
      before_action :authenticate_user!
      before_action :require_admin!, except: :show
      before_action :require_admin_or_self!, only: :show
      before_action :load_officer, only: %i[show update destroy]

      def index
        scope = Officer.all
        scope = scope.where(role: params[:role]) if params[:role].present?
        rows, page = paginate(scope)
        render json: { data: rows.map { |officer| OfficerSerializer.call(officer) }, page: page }
      end

      def show
        render json: OfficerSerializer.call(@officer)
      end

      def create
        officer = Officer.create!(officer_params)
        render json: OfficerSerializer.call(officer), status: :created
      end

      def update
        attrs = officer_params
        if attrs.key?(:password) && attrs[:password].blank?
          raise ApiErrors::ValidationFailed.new([{ field: "password", message: "can't be blank" }])
        end

        Officer.transaction do
          @officer.assign_attributes(attrs)
          @officer.validate!
          ensure_another_admin! if @officer.role_was == "ADMIN" && @officer.role != "ADMIN"
          @officer.save!
        end
        render json: OfficerSerializer.call(@officer)
      end

      def destroy
        Officer.transaction do
          ensure_another_admin! if @officer.admin?
          raise officer_in_use_error if officer_in_use?

          @officer.destroy!
        end
        head :no_content
      rescue ActiveRecord::InvalidForeignKey
        raise officer_in_use_error
      end

      private

      def officer_params
        params.permit(:name, :badge_number, :role, :email, :password)
      end

      def require_admin_or_self!
        return if current_officer.admin? || current_officer.id == params[:id]

        raise ApiErrors::ApiError.new("FORBIDDEN", "You are not permitted to perform this action.", :forbidden)
      end

      def load_officer
        @officer = Officer.find(params[:id])
      end

      # Locks the other admin rows so two concurrent changes cannot remove the last admin.
      def ensure_another_admin!
        others = Officer.lock.where(role: "ADMIN").where.not(id: @officer.id).pluck(:id)
        return if others.any?

        raise ApiErrors::ApiError.new("LAST_ADMIN", "This change would leave the system without an admin.", :conflict)
      end

      def officer_in_use?
        Violation.where(reviewed_by: @officer).exists? ||
          ViolationAuditLog.where(officer_id: @officer.id).exists?
      end

      def officer_in_use_error
        ApiErrors::ApiError.new("OFFICER_IN_USE", "Officer is referenced by reviews or audit entries.", :conflict)
      end
    end
  end
end