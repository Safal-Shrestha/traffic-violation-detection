require "base64"

# Cursor pagination (contract section 1): ?limit=50&cursor=<opaque>
# Response page object: { next_cursor:, has_more: }. Keyset on (created_at, id).
module Paginatable
  extend ActiveSupport::Concern

  DEFAULT_LIMIT = 50
  MAX_LIMIT = 100
  CURSOR_ID = /\A(\h{8}-\h{4}-\h{4}-\h{4}-\h{12}|\d+)\z/

  private

  def paginate(scope, direction: :desc)
    limit = page_limit
    table = scope.klass.table_name
    dir = direction == :asc ? "ASC" : "DESC"
    scope = scope.reorder(Arel.sql("#{table}.created_at #{dir}, #{table}.id #{dir}"))

    if params[:cursor].present?
      timestamp, id = decode_cursor(params[:cursor])
      op = direction == :asc ? ">" : "<"
      scope = scope.where("(#{table}.created_at, #{table}.id) #{op} (?, ?)", timestamp, id)
    end

    rows = scope.limit(limit + 1).to_a
    has_more = rows.size > limit
    rows = rows.first(limit)
    [ rows, { next_cursor: has_more ? encode_cursor(rows.last) : nil, has_more: has_more } ]
  end

  def page_limit
    return DEFAULT_LIMIT if params[:limit].blank?

    limit = Integer(params[:limit].to_s, 10)
    raise ArgumentError unless limit.between?(1, MAX_LIMIT)

    limit
  rescue ArgumentError
    raise ApiErrors::ValidationFailed.new([ { field: "limit", message: "must be between 1 and #{MAX_LIMIT}" } ])
  end

  def encode_cursor(row)
    Base64.urlsafe_encode64("#{row.created_at.utc.iso8601(6)}|#{row.id}", padding: false)
  end

  def decode_cursor(raw)
    timestamp, id = Base64.urlsafe_decode64(raw.to_s).split("|", 2)
    Time.iso8601(timestamp.to_s)
    raise ArgumentError unless id.to_s.match?(CURSOR_ID)

    [ timestamp, id ]
  rescue ArgumentError
    raise ApiErrors::ValidationFailed.new([ { field: "cursor", message: "is invalid" } ])
  end
end
