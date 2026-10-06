import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { getCameraConfig, updateCameraConfig } from '../../services/camerasService'
import type { Camera, CameraConfig, CameraPoint, StopLine } from '../../types/cameras'

interface Props {
  camera: Camera
  onClose: () => void
  onSaved: (config: CameraConfig) => void
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'error' in error) {
    const detail = (error as { error?: { message?: string } }).error?.message
    if (detail) return detail
  }
  return error instanceof Error ? error.message : 'Could not save camera calibration.'
}

function iceServersFromLink(link: string | null): RTCIceServer[] {
  if (!link) return []
  return link.split(/,\s*(?=<)/).flatMap((entry) => {
    const match = entry.match(/<([^>]+)>;\s*rel="ice-server"(?:;\s*username="([^"]*)";\s*credential="([^"]*)";\s*credential-type="password")?/i)
    if (!match) return []
    return [{ urls: match[1], ...(match[2] ? { username: match[2], credential: match[3] } : {}) }]
  })
}

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const finish = () => {
      if (peer.iceGatheringState !== 'complete') return
      peer.removeEventListener('icegatheringstatechange', finish)
      resolve()
    }
    peer.addEventListener('icegatheringstatechange', finish)
    window.setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', finish)
      resolve()
    }, 8000)
  })
}

