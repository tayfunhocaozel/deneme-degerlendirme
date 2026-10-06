// Okunan öğrenci numarasını öğretmenin sınıflarındaki aktif öğrencilerle eşler.
import type { Ogrenci, Sinif } from '../veritabani'
import type { NoDurumu } from './okuyucu.ts'

export type Eslesme =
  | { tur: 'tek'; ogrenci: Ogrenci }
  | { tur: 'coklu'; adaylar: Ogrenci[] }
  | { tur: 'yok'; mesaj: string }

// '0012', ' 12', '12' aynı sayılır.
export function noSayi(okulNo: string): number | null {
  const rakam = okulNo.replace(/\s/g, '')
  return /^\d+$/.test(rakam) ? Number(rakam) : null
}

export function eslestir(
  ogrenciNo: number | null,
  noDurum: NoDurumu,
  ogrenciler: Ogrenci[],
  siniflar: Sinif[],
  denemeSinifi: number,
): Eslesme {
  if (noDurum === 'gecersiz') return { tur: 'yok', mesaj: 'Öğrenci numarasında bir hanede iki işaret var.' }
  if (ogrenciNo === null) return { tur: 'yok', mesaj: 'Öğrenci numarası kodlanmamış.' }
  const aktifler = ogrenciler.filter((o) => o.aktif && noSayi(o.okul_no) === ogrenciNo)
  // Önce denemenin sınıf düzeyine uyan sınıflarda ara.
  const uygunSinif = new Set(siniflar.filter((s) => s.sinif_duzeyi === denemeSinifi).map((s) => s.id))
  const oncelikli = aktifler.filter((o) => uygunSinif.has(o.sinif_id))
  const adaylar = oncelikli.length ? oncelikli : aktifler
  if (adaylar.length === 1) return { tur: 'tek', ogrenci: adaylar[0] }
  if (adaylar.length > 1) return { tur: 'coklu', adaylar }
  return { tur: 'yok', mesaj: `Öğrenci numarası ${ogrenciNo} sistemde bulunamadı.` }
}
