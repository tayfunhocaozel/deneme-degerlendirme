// Excel'den, yapıştırılan metinden (ileride fotoğraftan) gelen sınıf listesini
// { okul_no, ad_soyad } satırlarına çevirir.
//
// Desteklenen biçimler:
//   * Başlık satırı olan tablo: "S.No | Okul No | Adı | Soyadı" gibi; sütunlar başlıktan bulunur.
//   * Başlıksız tablo: satırdaki son sayı okul numarası, sayı olmayan hücreler ad soyad sayılır.
//   * Elle yazılmış satırlar: "245 Ali Yılmaz", "245. Ali Yılmaz", "Ali Yılmaz 245".

export type ListeSatiri = { okul_no: string; ad_soyad: string }

const SAYI = /^\d{1,8}$/
const NO_BASLIGI = /(okul|öğrenci|ogrenci)\s*(no|numara)|^numara$|^no$|^okul\s*no/i
const SIRA_BASLIGI = /^(s\.?\s*no|sıra|sira|#)$/i
const AD_BASLIGI = /ad|soyad|isim|öğrenci|ogrenci/i

function temizle(deger: unknown): string {
  return String(deger ?? '').replace(/\s+/g, ' ').trim()
}

// Tek hücreye yazılmış "245 Ali Yılmaz" gibi satırları ikiye böler.
function tekHucreyiBol(hucre: string): string[] {
  const basta = hucre.match(/^(\d{1,8})[\s.\-)]+(.+)$/)
  if (basta) return [basta[1], basta[2]]
  const sonda = hucre.match(/^(.+?)[\s\-]+(\d{1,8})$/)
  if (sonda) return [sonda[2], sonda[1]]
  return [hucre]
}

type Basliklar = { satir: number; no: number; adlar: number[] }

function basliklariBul(tablo: string[][]): Basliklar | null {
  for (let i = 0; i < Math.min(tablo.length, 6); i++) {
    const satir = tablo[i]
    const no = satir.findIndex((h) => NO_BASLIGI.test(h) && !SIRA_BASLIGI.test(h))
    if (no === -1) continue
    const adlar = satir
      .map((h, j) => (j !== no && AD_BASLIGI.test(h) && !NO_BASLIGI.test(h) ? j : -1))
      .filter((j) => j !== -1)
    if (adlar.length) return { satir: i, no, adlar }
  }
  return null
}

export function tabloyuAyristir(hamTablo: unknown[][]): ListeSatiri[] {
  const tablo = hamTablo.map((satir) => satir.map(temizle))
  const basliklar = basliklariBul(tablo)
  const sonuc: ListeSatiri[] = []

  if (basliklar) {
    for (const satir of tablo.slice(basliklar.satir + 1)) {
      const no = (satir[basliklar.no] ?? '').replace(/\D/g, '')
      const ad = temizle(basliklar.adlar.map((j) => satir[j] ?? '').join(' '))
      if (no || ad) sonuc.push({ okul_no: no, ad_soyad: ad })
    }
    return sonuc
  }

  for (const hamSatir of tablo) {
    let hucreler = hamSatir.filter(Boolean)
    if (hucreler.length === 1) hucreler = tekHucreyiBol(hucreler[0])
    const sayilar = hucreler.filter((h) => SAYI.test(h))
    if (sayilar.length === 0) continue // başlık ya da boş satır
    const ad = temizle(hucreler.filter((h) => !SAYI.test(h)).join(' '))
    sonuc.push({ okul_no: sayilar[sayilar.length - 1], ad_soyad: ad })
  }
  return sonuc
}

// Excel'den kopyalanan metin sekmeyle, CSV noktalı virgül ya da virgülle ayrılır.
export function metniAyristir(metin: string): ListeSatiri[] {
  const satirlar = metin.split(/\r?\n/).filter((s) => s.trim())
  const ayrac = satirlar.some((s) => s.includes('\t')) ? '\t' : satirlar.some((s) => s.includes(';')) ? ';' : null
  return tabloyuAyristir(satirlar.map((s) => (ayrac ? s.split(ayrac) : [s])))
}
