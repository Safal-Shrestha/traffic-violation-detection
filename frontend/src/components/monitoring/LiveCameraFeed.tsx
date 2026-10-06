import {
  useEffect,
  useRef,
} from 'react'
import Hls from 'hls.js'
import {
  Camera,
  Circle,
  Maximize,
} from 'lucide-react'

import type { Camera as CameraType } from '../../types/monitoring'

interface LiveCameraFeedProps {
  camera: CameraType
}

function LiveCameraFeed({
  camera,
}: LiveCameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const isOnline = camera.worker.online
  const streamUrl = camera.playback.hls_url

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isOnline || !streamUrl) return

    // Safari and some other browsers can play HLS directly.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl
      return
    }

    // Other browsers need HLS.js with Media Source Extensions.
    if (!Hls.isSupported()) return

    const hls = new Hls()
    hls.loadSource(streamUrl)
    hls.attachMedia(video)

    return () => {
      hls.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [isOnline, streamUrl])

  async function enterFullscreen() {
    const feed = feedRef.current
    if (!feed) return

    if (feed.requestFullscreen) {
      await feed.requestFullscreen()
    }
  }

  return (
    <section className="monitoring-feed-panel">
      <div className="monitoring-feed-header">
        <div>
          <h3>{camera.name}</h3>
          <span>
            {camera.district},{' '}
            {camera.municipality}
          </span>
        </div>

        <div className="monitoring-feed-meta">
          <span>
            {camera.worker.fps
              ? `${camera.worker.fps} FPS`
              : 'FPS unavailable'}
          </span>
          <span>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div
        ref={feedRef}
        className={`monitoring-feed ${
          !isOnline ? 'offline' : ''
        }`}
      >
        {isOnline && streamUrl ? (
          <>
            <video
              ref={videoRef}
              className="monitoring-video"
              autoPlay
              muted
              controls
              playsInline
            />

            <div className="monitoring-live-indicator">
              <Circle size={8} fill="currentColor" />
              LIVE
            </div>

            <button
              className="monitoring-fullscreen-button"
              aria-label="Fullscreen"
              onClick={enterFullscreen}
              type="button"
            >
              <Maximize size={18} />
            </button>

            <div className="monitoring-feed-overlay">
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </>
        ) : (
          <div className="monitoring-feed-placeholder">
            <Camera size={42} />
            <span>
              {!isOnline
                ? 'Camera Offline'
                : 'Video Unavailable'}
            </span>
            <small>
              {!isOnline
                ? 'No video signal available'
                : 'No playable video stream is available'}
            </small>
          </div>
        )}
      </div>
    </section>
  )
}

export default LiveCameraFeed