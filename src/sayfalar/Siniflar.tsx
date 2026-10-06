import { useEffect, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Sinif } from '../veritabani'
import SinifFormu from '../bilesenler/SinifFormu'
import { git } from '../yonlendirme'

export default function Siniflar() {
  const [siniflar, setSiniflar] = useState<Sinif[] | null>(null)
  const [mevcut, setMevcut] = useState<Record<number, number>>({})
  const [hata, setHata] = useState('')
  const [formAcik, setFormAcik] = useState(false)

  async function yukle() {
    const [s, o] = await Promise.all([
      supabase.from('siniflar').select('*').order('ogretim_yili', { ascending: false }).order('ad'),
      supabase.from('ogrenciler').select('sinif_id').eq('aktif', true),
    ])
    if (s.error || o.error) return setHata(hataMetni(s.error ?? o.error))
    const sayac: Record<number, number> = {}
    for (const { sinif_id } of o.data) sayac[sinif_id] = (sayac[sinif_id] ?? 0) + 1
    setMevcut(sayac)
    setSiniflar(s.data)
  }

  useEffect(() => {
    yukle()
  }, [])

  if (hata) return <p className="hata">{hata}</p>
  if (!siniflar) return <p className="soluk">Yükleniyor…</p>

  return (
    <>
      <div className="baslik-satiri">
        <h1>Sınıflarım</h1>
        <div className="dugmeler">
          <a className="dugme-gibi" href="#/optik">
            Optik oku
          </a>
          {!formAcik && (
            <button className="ikincil" onClick={() => setFormAcik(true)}>
              + Sınıf ekle
            </button>
          )}
        </div>
      </div>

      {formAcik && (
        <SinifFormu
          kaydedildi={(s) => git(`/sinif/${s.id}`)}
          vazgec={() => setFormAcik(false)}
        />
      )}

      {siniflar.length === 0 && !formAcik && (
        <div className="kart bos-durum">
          <p>Henüz sınıf eklemediniz.</p>
          <p className="soluk">“Sınıf ekle” ile başlayın; ardından öğrencileri tek tek ya da Excel listesinden ekleyebilirsiniz.</p>
        </div>
      )}

      <div className="kart-izgara">
        {siniflar.map((s) => (
          <a key={s.id} className="kart sinif-karti" href={`#/sinif/${s.id}`}>
            <span className="sinif-adi">{s.ad}</span>
            <span className="soluk">
              {s.sinif_duzeyi}. sınıf · {s.ogretim_yili}
            </span>
            <span>{mevcut[s.id] ?? 0} öğrenci</span>
            {s.aciklama && <span className="soluk kucuk">{s.aciklama}</span>}
          </a>
        ))}
      </div>
    </>
  )
}
