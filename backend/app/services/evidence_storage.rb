class EvidenceStorage
  class ObjectNotFound < StandardError; end
  class BucketUnavailable < StandardError; end

  PRESIGN_TTL = 5.minutes

  def initialize(client: nil)
    @bucket = ENV.fetch("EVIDENCE_BUCKET", "traffic-evidence")
    @client = client
    ensure_bucket!
  end

  def presign_upload(storage_key:, content_type:)
    presigner.presigned_url(
      :put_object,
      bucket: @bucket,
      key: storage_key,
      content_type: content_type,
      expires_in: PRESIGN_TTL.to_i
    )
  end

  def presign_view(storage_key:)
    presigner.presigned_url(
      :get_object,
      bucket: @bucket,
      key: storage_key,
      expires_in: PRESIGN_TTL.to_i
    )
  end

  def verify_object!(storage_key:, file_size_byte:, content_type:)
    metadata = client.head_object(bucket: @bucket, key: storage_key)
    return metadata if metadata.content_length == file_size_byte && metadata.content_type == content_type

    raise ArgumentError, "stored object metadata does not match evidence metadata"
  rescue Aws::S3::Errors::NotFound
    raise ObjectNotFound, "evidence object was not found in storage"
  end

  def object_exists?(storage_key = nil, **options)
    storage_key ||= options[:storage_key] || options[:key]
    client.head_object(bucket: @bucket, key: storage_key)
    true
  rescue Aws::S3::Errors::NotFound
    false
  end

  private

  def ensure_bucket!
    client.head_bucket(bucket: @bucket)
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchBucket
    create_bucket!
  end

  def create_bucket!
    client.create_bucket(bucket: @bucket)
  rescue Aws::S3::Errors::BucketAlreadyOwnedByYou, Aws::S3::Errors::BucketAlreadyExists
    # Another backend process created the bucket concurrently.
  rescue Aws::S3::Errors::ServiceError => error
    raise BucketUnavailable, "could not create evidence bucket #{@bucket}: #{error.message}"
  end

  def client
    @client ||= Aws::S3::Client.new(
      endpoint: ENV["S3_ENDPOINT"],
      region: ENV.fetch("AWS_REGION", "us-east-1"),
      access_key_id: ENV["AWS_ACCESS_KEY_ID"],
      secret_access_key: ENV["AWS_SECRET_ACCESS_KEY"],
      force_path_style: true
    )
  end

  def presigner
    @presigner ||= Aws::S3::Presigner.new(client: client)
  end
end
