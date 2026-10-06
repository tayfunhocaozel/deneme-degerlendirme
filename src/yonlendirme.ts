import { useEffect, useState } from 'react'

// GitHub Pages yalnızca statik dosya sunduğu için sayfalar adresin # kısmında tutulur:
//   #/            sınıflar
//   #/sinif/12    12 numaralı sınıfın öğrencileri
export type Rota = { sayfa: 'siniflar' } | { sayfa: 'sinif'; id: number }

function cozumle(hash: string): Rota {
  const sinif = hash.match(/^#\/sinif\/(\d+)/)
  if (sinif) return { sayfa: 'sinif', id: Number(sinif[1]) }
  return { sayfa: 'siniflar' }
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => cozumle(window.location.hash))
  useEffect(() => {
    const dinle = () => setRota(cozumle(window.location.hash))
    window.addEventListener('hashchange', dinle)
    return () => window.removeEventListener('hashchange', dinle)
  }, [])
  return rota
}

export function git(adres: string) {
  window.location.hash = adres
}
