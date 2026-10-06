// Ana iş parçacığı tarafı: Worker'ı başlatır, kareyi gönderir, sonucu bekler.
import type { IsIstegi, IsYaniti } from './isci.ts'
import type { OkumaSonucu, QrBilgisi } from './okuyucu.ts'

let isci: Worker | null = null
let sayac = 0
const bekleyenler = new Map<number, { coz: (s: OkumaSonucu) => void; reddet: (h: Error) => void }>()
let hazirSozu: Promise<void> | null = null

function isciAl(): Worker {
  if (isci) return isci
  // Klasik Worker: OpenCV.js importScripts ile yüklenir (bkz. isci.ts).
  isci = new Worker(new URL('./isci.ts', import.meta.url))
  isci.onmessage = (e: MessageEvent<IsYaniti>) => {
    const y = e.data
    if ('hazir' in y) return
    const b = bekleyenler.get(y.id)
    if (!b) return
    bekleyenler.delete(y.id)
    if (y.tamam) b.coz(y.sonuc)
    else b.reddet(new Error(y.hata))
  }
  isci.onerror = (e) => {
    for (const b of bekleyenler.values()) b.reddet(new Error(`Okuyucu başlatılamadı: ${e.message}`))
    bekleyenler.clear()
    isci = null
    hazirSozu = null
  }
  return isci
}

// Okuyucuyu (OpenCV) önceden yükler; kamera açılırken çağrılır ki ilk okuma beklemesin.
const YUKLEME_SINIRI_MS = 90_000

export function okuyucuyuHazirla(): Promise<void> {
  hazirSozu ??= new Promise<void>((coz, reddet) => {
    const w = isciAl()
    const bitir = (h?: Error) => {
      clearTimeout(sure)
      w.removeEventListener('message', dinle)
      if (h) {
        hazirSozu = null // bir sonraki denemede yeniden yüklensin
        reddet(h)
      } else coz()
    }
    const dinle = (e: MessageEvent<IsYaniti>) => {
      if (!('hazir' in e.data)) return
      bitir(e.data.hazir ? undefined : new Error(`Okuyucu yüklenemedi: ${e.data.hata}`))
    }
    const sure = setTimeout(
      () => bitir(new Error('Okuyucu 90 saniyede yüklenemedi. İnternet bağlantınızı kontrol edip yeniden deneyin.')),
      YUKLEME_SINIRI_MS,
    )
    w.addEventListener('message', dinle)
    w.addEventListener('error', (e) => bitir(new Error(`Okuyucu başlatılamadı: ${e.message || 'bilinmeyen hata'}`)), { once: true })
    w.postMessage('hazirla')
  })
  return hazirSozu
}

export function formuOku(goruntu: ImageData, qr: QrBilgisi | null): Promise<OkumaSonucu> {
  const w = isciAl()
  const id = ++sayac
  return new Promise((coz, reddet) => {
    bekleyenler.set(id, { coz, reddet })
    const istek: IsIstegi = { id, gen: goruntu.width, yuk: goruntu.height, rgba: goruntu.data.buffer as ArrayBuffer, qr }
    w.postMessage(istek, [istek.rgba])
  })
}