export default function CameraCalibrationModal({ camera, onClose, onSaved }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [config, setConfig] = useState<CameraConfig | null>(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  const [points, setPoints] = useState<CameraPoint[]>([])
  const [approachSide, setApproachSide] = useState<Extract<StopLine['approach_side'], 'above' | 'below'>>('above')
  const [grace, setGrace] = useState(camera.calibration.red_grace_seconds ?? 0)
  const [playing, setPlaying] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getCameraConfig(camera.id)
      .then((value) => {
        if (cancelled) return
        setConfig(value)
        setGrace(value.red_grace_seconds ?? 0)
        if (value.stop_line) {
          setPoints([value.stop_line.p1, value.stop_line.p2])
          setApproachSide(value.stop_line.approach_side as 'above' | 'below')
        }
      })
      .catch((reason: unknown) => { if (!cancelled) setError(errorMessage(reason)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [camera.id])

  useEffect(() => {
    const video = videoRef.current
    const url = camera.playback.webrtc_url
    if (!video || !url) return
    const targetVideo = video
    let closed = false
    let peer: RTCPeerConnection | null = null
    let sessionUrl: string | null = null

    async function connect() {
      try {
        const endpoint = `${url.replace(/\/$/, '')}/whep`
        const options = await fetch(endpoint, { method: 'OPTIONS' })
        peer = new RTCPeerConnection({ iceServers: iceServersFromLink(options.headers.get('Link')) })
        peer.addTransceiver('video', { direction: 'recvonly' })
        peer.ontrack = (event) => {
          if (closed) return
          targetVideo.srcObject = event.streams[0] ?? new MediaStream([event.track])
          void targetVideo.play().catch(() => undefined)
        }

        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        await waitForIceGathering(peer)
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: peer.localDescription?.sdp,
        })
        if (!response.ok) throw new Error(`MediaMTX WebRTC connection failed (${response.status}).`)
        const location = response.headers.get('Location')
        if (location) {
          sessionUrl = new URL(location, endpoint).toString()
        }
        await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() })
      } catch (reason) {
        if (!closed) setError(errorMessage(reason))
      }
    }

    void connect()
    return () => {
      closed = true
      peer?.close()
      targetVideo.srcObject = null
      if (sessionUrl) void fetch(sessionUrl, { method: 'DELETE' }).catch(() => undefined)
    }
  }, [camera.playback.webrtc_url])

  function choosePoint(event: React.MouseEvent<SVGSVGElement>) {
    if (!config || !frameSize.width || !frameSize.height) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = {
      x: Math.round(((event.clientX - bounds.left) / bounds.width) * frameSize.width),
      y: Math.round(((event.clientY - bounds.top) / bounds.height) * frameSize.height),
    }
    setPoints((current) => current.length >= 2 ? [point] : [...current, point])
  }

  async function saveCalibration() {
    if (!config || points.length !== 2 || !frameSize.width || !frameSize.height) return
    setSaving(true)
    setError('')
    const stopLine: StopLine = { p1: points[0], p2: points[1], approach_side: approachSide }
    try {
      const updated = await updateCameraConfig(camera.id, {
        expected_config_version: config.config_version,
        frame_width: frameSize.width,
        frame_height: frameSize.height,
        stop_line: stopLine,
        red_grace_seconds: grace,
      })
      onSaved(updated)
      onClose()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  const line = points.length === 2 ? points : config?.stop_line ? [config.stop_line.p1, config.stop_line.p2] : []

  return (
    <div className="cameras-modal-overlay" onClick={onClose}>
      <section className="camera-calibration-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="calibration-title">
        <header className="camera-calibration-header">
          <div>
            <h2 id="calibration-title">Calibrate {camera.name}</h2>
            <p>Pause on a clear frame, then click both ends of the road’s stop line.</p>
          </div>
          <button className="cameras-modal-close" type="button" onClick={onClose} aria-label="Close calibration"><X size={19} /></button>
        </header>

        <div className="camera-calibration-body">
          {!camera.worker.online || !camera.playback.webrtc_url ? (
            <div className="camera-calibration-message">The camera worker or video stream is offline. Start the worker before calibrating.</div>
          ) : (
            <>
              <div className="camera-calibration-toolbar">
                <button type="button" onClick={() => {
                  const video = videoRef.current
                  if (!video) return
                  if (video.paused) { void video.play(); setPlaying(true) }
                  else { video.pause(); setPlaying(false) }
                }}>{playing ? 'Pause frame' : 'Resume video'}</button>
                <span>{frameSize.width ? `${frameSize.width} × ${frameSize.height}` : 'Waiting for video dimensions…'}</span>
              </div>
              <div
                className="camera-calibration-stage"
                style={{ aspectRatio: frameSize.width && frameSize.height ? `${frameSize.width} / ${frameSize.height}` : '16 / 9' }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onLoadedMetadata={(event) => setFrameSize({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })}
                />
                {frameSize.width > 0 && frameSize.height > 0 && (
                  <svg className="camera-calibration-overlay" viewBox={`0 0 ${frameSize.width} ${frameSize.height}`} preserveAspectRatio="none" onClick={choosePoint} role="button" aria-label="Select stop line endpoints">
                    {line.length === 2 && <line x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} />}
                    {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={Math.max(7, frameSize.width / 100)} />)}
                  </svg>
                )}
              </div>
              <p className="camera-calibration-hint">Click endpoint 1 and endpoint 2. The line should span the full vehicle path at the stop line.</p>
              <div className="camera-calibration-fields">
                <label>
                  Approach side
                  <select value={approachSide} onChange={(event) => setApproachSide(event.target.value as 'above' | 'below')}>
                    <option value="above">Vehicles approach from above the line</option>
                    <option value="below">Vehicles approach from below the line</option>
                  </select>
                </label>
                <label>
                  Red grace period (seconds)
                  <input type="number" min="0" max="60" step="0.1" value={grace} onChange={(event) => setGrace(Number(event.target.value))} />
                </label>
              </div>
            </>
          )}
          {error && <p className="camera-calibration-error" role="alert">{error}</p>}
        </div>

        <footer className="camera-calibration-footer">
          <button type="button" className="camera-calibration-secondary" onClick={() => setPoints([])}>Clear line</button>
          <button type="button" className="cameras-add-button" disabled={loading || saving || !config || points.length !== 2 || !frameSize.width} onClick={saveCalibration}>
            {loading ? 'Loading…' : saving ? 'Saving…' : 'Save calibration'}
          </button>
        </footer>
      </section>
    </div>
  )
}
