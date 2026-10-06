import { useEffect, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Ogrenci, Sinif } from '../veritabani'
import KameraEkrani from '../optik/KameraEkrani'
import OptikOnay, { type KayitBilgisi } from '../optik/OptikOnay'
import OptikSonuc from '../optik/OptikSonuc'
import type { OkumaSonucu } from '../optik/okuyucu.ts'

type Asama = { ad: 'kamera' } | { ad: 'onay'; okuma: OkumaSonucu } | { ad: 'sonuc'; kayit: KayitBilgisi }

// Telefon kamerasıyla optik form okuma: kamera → onay → kaydedildi → (sonraki form) kamera.
export default function OptikOku() {
  const [asama, setAsama] = useState<Asama>({ ad: 'kamera' })
  const [veri, setVeri] = useState<{ siniflar: Sinif[]; ogrenciler: Ogrenci[] } | null>(null)
  const [hata, setHata] = useState('')

  useEffect(() => {
    ;(async () => {
      const [s, o] = await Promise.all([
        supabase.from('siniflar').select('*'),
        supabase.from('ogrenciler').select('*').eq('aktif', true),
      ])
      if (s.error || o.error) return setHata(hataMetni(s.error ?? o.error))
      setVeri({ siniflar: s.data, ogrenciler: o.data })
    })()
  }, [])

  useEffect(() => window.scrollTo(0, 0), [asama.ad])

  return (
    <>
      <div className="baslik-satiri">
        <h1>Optik oku</h1>
        <a href="#/" className="geri-bag">
          Sınıflarım
        </a>
      </div>
      {hata && <p className="hata">{hata}</p>}
      {asama.ad === 'kamera' && <KameraEkrani okundu={(okuma) => setAsama({ ad: 'onay', okuma })} />}
      {asama.ad === 'onay' &&
        (veri ? (
          <OptikOnay
            okuma={asama.okuma}
            siniflar={veri.siniflar}
            ogrenciler={veri.ogrenciler}
            kaydedildi={(kayit) => setAsama({ ad: 'sonuc', kayit })}
            yenidenCek={() => setAsama({ ad: 'kamera' })}
          />
        ) : (
          <p className="soluk">Sınıf listeleri yükleniyor…</p>
        ))}
      {asama.ad === 'sonuc' && <OptikSonuc kayit={asama.kayit} sonraki={() => setAsama({ ad: 'kamera' })} />}
    </>
  )
}
