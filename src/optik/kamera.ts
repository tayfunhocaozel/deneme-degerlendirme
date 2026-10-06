// Kamera, fener, tarayıcının yerleşik QR dedektörü ve netlik ölçümü.
import type { Nokta, QrBilgisi } from './okuyucu.ts'

type AlgilananKod = { rawValue: string; format: string; cornerPoints: { x: number; y: number }[] }
type BarkodDedektoru = { detect(kaynak: CanvasImageSource): Promise<AlgilananKod[]> }
declare global {
  interface Window {
    BarcodeDetector?: {
      new (secenek: { formats: string[] }): BarkodDedektoru
      getSupportedFormats(): Promise<string[]>
    }
  }
}

export const QR_BICIMI = /^([^|]{1,20})\|(\d{1,3})$/ // "8-D04|1"

let dedektor: BarkodDedektoru | null | undefined
export async function yerlesikQrVar(): Promise<boolean> {
  if (dedektor !== undefined) return dedektor !== null
  try {
    if (window.BarcodeDetector && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code'))
      dedektor = new window.BarcodeDetector({ formats: ['qr_code'] })
    else dedektor = null
  } catch {
    dedektor = null
  }
  return dedektor !== null
}

export type Kamera = { akis: MediaStream; iz: MediaStreamTrack; fenerVar: boolean }

export async function kameraAc(video: HTMLVideoElement): Promise<Kamera> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu tarayıcı kameraya erişemiyor. Chrome ile ve https adresinden açın.')
  let akis: MediaStream
  try {
    akis = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
    })
  } catch (h) {
    const ad = (h as DOMException).name
    if (ad === 'NotAllowedError')
      throw new Error('Kamera izni verilmedi. Adres çubuğundaki kilit simgesinden kameraya izin verip sayfayı yenileyin.')
    if (ad === 'NotFoundError') throw new Error('Kamera bulunamadı.')
    if (ad === 'NotReadableError') throw new Error('Kamera başka bir uygulama tarafından kullanılıyor.')
    throw new Error(`Kamera açılamadı: ${(h as Error).message}`)
  }
  const iz = akis.getVideoTracks()[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yetenek = (iz.getCapabilities?.() ?? {}) as any
  if (Array.isArray(yetenek.focusMode) && yetenek.focusMode.includes('continuous'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await iz.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {})
  video.srcObject = akis
  video.setAttribute('playsinline', 'true')
  video.muted = true
  await video.play()
  return { akis, iz, fenerVar: !!yetenek.torch }
}

export async function fener(iz: MediaStreamTrack, acik: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await iz.applyConstraints({ advanced: [{ torch: acik } as any] })
}

export function kameraKapat(k: Kamera | null) {
  k?.akis.getTracks().forEach((t) => t.stop())
}

// Kadrajdaki platform QR'larından merkeze en yakın olanı (kesilmemiş kâğıtta birden çok form olabilir).
export async function qrAra(video: HTMLVideoElement): Promise<QrBilgisi | null> {
  if (!dedektor) return null
  let kodlar: AlgilananKod[]
  try {
    kodlar = await dedektor.detect(video)
  } catch {
    return null
  }
  const mx = video.videoWidth / 2
  const my = video.videoHeight / 2
  const uygun = kodlar
    .filter((k) => QR_BICIMI.test(k.rawValue.trim()) && k.cornerPoints.length === 4)
    .map((k) => {
      const kose: Nokta[] = k.cornerPoints.map((p) => [p.x, p.y])
      const cx = kose.reduce((t, p) => t + p[0], 0) / 4
      const cy = kose.reduce((t, p) => t + p[1], 0) / 4
      return { qr: { metin: k.rawValue.trim(), kose }, d: Math.hypot(cx - mx, cy - my) }
    })
    .sort((a, b) => a.d - b.d)
  return uygun[0]?.qr ?? null
}

// QR bölgesinin netliği: Laplace varyansı (küçük bir tuvalde).
const netlikTuvali = typeof document !== 'undefined' ? document.createElement('canvas') : null
export function netlik(video: HTMLVideoElement, qr: QrBilgisi): number {
  if (!netlikTuvali) return 0
  const xs = qr.kose.map((p) => p[0])
  const ys = qr.kose.map((p) => p[1])
  const x0 = Math.max(0, Math.min(...xs))
  const y0 = Math.max(0, Math.min(...ys))
  const w = Math.min(video.videoWidth - x0, Math.max(...xs) - x0)
  const h = Math.min(video.videoHeight - y0, Math.max(...ys) - y0)
  if (w < 8 || h < 8) return 0
  const N = 96
  netlikTuvali.width = N
  netlikTuvali.height = N
  const c = netlikTuvali.getContext('2d', { willReadFrequently: true })!
  c.drawImage(video, x0, y0, w, h, 0, 0, N, N)
  const d = c.getImageData(0, 0, N, N).data
  const g = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) g[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]
  let t = 0
  let t2 = 0
  let n = 0
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x
      const l = g[i - 1] + g[i + 1] + g[i - N] + g[i + N] - 4 * g[i]
      t += l
      t2 += l * l
      n++
    }
  return t2 / n - (t / n) ** 2
}

// Videonun o anki karesini tam çözünürlükte alır.
export function kareYakala(video: HTMLVideoElement): ImageData {
  const t = document.createElement('canvas')
  t.width = video.videoWidth
  t.height = video.videoHeight
  const c = t.getContext('2d', { willReadFrequently: true })!
  c.drawImage(video, 0, 0)
  return c.getImageData(0, 0, t.width, t.height)
}
