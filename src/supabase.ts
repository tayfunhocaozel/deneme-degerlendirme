import { createClient } from '@supabase/supabase-js'
import type { Database } from './veritabani'

// Publishable anahtar herkese açık olacak şekilde tasarlanmıştır; veriyi RLS korur.
// service_role anahtarı bu uygulamaya asla konmaz.
const SUPABASE_URL = 'https://ihucakamyxyulodwqsmm.supabase.co'
const SUPABASE_ANAHTAR = 'sb_publishable_jUU_Lso0cdNixoIeqi8DCA_gtz6Z16u'

// Davet ve şifre sıfırlama bağlantıları adrese "#...type=invite" ekler; istemci bunu
// okuyup adresten siler. Hangi bağlantıyla gelindiğini bilmek için önce saklıyoruz.
const gelisHash = window.location.hash
export const davetleGeldi = /type=(invite|recovery|signup)/.test(gelisHash)

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANAHTAR)

// Uygulamanın yayınlandığı adres (davet / şifre sıfırlama e-postaları buraya döner).
export const UYGULAMA_ADRESI = window.location.origin + import.meta.env.BASE_URL

// Supabase / Postgres hata kodlarını öğretmenin anlayacağı dile çevirir.
export function hataMetni(hata: { code?: string; message: string } | null): string {
  if (!hata) return ''
  if (hata.code === '23505') return 'Bu kayıt zaten var (aynı okul numarası bu sınıfta kayıtlı olabilir).'
  if (hata.code === '42501') return 'Bu işlem için yetkiniz yok.'
  if (hata.message === 'Invalid login credentials') return 'E-posta ya da şifre hatalı.'
  if (hata.message.includes('Failed to fetch')) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'
  return hata.message
}
