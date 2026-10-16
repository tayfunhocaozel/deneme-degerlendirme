import { createClient } from '@supabase/supabase-js'
import type { Database } from './veritabani'

// Publishable anahtar herkese açık olacak şekilde tasarlanmıştır; veriyi RLS korur.
// service_role anahtarı bu uygulamaya asla konmaz.
const SUPABASE_URL = 'https://ihucakamyxyulodwqsmm.supabase.co'
const SUPABASE_ANAHTAR = 'sb_publishable_jUU_Lso0cdNixoIeqi8DCA_gtz6Z16u'

// Davet ve şifre sıfırlama bağlantıları adrese "#...type=invite" ekler; istemci bunu
// okuyup adresten siler. Hangi bağlantıyla gelindiğini bilmek için önce saklıyoruz.
const gelisHash = window.location.hash
export const davetleGeldi = /type=(invite|recovery)/.test(gelisHash)

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANAHTAR)

// Uygulamanın yayınlandığı adres (davet / şifre sıfırlama e-postaları buraya döner).
export const UYGULAMA_ADRESI = window.location.origin + import.meta.env.BASE_URL

// Giriş ekranında seçilen sekme. Google girişi sayfadan ayrılıp geri döndüğü için saklanır;
// öğretmen olmayan hesabın başvuru formuna mı, öğrenci ekranına mı gideceğini belirler.
export type GirisTuru = 'ogretmen' | 'ogrenci'
const GIRIS_TURU_ANAHTARI = 'giris-turu'

export function girisTuruOku(): GirisTuru {
  try {
    return localStorage.getItem(GIRIS_TURU_ANAHTARI) === 'ogrenci' ? 'ogrenci' : 'ogretmen'
  } catch {
    return 'ogretmen'
  }
}

export function girisTuruYaz(tur: GirisTuru) {
  try {
    localStorage.setItem(GIRIS_TURU_ANAHTARI, tur)
  } catch {
    // Tarayıcı depolamayı engelliyorsa öğretmen varsayılır.
  }
}

// Veritabanı fonksiyonlarının raise exception ile verdiği kısa kodlar.
const FONKSIYON_HATALARI: Record<string, string> = {
  giris_gerekli: 'Önce giriş yapın.',
  zaten_ogretmen: 'Bu hesap zaten öğretmen.',
  eksik_bilgi: 'Ad soyad ve okul adı gerekli.',
  yetki_yok: 'Bu işlem için yetkiniz yok.',
  basvuru_yok: 'Başvuru bulunamadı.',
  ogretmen_hesabi: 'Öğretmen hesabıyla öğrenci eşleştirmesi yapılamaz.',
  erisim_yok: 'Bu denemeye erişimin yok.',
  sure_doldu: 'Bu denemenin süresi doldu; artık cevap gönderilemez.',
  eksik_cevap: 'Cevap sayısı soru sayısıyla uyuşmuyor.',
  gecersiz_cevap: 'Geçersiz bir cevap var.',
  zaten_gonderildi: 'Bu denemeyi zaten gönderdin; gönderim hakkı bir kez.',
}

// Supabase / Postgres hata kodlarını öğretmenin anlayacağı dile çevirir.
export function hataMetni(hata: { code?: string; message: string } | null): string {
  if (!hata) return ''
  if (hata.code === '23505') return 'Bu kayıt zaten var (aynı okul numarası bu sınıfta kayıtlı olabilir).'
  if (hata.code === '42501') return 'Bu işlem için yetkiniz yok.'
  if (hata.message === 'Invalid login credentials') return 'E-posta ya da şifre hatalı.'
  if (FONKSIYON_HATALARI[hata.message]) return FONKSIYON_HATALARI[hata.message]
  if (hata.message.includes('Failed to fetch')) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'
  return hata.message
}
