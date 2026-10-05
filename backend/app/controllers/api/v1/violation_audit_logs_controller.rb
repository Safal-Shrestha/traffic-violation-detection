module Api
  module V1
    class ViolationAuditLogsController < BaseController
      before_action :authenticate_user!
      before_action :require_admin!, only: :index

      # GET /violations/{id}/audit-log, ascending created_at.
      def for_violation
        violation = Violation.find(params[:id])
        entries = ViolationAuditLog.includes(:officer).where(violation_id: violation.id).order(:created_at, :id)
        render json: { data: entries.map { |entry| AuditEntrySerializer.call(entry) } }
      end

      # GET /audit-log (admin), newest first.
      def index
        scope = ViolationAuditLog.includes(:officer).order(created_at: :desc, id: :desc)
        scope = scope.where(officer_id: params[:officer_id]) if params[:officer_id].present?
        scope = scope.where(violation_id: params[:violation_id]) if params[:violation_id].present?

        # `action` is a reserved routing param, so the filter is read from the query string.
        action = request.query_parameters["action"]
        scope = scope.where(action: action) if action.present?

        from = time_param(:from)
        to = time_param(:to)
        scope = scope.where("violation_audit_logs.created_at >= ?", from) if from
        scope = scope.where("violation_audit_logs.created_at <= ?", to) if to

        rows, page = paginate(scope)
        render json: { data: rows.map { |entry| AuditEntrySerializer.call(entry) }, page: page }
      rescue ActiveRecord::StatementInvalid => e
        raise unless e.cause.is_a?(PG::InvalidTextRepresentation)

        raise ApiErrors::ValidationFailed.new([ { field: "filter", message: "contains an invalid id" } ])
      end
    end
  end
end
