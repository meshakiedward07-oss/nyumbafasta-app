// Browser-only video compression using canvas + MediaRecorder.
// Falls back to original file if browser lacks support or compression fails.

export interface CompressResult {
  file: File
  originalMB: number
  compressedMB: number
  wasCompressed: boolean
}

const MAX_WIDTH   = 1280
const MAX_HEIGHT  = 1280
const CAPTURE_FPS = 20  // Slightly lower FPS — reduces CPU on low-end phones

export function canCompress(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof window.MediaRecorder !== 'undefined' &&
    typeof (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream === 'function' &&
    // iOS Safari doesn't support captureStream on canvas — skip compression there
    MediaRecorder.isTypeSupported('video/webm')
  )
}

function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

function targetBitrate(w: number, h: number): number {
  // 1.2 Mbps at 720p — good for listing previews and keeps file small
  return Math.round((w * h / (1280 * 720)) * 1_200_000 * 0.7)
}

export async function compressVideo(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<CompressResult> {
  const originalMB = file.size / (1024 * 1024)
  if (!canCompress()) return { file, originalMB, compressedMB: originalMB, wasCompressed: false }

  onProgress?.(5)

  return new Promise<CompressResult>(resolve => {
    const fallback = (): CompressResult => ({
      file, originalMB, compressedMB: originalMB, wasCompressed: false,
    })

    const objectUrl  = URL.createObjectURL(file)
    const videoEl    = document.createElement('video')
    videoEl.muted       = true
    videoEl.playsInline = true  // Required on iOS to prevent fullscreen hijack
    videoEl.preload     = 'metadata'
    videoEl.src         = objectUrl

    let drawInterval: ReturnType<typeof setInterval> | null = null
    let stuckInterval: ReturnType<typeof setInterval> | null = null
    let safetyTimer:   ReturnType<typeof setTimeout>  | null = null

    function cleanup() {
      if (drawInterval)  { clearInterval(drawInterval);  drawInterval  = null }
      if (stuckInterval) { clearInterval(stuckInterval); stuckInterval = null }
      if (safetyTimer)   { clearTimeout(safetyTimer);    safetyTimer   = null }
      try { URL.revokeObjectURL(objectUrl) } catch {}
      try { videoEl.pause(); videoEl.src = '' } catch {}
    }

    videoEl.onerror = () => { cleanup(); onProgress?.(100); resolve(fallback()) }

    videoEl.onloadedmetadata = () => {
      try {
        let w = videoEl.videoWidth
        let h = videoEl.videoHeight
        if (!w || !h) { cleanup(); onProgress?.(100); resolve(fallback()); return }

        if (w > MAX_WIDTH)  { h = Math.round(h * MAX_WIDTH / w);   w = MAX_WIDTH }
        if (h > MAX_HEIGHT) { w = Math.round(w * MAX_HEIGHT / h);  h = MAX_HEIGHT }
        w = Math.floor(w / 2) * 2  // Codecs require even dimensions
        h = Math.floor(h / 2) * 2

        onProgress?.(10)

        const canvas  = document.createElement('canvas')
        canvas.width  = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: false })!

        const mimeType = getSupportedMimeType()
        const stream   = (canvas as unknown as {
          captureStream: (fps: number) => MediaStream
        }).captureStream(CAPTURE_FPS)

        const chunks: Blob[] = []
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: targetBitrate(w, h),
        })
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

        recorder.onstop = () => {
          cleanup()
          // Guard: if no frames were captured (e.g. tab went to background), fall back
          const totalBytes = chunks.reduce((s, c) => s + c.size, 0)
          if (chunks.length === 0 || totalBytes < 1024) {
            onProgress?.(100)
            resolve(fallback())
            return
          }
          const ext  = mimeType.includes('webm') ? 'webm' : 'mp4'
          const blob = new Blob(chunks, { type: mimeType })
          const out  = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, `.${ext}`),
            { type: mimeType },
          )
          onProgress?.(100)
          resolve({ file: out, originalMB, compressedMB: out.size / (1024 * 1024), wasCompressed: true })
        }

        const duration = videoEl.duration

        // Safety timeout: 3× video duration, min 3 min, max 10 min
        const timeoutMs = Math.min(Math.max(duration * 3_000, 180_000), 600_000)
        safetyTimer = setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop()
          else { cleanup(); resolve(fallback()) }
        }, timeoutMs)

        recorder.start(500)  // Emit chunks every 500ms — ensures data even if stop is late

        videoEl.play().then(() => {
          // ── KEY FIX: setInterval, NOT requestAnimationFrame ──
          // rAF is throttled/paused when the tab goes to background on mobile,
          // which causes compression to hang indefinitely. setInterval keeps firing.
          drawInterval = setInterval(() => {
            if (videoEl.ended || videoEl.paused) return
            try {
              ctx.drawImage(videoEl, 0, 0, w, h)
            } catch {
              if (drawInterval) clearInterval(drawInterval)
              if (recorder.state === 'recording') recorder.stop()
              return
            }
            const pct = 10 + Math.round((videoEl.currentTime / duration) * 85)
            onProgress?.(Math.min(pct, 95))
          }, Math.round(1000 / CAPTURE_FPS))

        }).catch(() => { cleanup(); resolve(fallback()) })

        videoEl.onended = () => {
          if (drawInterval) { clearInterval(drawInterval); drawInterval = null }
          try { ctx.drawImage(videoEl, 0, 0, w, h) } catch {}
          setTimeout(() => {
            if (recorder.state === 'recording') recorder.stop()
          }, 600)
        }

        // Nudge video back if it stalls mid-play (common on 2G/3G mobile)
        videoEl.onstalled = () => { videoEl.play().catch(() => {}) }

        // Stuck detection: if currentTime doesn't advance for 15s, give up
        let lastTime  = -1
        let stuckTick = 0
        stuckInterval = setInterval(() => {
          if (videoEl.ended) return
          if (videoEl.currentTime === lastTime) {
            if (++stuckTick >= 3) {
              if (recorder.state === 'recording') recorder.stop()
              else { cleanup(); resolve(fallback()) }
            }
          } else {
            lastTime  = videoEl.currentTime
            stuckTick = 0
          }
        }, 5_000)

      } catch {
        cleanup(); onProgress?.(100); resolve(fallback())
      }
    }
  })
}
