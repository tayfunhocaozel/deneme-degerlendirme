// Web Worker: OpenCV.js'i (≈13 MB) yalnızca burada yükler ve formu ana iş parçacığını dondurmadan okur.
import { oku, OkumaHatasi, type QrBilgisi } from './okuyucu.ts'

export type IsIstegi = { id: number; gen: number; yuk: number; rgba: ArrayBuffer; qr: QrBilgisi | null }
export type IsYaniti =
  | { id: number; tamam: true; sonuc: ReturnType<typeof oku> }
  | { id: number; tamam: false; hata: string; beklenmedik?: boolean }
  | { id: -1; hazir: true }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cvSozu: Promise<any> | null = null
function cvYukle() {
  cvSozu ??= import('@techstark/opencv-js').then(async (m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cv: any = m.default ?? m
    if (cv instanceof Promise) cv = await cv
    else if (!cv.Mat) await new Promise<void>((r) => (cv.onRuntimeInitialized = r))
    return cv
  })
  return cvSozu
}

const kapsam = self as unknown as { postMessage: (m: IsYaniti, t?: Transferable[]) => void; onmessage: ((e: MessageEvent) => void) | null }

kapsam.onmessage = async (e: MessageEvent<IsIstegi | 'hazirla'>) => {
  if (e.data === 'hazirla') {
    await cvYukle()
    kapsam.postMessage({ id: -1, hazir: true })
    return
  }
  const { id, gen, yuk, rgba, qr } = e.data
  const cv = await cvYukle()
  const renkli = new cv.Mat(yuk, gen, cv.CV_8UC4)
  renkli.data.set(new Uint8Array(rgba))
  const gri = new cv.Mat()
  cv.cvtColor(renkli, gri, cv.COLOR_RGBA2GRAY)
  renkli.delete()
  try {
    const sonuc = oku(cv, gri, qr)
    kapsam.postMessage({ id, tamam: true, sonuc }, [sonuc.duz.veri.buffer])
  } catch (hata) {
    if (hata instanceof OkumaHatasi) kapsam.postMessage({ id, tamam: false, hata: hata.message })
    else kapsam.postMessage({ id, tamam: false, hata: `Beklenmeyen okuma hatası: ${String(hata)}`, beklenmedik: true })
  } finally {
    gri.delete()
  }
}
