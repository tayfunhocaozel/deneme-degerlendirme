// Supabase şemasının TypeScript karşılığı (supabase gen types çıktısından sadeleştirildi).
// Şema değişince güncellenmeli.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Tablo<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Sinif = {
  id: number
  ogretmen_id: string
  ad: string
  sinif_duzeyi: number
  ogretim_yili: string
  aciklama: string | null
  katilim_kodu: string
  created_at: string
}

export type Ogrenci = {
  id: number
  sinif_id: number
  okul_no: string
  ad_soyad: string
  aktif: boolean
  created_at: string
}

export type Ogretmen = {
  id: string
  ad_soyad: string
  yonetici: boolean
  created_at: string
}

export type Deneme = {
  id: number
  deneme_kodu: string
  surum: number
  sema_surumu: number
  sinif: number
  tur: string
  baslik: string
  sure_dk: number | null
  soru_sayisi: number
  uretim_zamani: string
  aktarim_zamani: string
}

export type DenemeSorusu = {
  deneme_id: number
  sira: number
  soru_id: string
  konu_no: string | null
  konu: string | null
  kazanim: string[]
  bloom: string | null
  pisa: string | null
  gucluk: string | null
  cevap: string
  ozet: string | null
  secenekler: Json
  celdiriciler: Json
  grup: string | null
}

export type Uygulama = {
  id: number
  sinif_id: number
  deneme_id: number
  tarih: string
  ogrenci_girisi: boolean
  son_tarih: string | null
  created_at: string
}

export type Sonuc = {
  id: number
  uygulama_id: number
  ogrenci_id: number
  giris_yolu: GirisYolu
  onaylandi: boolean
  created_at: string
  updated_at: string
}

export type GirisYolu = 'elle' | 'optik' | 'ogrenci'

// Öğrenci hesabı ↔ öğrenci kaydı. 'bekliyor': aynı numarada başka hesap var, öğretmen seçecek.
export type OgrenciHesabi = {
  id: number
  kullanici_id: string
  ogrenci_id: number
  durum: 'onayli' | 'bekliyor'
  google_ad: string
  eposta: string
  created_at: string
}

export type OgrenciGonderimi = {
  uygulama_id: number
  ogrenci_id: number
  kullanici_id: string
  cevaplar: Isaret[]
  gonderildi: string
}

export type OgretmenBasvurusu = {
  kullanici_id: string
  ad_soyad: string
  okul: string
  eposta: string
  durum: 'bekliyor' | 'onaylandi' | 'reddedildi'
  created_at: string
  karar_zamani: string | null
}

export type Isaret = 'A' | 'B' | 'C' | 'D' | 'bos' | 'gecersiz'

export type Cevap = {
  sonuc_id: number
  sira: number
  isaretlenen: Isaret
}

export type Database = {
  public: {
    Tables: {
      ogretmenler: Tablo<Ogretmen, { id: string; ad_soyad?: string }>
      siniflar: Tablo<
        Sinif,
        { ad: string; sinif_duzeyi: number; ogretim_yili: string; aciklama?: string | null }
      >
      ogrenciler: Tablo<
        Ogrenci,
        { sinif_id: number; okul_no: string; ad_soyad: string; aktif?: boolean }
      >
      kazanimlar: Tablo<{ kod: string; aciklama: string }, { kod: string; aciklama: string }>
      denemeler: Tablo<Deneme, never, never>
      deneme_sorulari: Tablo<DenemeSorusu, never, never>
      uygulamalar: Tablo<
        Uygulama,
        { sinif_id: number; deneme_id: number; tarih?: string; ogrenci_girisi?: boolean; son_tarih?: string | null }
      >
      sonuclar: Tablo<
        Sonuc,
        {
          uygulama_id: number
          ogrenci_id: number
          giris_yolu?: 'elle' | 'optik'
          onaylandi?: boolean
          updated_at?: string
        }
      >
      cevaplar: Tablo<Cevap, Cevap>
      ogrenci_hesaplari: Tablo<OgrenciHesabi, never, { ogrenci_id?: number; durum?: 'onayli' | 'bekliyor' }>
      ogrenci_gonderimleri: Tablo<OgrenciGonderimi, never, never>
      ogretmen_basvurulari: Tablo<OgretmenBasvurusu, never, never>
    }
    Views: {
      cevap_degerlendirme: {
        Row: {
          sonuc_id: number
          uygulama_id: number
          sinif_id: number
          ogrenci_id: number
          deneme_id: number
          sira: number
          isaretlenen: Isaret
          dogru_cevap: string
          dogru_mu: boolean | null
          yanilgi: string | null
          soru_id: string
          kazanim: string[]
          bloom: string | null
          pisa: string | null
          gucluk: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      sonuc_kaydet: {
        Args: {
          p_uygulama_id: number
          p_ogrenci_id: number
          p_cevaplar: string[]
          p_giris_yolu?: string
          p_uzerine_yaz?: boolean
        }
        Returns: number
      }
      rolum: { Args: Record<string, never>; Returns: Json }
      ogretmen_basvur: { Args: { p_ad_soyad: string; p_okul: string }; Returns: string }
      basvuru_karar: { Args: { p_kullanici_id: string; p_onay: boolean }; Returns: undefined }
      ogrenci_eslestir: { Args: { p_sinif_kodu: string; p_okul_no: string }; Returns: string }
      ogrenci_ozeti: { Args: Record<string, never>; Returns: Json }
      ogrenci_deneme: { Args: { p_uygulama_id: number }; Returns: Json }
      ogrenci_gonder: { Args: { p_uygulama_id: number; p_cevaplar: string[] }; Returns: Json }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
