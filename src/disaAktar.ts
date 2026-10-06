// Excel dosyası üretir. Kütüphane büyük olduğu için yalnızca düğmeye basılınca indirilir.
export type Sayfa = { ad: string; satirlar: (string | number | null)[][] }

export async function exceleAktar(dosyaAdi: string, sayfalar: Sayfa[]) {
  const { utils, writeFile } = await import('xlsx')
  const kitap = utils.book_new()
  for (const s of sayfalar) {
    const tablo = utils.aoa_to_sheet(s.satirlar)
    // Sütun genişliklerini içeriğe göre ayarla (en fazla 60 karakter).
    const genislik: number[] = []
    for (const satir of s.satirlar)
      satir.forEach((h, i) => (genislik[i] = Math.min(60, Math.max(genislik[i] ?? 4, String(h ?? '').length + 2))))
    tablo['!cols'] = genislik.map((wch) => ({ wch }))
    utils.book_append_sheet(kitap, tablo, s.ad.slice(0, 31))
  }
  writeFile(kitap, dosyaAdi.replace(/[\\/:*?"<>|]/g, '-'))
}

// Excel'de yüzde olarak görünecek değer (0,734 → 73,4).
export const yuzdeSayi = (oran: number) => Math.round(oran * 1000) / 10
export const netSayi = (net: number) => Math.round(net * 100) / 100
