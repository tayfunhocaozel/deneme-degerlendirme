// Web Worker: OpenCV.js'i (≈15 MB) yalnızca burada yükler ve formu ana iş parçacığını dondurmadan okur.
//
// OpenCV.js derlemeye sokulmaz: ?url ile dosya olduğu gibi yayınlanır ve klasik Worker'da importScripts ile
// yüklenir. Paket dışarıya gerçek bir Promise veriyor; yayın derlemesinin CommonJS dönüştürmesi bunu sahte bir
// Promise'e çeviriyor ve tarayıcı "Promise.prototype.then called on incompatible receiver" hatası veriyordu.
import cvAdresi from '@techstark/opencv-js/dist/opencv.js?url'
import { oku, OkumaHatasi, type QrBilgisi } from './okuyucu.ts'

export type IsIstegi = { id: number; gen: number; yuk: number; rgba: ArrayBuffer; qr: QrBilgisi | null }
export type IsYaniti =
  | { id: number; tamam: true; sonuc: ReturnType<typeof oku> }
  | { id: number; tamam: false; hata: string; beklenmedik?: boolean }
  | { id: -1; hazir: true }
  | { id: -1; hazir: false; hata: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cvSozu: Promise<any> | null = null
function cvYukle() {
  cvSozu ??= (async () => {
    ;(self as unknown as { importScripts: (u: string) => void }).importScripts(new URL(cvAdresi, self.location.href).href)
    // UMD sarmalayıcı Worker'da self.cv'ye OpenCV modülünü veren bir Promise koyar.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cv: any = (self as any).cv
    if (cv && typeof cv.then === 'function' && !cv.Mat) cv = await cv
    if (!cv?.Mat) await new Promise<void>((r) => (cv.onRuntimeInitialized = r))
    // Modül nesnesi bir sözün sonucu olarak dönülürse "thenable" sanılabilir; sarmalayıp dön.
    return { cv }
  })()
  return cvSozu
}

const kapsam = self as unknown as { postMessage: (m: IsYaniti, t?: Transferable[]) => void; onmessage: ((e: MessageEvent) => void) | null }

kapsam.onmessage = async (e: MessageEvent<IsIstegi | 'hazirla'>) => {
  if (e.data === 'hazirla') {
    // Yükleme hatası mutlaka ana sayfaya bildirilir; yoksa ekran sonsuza kadar bekler.
    try {
      await cvYukle()
      kapsam.postMessage({ id: -1, hazir: true })
    } catch (h) {
      cvSozu = null
      kapsam.postMessage({ id: -1, hazir: false, hata: String((h as Error)?.message ?? h) })
    }
    return
  }
  const { id, gen, yuk, rgba, qr } = e.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cv: any
  try {
    cv = (await cvYukle()).cv
  } catch (h) {
    cvSozu = null
    kapsam.postMessage({ id, tamam: false, hata: `Okuyucu yüklenemedi: ${String((h as Error)?.message ?? h)}`, beklenmedik: true })
    return
  }
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
