require "test_helper"

class EvidenceStorageTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  test "keeps an existing bucket" do
    client = FakeStorageClient.new

    EvidenceStorage.new(client: client)

    assert_equal 1, client.head_bucket_calls
    assert_equal 0, client.create_bucket_calls
  end

  test "creates the bucket when it does not exist" do
    client = FakeStorageClient.new(head_bucket_error: Aws::S3::Errors::NotFound.new(nil, "missing"))

    EvidenceStorage.new(client: client)

    assert_equal 1, client.head_bucket_calls
    assert_equal 1, client.create_bucket_calls
  end

  class FakeStorageClient
    attr_reader :head_bucket_calls, :create_bucket_calls

    def initialize(head_bucket_error: nil)
      @head_bucket_error = head_bucket_error
      @head_bucket_calls = 0
      @create_bucket_calls = 0
    end

    def head_bucket(bucket:)
      @head_bucket_calls += 1
      raise @head_bucket_error if @head_bucket_error
    end

    def create_bucket(bucket:)
      @create_bucket_calls += 1
    end
  end
end
