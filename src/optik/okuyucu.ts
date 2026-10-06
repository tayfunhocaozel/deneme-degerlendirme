// Optik form okuyucu (OpenCV.js). Soru üretim tarafındaki referans okuyucunun
// (scripts/lgs8/optik_oku_ornek.py) birebir karşılığıdır; eşikler aynıdır. Bilinçli iki fark:
//   1. Köşe işareti adayları RETR_LIST ile aranır (referans: RETR_EXTERNAL). Kâğıt koyu bir masadayken
//      kenarında oluşan halka bütün işaretleri "iç kontur" yapıyor ve referans hiçbirini bulamıyordu.
//   2. Görüntü, QR boyutundan hesaplanan ölçekle ~10 px/mm'ye küçültülür. Daha büyük görüntülerde
//      4 mm'lik işaret 51 px'lik eşik penceresinden büyük kalıyor, içi boş görünüp eleniyordu.
// Her ikisi de üretilmiş test fotoğraflarıyla gösterildi (değiştirilmemiş referans 12'de 2, bu sürüm 12'de 10 doğru,
// 2 ret, 0 yanlış). DOM'a bağlı değildir; Web Worker'da ve testte Node'da çalışır.
import { SABLON } from './sablon.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any
export type Nokta = [number, number]
export type QrBilgisi = { metin: string; kose: Nokta[] }
export type Isaret = 'A' | 'B' | 'C' | 'D' | 'bos' | 'gecersiz'
export type NoDurumu = 'tamam' | 'bos' | 'gecersiz' | 'ortada_bos_hane'

export type SoruOkumasi = { isaret: Isaret; koyuluklar: number[]; supheli: boolean }
export type OkumaSonucu = {
  qr: string
  ogrenciNo: number | null
  noDurum: NoDurumu
  noHaneler: (number | null)[]
  noSupheli: boolean
  cevaplar: SoruOkumasi[]
  duz: { gen: number; yuk: number; veri: Uint8Array } // düzeltilmiş form (gri, 1 mm = 8 px)
}

export class OkumaHatasi extends Error {}

export const OLCEK = 8 // düzeltilmiş görüntüde 1 mm = 8 px
export const HEDEF_PXMM = 10
const MUTLAK = 0.35
const FARK = 0.15

// --- Küçük geometri yardımcıları ---

// 4 nokta → 4 nokta perspektif dönüşümü (cv.getPerspectiveTransform ile aynı denklem sistemi).
function perspektif(kaynak: Nokta[], hedef: Nokta[]): number[] {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = kaynak[i]
    const [u, v] = hedef[i]
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u])
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v])
  }
  // Gauss eleme (kısmi pivot)
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    if (Math.abs(A[c][c]) < 1e-12) return []
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const k = A[r][c] / A[c][c]
      for (let j = c; j < 9; j++) A[r][j] -= k * A[c][j]
    }
  }
  const h = A.map((r, i) => r[8] / r[i])
  return [...h, 1]
}

function uygula(H: number[], [x, y]: Nokta): Nokta {
  const w = H[6] * x + H[7] * y + H[8]
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]
}

const uzaklik = (a: Nokta, b: Nokta) => Math.hypot(a[0] - b[0], a[1] - b[1])
const ortalama = (n: Nokta[]): Nokta => [n.reduce((t, p) => t + p[0], 0) / n.length, n.reduce((t, p) => t + p[1], 0) / n.length]

function* dortluler(n: number) {
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) yield [a, b, c, d]
}

// --- QR (BarcodeDetector yoksa) ---

