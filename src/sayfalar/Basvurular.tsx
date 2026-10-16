import { useEffect, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { OgretmenBasvurusu } from '../veritabani'

const DURUM_ADI: Record<OgretmenBasvurusu['durum'], string> = {
  bekliyor: 'Bekliyor',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi',
}

function zamanYaz(t: string) {
  return new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

// Yönetici: öğretmen başvurularını onaylar ya da reddeder.
export default function Basvurular() {
  const [liste, setListe] = useState<OgretmenBasvurusu[] | null>(null)
  const [hata, setHata] = useState('')
  const [bekleyen, setBekleyen] = useState<string | null>(null)

  async function yukle() {
    const { data, error } = await supabase
      .from('ogretmen_basvurulari')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return setHata(hataMetni(error))
    setListe(data)
  }

  useEffect(() => {
    yukle()
  }, [])

  async function karar(b: OgretmenBasvurusu, onay: boolean) {
    setHata('')
    setBekleyen(b.kullanici_id)
    const { error } = await supabase.rpc('basvuru_karar', { p_kullanici_id: b.kullanici_id, p_onay: onay })
    setBekleyen(null)
    if (error) return setHata(hataMetni(error))
    yukle()
  }

  if (!liste) return hata ? <p className="hata">{hata}</p> : <p className="soluk">Yükleniyor…</p>
  const bekleyenler = liste.filter((b) => b.durum === 'bekliyor')
  const digerleri = liste.filter((b) => b.durum !== 'bekliyor')

  return (
    <>
      <a href="#/" className="geri-bag">
        ← Sınıflarım
      </a>
      <h1>Öğretmen başvuruları</h1>
      {hata && <p className="hata">{hata}</p>}
      {bekleyenler.length === 0 ? (
        <p className="soluk">Bekleyen başvuru yok.</p>
      ) : (
        <div className="liste">
          {bekleyenler.map((b) => (
            <div key={b.kullanici_id} className="kart basvuru-satiri">
              <div>
                <strong>{b.ad_soyad}</strong>
                <p className="soluk kucuk">
                  {b.okul} · {b.eposta} · {zamanYaz(b.created_at)}
                </p>
              </div>
              <div className="dugmeler">
                <button disabled={bekleyen === b.kullanici_id} onClick={() => karar(b, true)}>
                  Onayla
                </button>
                <button className="ikincil" disabled={bekleyen === b.kullanici_id} onClick={() => karar(b, false)}>
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {digerleri.length > 0 && (
        <section className="bolum">
          <h2 className="bolum-basligi">Karar verilenler</h2>
          <div className="tablo-kap">
            <table className="tablo kartlasan">
              <thead>
                <tr>
                  <th>Ad soyad</th>
                  <th>Okul</th>
                  <th>E-posta</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {digerleri.map((b) => (
                  <tr key={b.kullanici_id}>
                    <td className="hucre-tam">{b.ad_soyad}</td>
                    <td data-etiket="Okul">{b.okul}</td>
                    <td data-etiket="E-posta">{b.eposta}</td>
                    <td data-etiket="Durum">
                      {DURUM_ADI[b.durum]}
                      {b.durum === 'reddedildi' && (
                        <>
                          {' '}
                          <button className="bag" onClick={() => karar(b, true)}>
                            Onayla
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
