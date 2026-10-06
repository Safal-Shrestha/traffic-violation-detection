import {
  Camera,
  Circle,
  Maximize,
  Video,
} from 'lucide-react'
import type { MonitoringCamera } from '../../types/monitoring'

interface LiveCameraFeedProps {
  camera: MonitoringCamera
}

function LiveCameraFeed({
  camera,
}: LiveCameraFeedProps) {
  const isOnline = camera.status === 'online'

  return (
    <section className="monitoring-feed-panel">
      <div className="monitoring-feed-header">
        <div>
          <h3>{camera.name}</h3>
          <span>{camera.location}</span>
        </div>

        <div className="monitoring-feed-meta">
          <span>
            {camera.resolution}
          </span>

          <span>
            {camera.fps} FPS
          </span>
        </div>
      </div>

      <div
        className={`monitoring-feed ${
          !isOnline ? 'offline' : ''
        }`}
      >
        {isOnline ? (
          <>
            {camera.streamUrl ? (
              <iframe
                className="monitoring-feed-stream"
                src={camera.streamUrl}
                title={`${camera.name} live stream`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="monitoring-feed-placeholder">
                <Video size={42} />
                <span>Live Camera Feed</span>
                <small>Video stream is not configured</small>
              </div>
            )}

            <div className="monitoring-live-indicator">
              <Circle size={8} fill="currentColor" />
              LIVE
            </div>

            <button
              className="monitoring-fullscreen-button"
              aria-label="Fullscreen"
            >
              <Maximize size={18} />
            </button>

            <div className="monitoring-feed-overlay">
              <span>
                {new Date().toLocaleTimeString()}
              </span>

              <span>
                AI Detection Active
              </span>
            </div>
          </>
        ) : (
          <div className="monitoring-feed-placeholder">
            <Camera size={42} />
            <span>Camera Offline</span>
            <small>
              No video signal available
            </small>
          </div>
        )}
      </div>
    </section>
  )
}

export default LiveCameraFeed
