// Sınıf raporu ve soru analizi hesapları. Hepsi saf fonksiyon; veri sayfada yüklenir.
import type { DenemeSorusu, Isaret } from './veritabani'
import { ozetle, type Ozet } from './puan'

export type Kagit = { ogrenciId: number; isaretler: Isaret[] }

export const SECENEKLER = ['A', 'B', 'C', 'D'] as const
export type SecimSayilari = Record<Isaret, number>

export type SoruIstatistigi = {
  soru: DenemeSorusu
  n: number
  dogruOrani: number // gözlenen güçlük (p)
  secim: SecimSayilari
  ustOran: number // üst grupta doğru oranı
  altOran: number
  ayirt: number // ayırt edicilik (D = üst − alt)
  ustSecim: SecimSayilari
  altSecim: SecimSayilari
}

const bosSayac = (): SecimSayilari => ({ A: 0, B: 0, C: 0, D: 0, bos: 0, gecersiz: 0 })

export function kagitOzeti(k: Kagit, anahtar: string[]): Ozet {
  return ozetle(k.isaretler, anahtar)
}

// Netlere göre sıralayıp üst ve alt %27'lik grupları ayırır (Kelley yöntemi).
export function ustAltGruplar(kagitlar: Kagit[], anahtar: string[]) {
  const sirali = [...kagitlar].sort((a, b) => kagitOzeti(b, anahtar).net - kagitOzeti(a, anahtar).net)
  const adet = Math.max(1, Math.round(sirali.length * 0.27))
  return { ust: sirali.slice(0, adet), alt: sirali.slice(-adet) }
}

function say(kagitlar: Kagit[], i: number): SecimSayilari {
  const s = bosSayac()
  for (const k of kagitlar) s[k.isaretler[i] ?? 'bos']++
  return s
}

export function soruIstatistikleri(kagitlar: Kagit[], sorular: DenemeSorusu[]): SoruIstatistigi[] {
  const anahtar = sorular.map((s) => s.cevap)
  const { ust, alt } = ustAltGruplar(kagitlar, anahtar)
  return sorular.map((soru, i) => {
    const secim = say(kagitlar, i)
    const ustSecim = say(ust, i)
    const altSecim = say(alt, i)
    const n = kagitlar.length
    const dogruOrani = n ? secim[soru.cevap as Isaret] / n : 0
    const ustOran = ust.length ? ustSecim[soru.cevap as Isaret] / ust.length : 0
    const altOran = alt.length ? altSecim[soru.cevap as Isaret] / alt.length : 0
    return { soru, n, dogruOrani, secim, ustOran, altOran, ayirt: ustOran - altOran, ustSecim, altSecim }
  })
}

// --- Yorumlar ---

export const GUCLUK_ARALIGI: Record<string, [number, number]> = {
  kolay: [0.7, 1.01],
  orta: [0.4, 0.7],
  zor: [0, 0.4],
}

export function gozlenenGucluk(p: number): 'kolay' | 'orta' | 'zor' {
  return p >= 0.7 ? 'kolay' : p >= 0.4 ? 'orta' : 'zor'
}

// Bankadaki etiket ile gözlenen güçlüğü karşılaştırır.
export function guclukUyumu(etiket: string | null, p: number): 'uyumlu' | 'daha-kolay' | 'daha-zor' | 'etiketsiz' {
  if (!etiket || !GUCLUK_ARALIGI[etiket]) return 'etiketsiz'
  const [alt, ust] = GUCLUK_ARALIGI[etiket]
  if (p < alt) return 'daha-zor'
  if (p >= ust) return 'daha-kolay'
  return 'uyumlu'
}

// Ebel'in ölçütleri.
export function ayirtYorumu(d: number): { metin: string; sinif: 'iyi' | 'orta' | 'zayif' } {
  if (d >= 0.4) return { metin: 'Çok iyi', sinif: 'iyi' }
  if (d >= 0.3) return { metin: 'İyi', sinif: 'iyi' }
  if (d >= 0.2) return { metin: 'Gözden geçirilmeli', sinif: 'orta' }
  return { metin: 'Zayıf', sinif: 'zayif' }
}

export type CeldiriciDurumu = {
  sik: string
  oran: number
  ustOran: number
  altOran: number
  islevsiz: boolean // neredeyse hiç seçilmedi
  ters: boolean // üst grup alt gruptan daha çok seçmiş
}

export const ISLEVSIZ_ESIK = 0.05

export function celdiriciDurumlari(ist: SoruIstatistigi, ustAdet: number, altAdet: number): CeldiriciDurumu[] {
  return SECENEKLER.filter((s) => s !== ist.soru.cevap).map((sik) => {
    const oran = ist.n ? ist.secim[sik] / ist.n : 0
    const ustOran = ustAdet ? ist.ustSecim[sik] / ustAdet : 0
    const altOran = altAdet ? ist.altSecim[sik] / altAdet : 0
    return { sik, oran, ustOran, altOran, islevsiz: oran < ISLEVSIZ_ESIK, ters: ust(ustOran, altOran) }
  })
}

function ust(ustOran: number, altOran: number) {
  return ustOran > altOran && ustOran > 0
}

// Odak kazanıma (ilk kod) göre öğrenci başına doğru oranı.
export function kazanimMatrisi(sorular: DenemeSorusu[]) {
  const kazanimlar = [...new Set(sorular.map((s) => s.kazanim[0] ?? '—'))].sort((a, b) =>
    a.localeCompare(b, 'tr', { numeric: true }),
  )
  const sorularinKazanimi = sorular.map((s) => s.kazanim[0] ?? '—')
  const satir = (k: Kagit) =>
    Object.fromEntries(
      kazanimlar.map((kod) => {
        let dogru = 0
        let toplam = 0
        sorular.forEach((s, i) => {
          if (sorularinKazanimi[i] !== kod) return
          toplam++
          if (k.isaretler[i] === s.cevap) dogru++
        })
        return [kod, { dogru, toplam }]
      }),
    ) as Record<string, { dogru: number; toplam: number }>
  return { kazanimlar, satir }
}
