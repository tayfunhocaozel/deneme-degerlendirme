import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { davetleGeldi, supabase } from './supabase'
import { useRota } from './yonlendirme'
import Giris from './sayfalar/Giris'
import SifreBelirle from './sayfalar/SifreBelirle'
import Siniflar from './sayfalar/Siniflar'
import SinifDetay from './sayfalar/SinifDetay'

export default function App() {
  const [oturum, setOturum] = useState<Session | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [sifreGerekli, setSifreGerekli] = useState(davetleGeldi)
  const [ogretmenAdi, setOgretmenAdi] = useState('')
  const rota = useRota()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setOturum(data.session)
      setYukleniyor(false)
    })
    const { data } = supabase.auth.onAuthStateChange((olay, yeniOturum) => {
      setOturum(yeniOturum)
      if (olay === 'PASSWORD_RECOVERY') setSifreGerekli(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const kullaniciId = oturum?.user.id
  useEffect(() => {
    if (!kullaniciId) return
    supabase
      .from('ogretmenler')
      .select('ad_soyad')
      .eq('id', kullaniciId)
      .maybeSingle()
      .then(({ data }) => setOgretmenAdi(data?.ad_soyad ?? ''))
  }, [kullaniciId, sifreGerekli])

  if (yukleniyor) return <div className="ortala">Yükleniyor…</div>
  if (!oturum) return <Giris />
  if (sifreGerekli)
    return <SifreBelirle mevcutAd={ogretmenAdi} bitti={() => setSifreGerekli(false)} />

  return (
    <>
      <header className="ust-cubuk">
        <a href="#/" className="logo">
          Deneme Değerlendirme
        </a>
        <div className="kullanici">
          <span>{ogretmenAdi || oturum.user.email}</span>
          <button className="bag" onClick={() => supabase.auth.signOut()}>
            Çıkış
          </button>
        </div>
      </header>
      <main className="icerik">
        {rota.sayfa === 'sinif' ? <SinifDetay id={rota.id} /> : <Siniflar />}
      </main>
    </>
  )
}
