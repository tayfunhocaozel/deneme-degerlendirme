// Ana iş parçacığı tarafı: Worker'ı başlatır, kareyi gönderir, sonucu bekler.
import type { IsIstegi, IsYaniti } from './isci.ts'
import type { OkumaSonucu, QrBilgisi } from './okuyucu.ts'

let isci: Worker | null = null
let sayac = 0
const bekleyenler = new Map<number, { coz: (s: OkumaSonucu) => void; reddet: (h: Error) => void }>()
let hazirSozu: Promise<void> | null = null

function isciAl(): Worker {
  if (isci) return isci
  isci = new Worker(new URL('./isci.ts', import.meta.url), { type: 'module' })
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
export function okuyucuyuHazirla(): Promise<void> {
  hazirSozu ??= new Promise((coz, reddet) => {
    const w = isciAl()
    const dinle = (e: MessageEvent<IsYaniti>) => {
      if ('hazir' in e.data) {
        w.removeEventListener('message', dinle)
        coz()
      }
    }
    w.addEventListener('message', dinle)
    w.addEventListener('error', () => reddet(new Error('Okuyucu yüklenemedi.')), { once: true })
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
