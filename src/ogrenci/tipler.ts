// Öğrenci tarafının veritabanı fonksiyonlarından dönen JSON biçimleri
// (bkz. supabase/migrations/20261016130000_ogrenci_girisi.sql).

export type Eslesme = {
  sinif: string
  ogretim_yili: string
  okul_no: string
  ad_soyad: string | null
  durum: 'onayli' | 'bekliyor' | 'cakisma'
}

export type Rol = {
  ogretmen: boolean
  yonetici: boolean
  basvuru: 'bekliyor' | 'onaylandi' | 'reddedildi' | null
  eslesmeler: Eslesme[]
}

export type SonucOzeti = { dogru: number; yanlis: number; bos: number; net: number }

export type OgrenciDenemesi = {
  uygulama_id: number
  deneme_kodu: string
  baslik: string
  soru_sayisi: number
  sure_dk: number | null
  tarih: string
  son_tarih: string | null
  acik: boolean
  kapali: boolean
  gonderildi: string | null
  sonuc: SonucOzeti | null
  sinif_ortalama: number | null
  kisi: number | null
}

export type KazanimOzeti = { kod: string; aciklama: string | null; dogru: number; toplam: number }

export type OgrenciOzeti = { denemeler: OgrenciDenemesi[]; kazanimlar: KazanimOzeti[] }

export type SoruSonucu = {
  sira: number
  isaretlenen: 'A' | 'B' | 'C' | 'D' | 'bos' | 'gecersiz'
  dogru_cevap: string
  kazanim: string | null
  konu: string | null
}

export type DenemeAyrintisi = OgrenciDenemesi & {
  giris_yolu: 'elle' | 'optik' | 'ogrenci' | null
  sorular: SoruSonucu[] | null
  kazanimlar: (KazanimOzeti & { sinif_oran: number })[] | null
}

export function sonTarihYaz(tarih: string): string {
  return new Date(tarih).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
