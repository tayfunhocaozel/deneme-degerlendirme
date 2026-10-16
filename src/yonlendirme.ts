import { useEffect, useState } from 'react'

// GitHub Pages yalnızca statik dosya sunduğu için sayfalar adresin # kısmında tutulur:
//   #/                sınıflar
//   #/sinif/12        12 numaralı sınıfın öğrencileri ve denemeleri
//   #/uygulama/5      5 numaralı uygulamanın (denemenin bir sınıftaki uygulanışı) cevap girişi
//   #/karne/40        40 numaralı öğrencinin karnesi
//   #/optik           telefon kamerasıyla optik form okuma
//   #/basvurular      öğretmen başvuruları (yalnızca yönetici)
//
// Öğrenci tarafı (ayrı bir uygulama gibi):
//   #/                açık denemeler
//   #/cevap/5         5 numaralı uygulamanın cevap ekranı
//   #/sonuc/5         sonuç ekranı
//   #/denemelerim     geçmiş denemeler
//   #/durum           genel durum
//   #/sinif-ekle      başka bir sınıfa eşleşme
export type Rota =
  | { sayfa: 'siniflar' }
  | { sayfa: 'sinif'; id: number }
  | { sayfa: 'uygulama'; id: number }
  | { sayfa: 'karne'; id: number }
  | { sayfa: 'optik' }
  | { sayfa: 'basvurular' }

export type OgrenciRota =
  | { sayfa: 'denemeler' }
  | { sayfa: 'cevap'; id: number }
  | { sayfa: 'sonuc'; id: number }
  | { sayfa: 'denemelerim' }
  | { sayfa: 'durum' }
  | { sayfa: 'sinif-ekle' }

function cozumle(hash: string): Rota {
  if (/^#\/optik/.test(hash)) return { sayfa: 'optik' }
  if (/^#\/basvurular/.test(hash)) return { sayfa: 'basvurular' }
  const eslesme = hash.match(/^#\/(sinif|uygulama|karne)\/(\d+)/)
  if (eslesme) return { sayfa: eslesme[1] as 'sinif' | 'uygulama' | 'karne', id: Number(eslesme[2]) }
  return { sayfa: 'siniflar' }
}

function ogrenciCozumle(hash: string): OgrenciRota {
  const eslesme = hash.match(/^#\/(cevap|sonuc)\/(\d+)/)
  if (eslesme) return { sayfa: eslesme[1] as 'cevap' | 'sonuc', id: Number(eslesme[2]) }
  if (/^#\/denemelerim/.test(hash)) return { sayfa: 'denemelerim' }
  if (/^#\/durum/.test(hash)) return { sayfa: 'durum' }
  if (/^#\/sinif-ekle/.test(hash)) return { sayfa: 'sinif-ekle' }
  return { sayfa: 'denemeler' }
}

export function useRota(): Rota {
  return useHashRota(cozumle)
}

export function useOgrenciRota(): OgrenciRota {
  return useHashRota(ogrenciCozumle)
}

function useHashRota<T>(coz: (hash: string) => T): T {
  const [rota, setRota] = useState(() => coz(window.location.hash))
  useEffect(() => {
    const dinle = () => {
      setRota(coz(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', dinle)
    return () => window.removeEventListener('hashchange', dinle)
  }, [])
  return rota
}

export function git(adres: string) {
  window.location.hash = adres
}