export function qrBul(cv: CV, gri: CV): QrBilgisi | null {
  const dedektorler = [new cv.QRCodeDetector()]
  if (cv.QRCodeDetectorAruco) dedektorler.push(new cv.QRCodeDetectorAruco())
  const bulanik = new cv.Mat()
  const keskin = new cv.Mat()
  cv.GaussianBlur(gri, bulanik, new cv.Size(0, 0), 3)
  cv.addWeighted(gri, 1.8, bulanik, -0.8, 0, keskin)
  bulanik.delete()
  try {
    for (const goruntu of [gri, keskin])
      for (const det of dedektorler)
        for (const olcek of [1.0, 0.5, 1.5]) {
          let g = goruntu
          if (olcek !== 1) {
            g = new cv.Mat()
            cv.resize(goruntu, g, new cv.Size(0, 0), olcek, olcek, cv.INTER_LINEAR)
          }
          const noktalar = new cv.Mat()
          try {
            const metin: string = det.detectAndDecode(g, noktalar)
            if (metin && noktalar.rows * noktalar.cols >= 4) {
              const d = noktalar.data32F
              const kose: Nokta[] = [0, 1, 2, 3].map((i) => [d[2 * i] / olcek, d[2 * i + 1] / olcek])
              return { metin, kose }
            }
          } catch {
            // bu dedektör/ölçek çözemedi; sıradakine geç
          } finally {
            noktalar.delete()
            if (g !== goruntu) g.delete()
          }
        }
  } finally {
    keskin.delete()
    dedektorler.forEach((d) => d.delete())
  }
  return null
}

// --- Köşe işaretleri ---

