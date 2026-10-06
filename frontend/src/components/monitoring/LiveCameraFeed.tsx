import {
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Camera,
  Circle,
  Maximize,
} from 'lucide-react'

import type { Camera as CameraType } from '../../types/monitoring'
import {
  getCameraSignalState,
  setCameraSignalState,
  type SignalState,
} from '../../services/monitoringService'

interface LiveCameraFeedProps {
  camera: CameraType
}

function LiveCameraFeed({
  camera,
}: LiveCameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const [streamError, setStreamError] = useState('')
  const [signalState, setSignalState] = useState<SignalState | null>(null)
  const [signalError, setSignalError] = useState('')
  const [signalPending, setSignalPending] = useState(false)
  const isOnline = camera.worker.online
  const signalAvailable = isOnline && camera.signal.available
  const streamUrl = camera.playback.webrtc_url

  useEffect(() => {
    if (!signalAvailable) {
      setSignalState(null)
      setSignalError('')
      return
    }

    let active = true
    setSignalState(null)
    setSignalError('')
    async function refreshSignal() {
      try {
        const response = await getCameraSignalState(camera.id)
        if (active) {
          setSignalState(response.state)
          setSignalError('')
        }
      } catch {
        if (active) setSignalError('Signal controller unavailable')
      }
    }

    void refreshSignal()
    const interval = window.setInterval(refreshSignal, 2500)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [camera.id, signalAvailable])

  async function changeSignal(state: SignalState) {
    setSignalPending(true)
    setSignalError('')
    try {
      const response = await setCameraSignalState(camera.id, state)
      setSignalState(response.state)
    } catch {
      setSignalError('Could not change signal. Check Rails and worker connectivity.')
    } finally {
      setSignalPending(false)
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isOnline || !streamUrl) return
    const targetUrl = streamUrl
    let closed = false
    let peer: RTCPeerConnection | null = null
    let sessionUrl: string | null = null
    const targetVideo = video
    setStreamError('')

    async function connect() {
      try {
        const endpoint = `${targetUrl.replace(/\/$/, '')}/whep`
        const options = await fetch(endpoint, { method: 'OPTIONS' })
        if (!options.ok) throw new Error(`MediaMTX WebRTC options failed (${options.status}).`)
        const iceServers = (options.headers.get('Link') ?? '')
          .split(/,\s*(?=<)/)
          .flatMap((entry) => {
            const match = entry.match(/<([^>]+)>;\s*rel="ice-server"(?:;\s*username="([^"]*)";\s*credential="([^"]*)";\s*credential-type="password")?/i)
            return match ? [{ urls: match[1], ...(match[2] ? { username: match[2], credential: match[3] } : {}) }] : []
          })

        peer = new RTCPeerConnection({ iceServers })
        peer.addTransceiver('video', { direction: 'recvonly' })
        peer.ontrack = (event) => {
          if (closed) return
          targetVideo.srcObject = event.streams[0] ?? new MediaStream([event.track])
          void targetVideo.play().catch(() => undefined)
        }

        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        if (peer.iceGatheringState !== 'complete') {
          await new Promise<void>((resolve) => {
            const onGathering = () => {
              if (peer?.iceGatheringState !== 'complete') return
              peer.removeEventListener('icegatheringstatechange', onGathering)
              resolve()
            }
            peer?.addEventListener('icegatheringstatechange', onGathering)
            window.setTimeout(() => {
              peer?.removeEventListener('icegatheringstatechange', onGathering)
              resolve()
            }, 8000)
          })
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: peer.localDescription?.sdp,
        })
        if (!response.ok) throw new Error(`MediaMTX could not start the WebRTC stream (${response.status}).`)
        const location = response.headers.get('Location')
        if (location) sessionUrl = new URL(location, endpoint).toString()
        await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() })
        if (closed && sessionUrl) void fetch(sessionUrl, { method: 'DELETE' }).catch(() => undefined)
      } catch (error) {
        if (!closed) setStreamError(error instanceof Error ? error.message : 'Could not connect to the camera stream.')
      }
    }

    void connect()
    return () => {
      closed = true
      peer?.close()
      targetVideo.srcObject = null
      if (sessionUrl) void fetch(sessionUrl, { method: 'DELETE' }).catch(() => undefined)
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

      <div className="monitoring-signal-controls" aria-label={`${camera.name} traffic signal controls`}>
        <span className={`monitoring-signal-state ${signalState?.toLowerCase() ?? 'unknown'}`}>
          Signal: {signalState ?? (signalAvailable ? 'Loading' : 'Unavailable')}
        </span>
        <button
          type="button"
          className="monitoring-signal-button red"
          aria-pressed={signalState === 'RED'}
          disabled={!signalAvailable || signalPending}
          onClick={() => void changeSignal('RED')}
        >
          Trigger red
        </button>
        <button
          type="button"
          className="monitoring-signal-button green"
          aria-pressed={signalState === 'GREEN'}
          disabled={!signalAvailable || signalPending}
          onClick={() => void changeSignal('GREEN')}
        >
          Set green
        </button>
        <span className="monitoring-signal-help" role="status">
          {signalPending ? 'Updating…' : signalError || 'Use green, then red to simulate a signal change.'}
        </span>
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
              <span>{streamError || new Date().toLocaleTimeString()}</span>
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
