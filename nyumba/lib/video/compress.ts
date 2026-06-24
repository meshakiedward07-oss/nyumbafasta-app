// Browser-only video compression using canvas + MediaRecorder.
// Falls back to original file if browser lacks support or compression fails.

export interface CompressResult {
  file: File
  originalMB: number
  compressedMB: number
  wasCompressed: boolean
}

const MAX_WIDTH   = 1280
const MAX_HEIGHT  = 720
const CAPTURE_FPS = 24

export function canCompress(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof window.MediaRecorder !== 'undefined' &&
    typeof (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream === 'function'
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
  // Scale from 1.5 Mbps at 720p, at 0.7 quality
  return Math.round((w * h / (1280 * 720)) * 1_500_000 * 0.7)
}

export async function compressVideo(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<CompressResult> {
  const originalMB = file.size / (1024 * 1024)

  if (!canCompress()) {
    return { file, originalMB, compressedMB: originalMB, wasCompressed: false }
  }

  onProgress?.(5)

  return new Promise<CompressResult>(resolve => {
    const fallback = (): CompressResult => ({
      file, originalMB, compressedMB: originalMB, wasCompressed: false,
    })

    const videoEl = document.createElement('video')
    videoEl.muted = true
    videoEl.preload = 'metadata'
    videoEl.src = URL.createObjectURL(file)

    videoEl.onerror = () => {
      URL.revokeObjectURL(videoEl.src)
      onProgress?.(100)
      resolve(fallback())
    }

    videoEl.onloadedmetadata = () => {
      try {
        // Calculate output dimensions
        let w = videoEl.videoWidth
        let h = videoEl.videoHeight
        if (w > MAX_WIDTH) { h = Math.round(h * MAX_WIDTH / w); w = MAX_WIDTH }
        if (h > MAX_HEIGHT) { w = Math.round(w * MAX_HEIGHT / h); h = MAX_HEIGHT }
        // Codecs require even dimensions
        w = Math.floor(w / 2) * 2
        h = Math.floor(h / 2) * 2

        onProgress?.(10)

        const canvas = document.createElement('canvas')
        canvas.width  = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!

        const mimeType = getSupportedMimeType()
        const stream   = (canvas as unknown as { captureStream: (fps: number) => MediaStream }).captureStream(CAPTURE_FPS)

        // Attempt to attach audio
        try {
          const audioCtx = new AudioContext()
          const src = audioCtx.createMediaElementSource(videoEl)
          const dst = audioCtx.createMediaStreamDestination()
          src.connect(dst)
          const audioTrack = dst.stream.getAudioTracks()[0]
          if (audioTrack) stream.addTrack(audioTrack)
        } catch {
          // No audio — proceed without it
        }

        const chunks: Blob[] = []
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: targetBitrate(w, h),
        })
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

        recorder.onstop = () => {
          URL.revokeObjectURL(videoEl.src)
          const ext  = mimeType.includes('webm') ? 'webm' : 'mp4'
          const blob = new Blob(chunks, { type: mimeType })
          const out  = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, `.${ext}`),
            { type: mimeType },
          )
          onProgress?.(100)
          resolve({
            file: out,
            originalMB,
            compressedMB: out.size / (1024 * 1024),
            wasCompressed: true,
          })
        }

        const duration = videoEl.duration

        // Draw each frame while video plays
        const drawLoop = () => {
          if (!videoEl.ended && !videoEl.paused) {
            ctx.drawImage(videoEl, 0, 0, w, h)
            const pct = 10 + Math.round((videoEl.currentTime / duration) * 85)
            onProgress?.(Math.min(pct, 95))
            requestAnimationFrame(drawLoop)
          }
        }

        recorder.start(200)
        videoEl.play().then(drawLoop).catch(() => {
          recorder.stop()
          resolve(fallback())
        })

        videoEl.onended = () => {
          // Small delay so recorder captures the final frame
          setTimeout(() => recorder.stop(), 400)
        }

        // Safety timeout: 10 minutes max
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop()
        }, 600_000)

      } catch {
        URL.revokeObjectURL(videoEl.src)
        onProgress?.(100)
        resolve(fallback())
      }
    }
  })
}