function isaretAdaylari(cv: CV, gri: CV, qrKose: Nokta[]): [number, number, number][] {
  const ikili = new cv.Mat()
  cv.adaptiveThreshold(gri, ikili, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 51, 15)
  const konturlar = new cv.MatVector()
  const hiyerarsi = new cv.Mat()
  cv.findContours(ikili, konturlar, hiyerarsi, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
  const qrPoligon = cv.matFromArray(4, 1, cv.CV_32FC2, qrKose.flat())
  const adaylar: [number, number, number][] = []
  const bos = new cv.Mat()
  for (let i = 0; i < konturlar.size(); i++) {
    const k = konturlar.get(i)
    try {
      const alan = cv.contourArea(k)
      if (alan < 40) continue
      const dr = cv.minAreaRect(k)
      const rw = dr.size.width
      const rh = dr.size.height
      if (Math.min(rw, rh) < 1 || !(rw / rh > 0.6 && rw / rh < 1.66)) continue
      const kareDolulugu = alan / (rw * rh) // kare ≈ 0,95+, daire ≈ 0,79
      if (!(kareDolulugu > 0.88)) continue
      const r = cv.boundingRect(k)
      const ic = ikili.roi(r)
      const maske = cv.Mat.zeros(r.height, r.width, cv.CV_8UC1)
      cv.drawContours(maske, konturlar, i, new cv.Scalar(255), -1, cv.LINE_8, bos, 0, new cv.Point(-r.x, -r.y))
      const siyahlik = cv.mean(ic, maske)[0] / 255 // içi dolu mu (boş baloncuk çemberi elenir)
      ic.delete()
      maske.delete()
      if (!(siyahlik > 0.85)) continue
      const m = cv.moments(k)
      const c: Nokta = [m.m10 / m.m00, m.m01 / m.m00]
      if (cv.pointPolygonTest(qrPoligon, new cv.Point(c[0], c[1]), false) >= 0) continue // QR'ın içindeki kareler
      adaylar.push([c[0], c[1], alan])
    } finally {
      k.delete()
    }
  }
  ikili.delete()
  konturlar.delete()
  hiyerarsi.delete()
  qrPoligon.delete()
  bos.delete()
  if (!adaylar.length) return adaylar
  // En büyük işaretlerin %45'inden küçükler elenir.
  const alanlar = adaylar.map((a) => a[2]).sort((a, b) => a - b)
  const esik = 0.45 * alanlar[alanlar.length - Math.min(4, alanlar.length)]
  return adaylar.filter((a) => a[2] >= esik)
}

// Fotoğraftaki formu düzeltir. Dönen Mat'ı çağıran siler.
function duzelt(cv: CV, gri: CV, qr: QrBilgisi): CV {
  const ka = SABLON.qr.kod_alani
  const qrMerkezSablon: Nokta = [ka.x + ka.kenar / 2, ka.y + ka.kenar / 2]
  const m = SABLON.isaret_merkezleri
  const hedefMm: Nokta[] = [m.sol_ust, m.sag_ust, m.sol_alt, m.sag_alt]
  let adaylar = isaretAdaylari(cv, gri, qr.kose)
  if (adaylar.length < 4) throw new OkumaHatasi('Köşe işaretleri bulunamadı: formun dört köşesi de kadrajda olmalı.')
  const qrMerkez = ortalama(qr.kose)
  if (adaylar.length > 14)
    adaylar = adaylar
      .map((a) => ({ a, d: uzaklik([a[0], a[1]], qrMerkez) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, 14)
      .map((x) => x.a)

  // Aday dörtlülerden, düzeltildiğinde QR'ı şablondaki yerine oturtanı seç (komşu formlar karışmasın).
  let enIyi: Nokta[] | null = null
  let enHata = Infinity
  for (const dortlu of dortluler(adaylar.length)) {
    const p: Nokta[] = dortlu.map((i) => [adaylar[i][0], adaylar[i][1]])
    const toplam = p.map((q) => q[0] + q[1])
    const fark = p.map((q) => q[1] - q[0])
    const argmin = (d: number[]) => d.indexOf(Math.min(...d))
    const argmax = (d: number[]) => d.indexOf(Math.max(...d))
    const sirali = [p[argmin(toplam)], p[argmin(fark)], p[argmax(fark)], p[argmax(toplam)]]
    if (new Set(sirali.map((q) => q.join(','))).size < 4) continue
    const ust = uzaklik(sirali[1], sirali[0])
    const alt = uzaklik(sirali[3], sirali[2])
    const sol = uzaklik(sirali[2], sirali[0])
    const sag = uzaklik(sirali[3], sirali[1])
    if (Math.min(ust, alt, sol, sag) < 1 || Math.max(ust, alt) > 1.4 * Math.min(ust, alt) || Math.max(sol, sag) > 1.4 * Math.min(sol, sag))
      continue
    const H = perspektif(sirali, hedefMm) // foto → şablon (mm)
    if (!H.length) continue
    const hata = uzaklik(uygula(H, qrMerkez), qrMerkezSablon)
    if (hata < enHata) {
      enIyi = sirali
      enHata = hata
    }
  }
  if (!enIyi || enHata > 4.0)
    throw new OkumaHatasi('Form doğrulanamadı: köşe işaretleri ile QR uyuşmuyor. Formun dört köşesi kadrajda olmalı.')

  const H = perspektif(enIyi, hedefMm.map(([x, y]) => [x * OLCEK, y * OLCEK] as Nokta))
  const Hm = cv.matFromArray(3, 3, cv.CV_64F, H)
  const [g, y] = SABLON.form_boyutu
  const duz = new cv.Mat()
  cv.warpPerspective(gri, duz, Hm, new cv.Size(Math.trunc(g * OLCEK), Math.trunc(y * OLCEK)), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255))
  Hm.delete()
  // Işık dengeleme: kâğıt zeminine böl.
  const zemin = new cv.Mat()
  const cekirdek = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(41, 41))
  cv.morphologyEx(duz, zemin, cv.MORPH_CLOSE, cekirdek)
  const sonuc = new cv.Mat()
  cv.divide(duz, zemin, sonuc, 255)
  duz.delete()
  zemin.delete()
  cekirdek.delete()
  return sonuc
}

// --- Baloncuklar ---

// cv.circle ile aynı piksel kümesini kullanmak için daire maskesini bir kez çiz, ofsetleri sakla.
let daireOfsetleri: Nokta[] | null = null
function ofsetler(cv: CV, r: number): Nokta[] {
  if (daireOfsetleri) return daireOfsetleri
  const boyut = 2 * r + 3
  const m = cv.Mat.zeros(boyut, boyut, cv.CV_8UC1)
  cv.circle(m, new cv.Point(r + 1, r + 1), r, new cv.Scalar(255), -1)
  const liste: Nokta[] = []
  for (let yy = 0; yy < boyut; yy++) for (let xx = 0; xx < boyut; xx++) if (m.ucharAt(yy, xx)) liste.push([xx - r - 1, yy - r - 1])
  m.delete()
  daireOfsetleri = liste
  return liste
}

function koyuluk(duz: CV, ofs: Nokta[], x: number, y: number): number {
  const cx = Math.round(x * OLCEK)
  const cy = Math.round(y * OLCEK)
  const veri: Uint8Array = duz.data
  const gen = duz.cols
  let toplam = 0
  let adet = 0
  for (const [dx, dy] of ofs) {
    const px = cx + dx
    const py = cy + dy
    if (px < 0 || py < 0 || px >= gen || py >= duz.rows) continue
    toplam += veri[py * gen + px]
    adet++
  }
  return 1 - toplam / adet / 255
}

type Secim = { i: number | null; durum: 'tamam' | 'bos' | 'gecersiz'; supheli: boolean }

function sec(d: number[]): Secim {
  const sira = d.map((_, i) => i).sort((a, b) => d[b] - d[a] || a - b)
  const en = d[sira[0]]
  const ikinci = d[sira[1]]
  if (en < MUTLAK) return { i: null, durum: 'bos', supheli: en >= 0.25 } // soluk bir iz olabilir
  if (ikinci >= MUTLAK || en - ikinci < FARK) return { i: null, durum: 'gecersiz', supheli: true }
  return { i: sira[0], durum: 'tamam', supheli: en < 0.45 || en - ikinci < 0.22 } // eşiğe yakın
}

// --- Ana işlev ---

export function oku(cv: CV, griTam: CV, verilenQr: QrBilgisi | null): OkumaSonucu {
  let qr = verilenQr ?? qrBul(cv, griTam)
  if (!qr) throw new OkumaHatasi('QR okunamadı: formu düz ve net çekin, QR görünür olsun.')

  // QR boyutundan ölçek: ~10 px/mm'den büyükse küçült.
  const pxmm = uzaklik(qr.kose[0], qr.kose[1]) / SABLON.qr.kod_alani.kenar
  let gri = griTam
  if (pxmm > HEDEF_PXMM * 1.05) {
    const k = HEDEF_PXMM / pxmm
    gri = new cv.Mat()
    cv.resize(griTam, gri, new cv.Size(0, 0), k, k, cv.INTER_AREA)
    // Referansla aynı: QR küçültülmüş görüntüde yeniden aranır; bulunamazsa ölçeklenmiş köşeler kullanılır.
    const yeni = verilenQr ? null : qrBul(cv, gri)
    qr = yeni ?? { metin: qr.metin, kose: qr.kose.map(([x, y]) => [x * k, y * k] as Nokta) }
  }

  let duz: CV
  try {
    duz = duzelt(cv, gri, qr)
  } finally {
    if (gri !== griTam) gri.delete()
  }

  try {
    const ofs = ofsetler(cv, Math.trunc(SABLON.baloncuk_yaricap * OLCEK * 0.7))
    const noHaneler: (number | null)[] = []
    let noDurum: NoDurumu = 'tamam'
    let noSupheli = false
    for (const sutun of SABLON.ogrenci_no.baloncuklar) {
      const s = sec(sutun.map(([x, y]) => koyuluk(duz, ofs, x, y)))
      if (s.durum === 'gecersiz') noDurum = 'gecersiz'
      if (s.supheli) noSupheli = true
      noHaneler.push(s.i)
    }
    const rakamlar = noHaneler.filter((h) => h !== null).join('')
    const dolu = noHaneler.map((h, i) => (h !== null ? i : -1)).filter((i) => i >= 0)
    if (noDurum === 'tamam' && dolu.length && noHaneler.slice(dolu[0], dolu[dolu.length - 1]).some((h) => h === null))
      noDurum = 'ortada_bos_hane' // " 9 07" → 907 okunur ama öğretmene gösterilir
    if (!rakamlar && noDurum !== 'gecersiz') noDurum = 'bos'

    const cevaplar: SoruOkumasi[] = SABLON.cevaplar.baloncuklar.map((sira) => {
      const koyuluklar = sira.map(([x, y]) => koyuluk(duz, ofs, x, y))
      const s = sec(koyuluklar)
      const isaret: Isaret = s.i !== null ? (['A', 'B', 'C', 'D'] as const)[s.i] : s.durum === 'bos' ? 'bos' : 'gecersiz'
      return { isaret, koyuluklar, supheli: s.supheli }
    })

    return {
      qr: qr.metin,
      ogrenciNo: rakamlar && noDurum !== 'gecersiz' ? Number(rakamlar) : null,
      noDurum,
      noHaneler,
      noSupheli,
      cevaplar,
      duz: { gen: duz.cols, yuk: duz.rows, veri: new Uint8Array(duz.data) },
    }
  } finally {
    duz.delete()
  }
}
