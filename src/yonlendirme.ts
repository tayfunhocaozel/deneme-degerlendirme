import { useEffect, useState } from 'react'

// GitHub Pages yalnızca statik dosya sunduğu için sayfalar adresin # kısmında tutulur:
//   #/                sınıflar
//   #/sinif/12        12 numaralı sınıfın öğrencileri ve denemeleri
//   #/uygulama/5      5 numaralı uygulamanın (denemenin bir sınıftaki uygulanışı) cevap girişi
//   #/karne/40        40 numaralı öğrencinin karnesi
export type Rota =
  | { sayfa: 'siniflar' }
  | { sayfa: 'sinif'; id: number }
  | { sayfa: 'uygulama'; id: number }
  | { sayfa: 'karne'; id: number }

function cozumle(hash: string): Rota {
  const eslesme = hash.match(/^#\/(sinif|uygulama|karne)\/(\d+)/)
  if (eslesme) return { sayfa: eslesme[1] as 'sinif' | 'uygulama' | 'karne', id: Number(eslesme[2]) }
  return { sayfa: 'siniflar' }
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => cozumle(window.location.hash))
  useEffect(() => {
    const dinle = () => {
      setRota(cozumle(window.location.hash))
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
