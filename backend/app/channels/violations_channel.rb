class ViolationsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "violations"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
