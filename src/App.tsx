import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { davetleGeldi, girisTuruOku, hataMetni, supabase } from './supabase'
import { useRota } from './yonlendirme'
import Giris from './sayfalar/Giris'
import SifreBelirle from './sayfalar/SifreBelirle'
import Siniflar from './sayfalar/Siniflar'
import SinifDetay from './sayfalar/SinifDetay'
import UygulamaSayfasi from './sayfalar/Uygulama'
import Karne from './sayfalar/Karne'
import Basvurular from './sayfalar/Basvurular'
import OgretmenBasvurusu from './sayfalar/OgretmenBasvurusu'
import OgrenciUygulamasi from './ogrenci/OgrenciUygulamasi'
import AdDuzenle from './bilesenler/AdDuzenle'
import type { Rol } from './ogrenci/tipler'
import { lazy, Suspense } from 'react'

// Optik okuma sayfası (kamera ve okuyucu) yalnızca açılınca yüklenir.
const OptikOku = lazy(() => import('./sayfalar/OptikOku'))

// Giriş yapan hesabın rolüne göre ekran:
//   öğretmen → öğretmen uygulaması
//   değilse, giriş ekranında seçilen sekmeye göre: öğrenci ekranı ya da öğretmen başvurusu
export default function App() {
  const [oturum, setOturum] = useState<Session | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [sifreGerekli, setSifreGerekli] = useState(davetleGeldi)
  const [rol, setRol] = useState<Rol | null>(null)
  const [rolHatasi, setRolHatasi] = useState('')

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

  async function rolYukle() {
    setRolHatasi('')
    const { data, error } = await supabase.rpc('rolum')
    if (error) return setRolHatasi(hataMetni(error))
    setRol(data as unknown as Rol)
  }

  useEffect(() => {
    setRol(null)
    if (kullaniciId) rolYukle()
  }, [kullaniciId])

  if (yukleniyor) return <div className="ortala">Yükleniyor…</div>
  if (!oturum) return <Giris />
  if (rolHatasi)
    return (
      <div className="ortala">
        <div className="kart">
          <p className="hata">{rolHatasi}</p>
          <button onClick={() => supabase.auth.signOut()}>Çıkış</button>
        </div>
      </div>
    )
  if (!rol) return <div className="ortala">Yükleniyor…</div>
  if (rol.ogretmen) return <OgretmenUygulamasi oturum={oturum} rol={rol} sifreGerekli={sifreGerekli} sifreBelirlendi={() => setSifreGerekli(false)} />
  if (girisTuruOku() === 'ogrenci') return <OgrenciUygulamasi oturum={oturum} rol={rol} yenile={rolYukle} />
  return <OgretmenBasvurusu oturum={oturum} rol={rol} yenile={rolYukle} />
}

function OgretmenUygulamasi({
  oturum,
  rol,
  sifreGerekli,
  sifreBelirlendi,
}: {
  oturum: Session
  rol: Rol
  sifreGerekli: boolean
  sifreBelirlendi: () => void
}) {
  const [ogretmenAdi, setOgretmenAdi] = useState('')
  const rota = useRota()
  const kullaniciId = oturum.user.id

  useEffect(() => {
    supabase
      .from('ogretmenler')
      .select('ad_soyad')
      .eq('id', kullaniciId)
      .maybeSingle()
      .then(({ data }) => setOgretmenAdi(data?.ad_soyad ?? ''))
  }, [kullaniciId, sifreGerekli])

  if (sifreGerekli) return <SifreBelirle mevcutAd={ogretmenAdi} bitti={sifreBelirlendi} />

  return (
    <>
      <header className="ust-cubuk">
        <a href="#/" className="logo">
          Deneme Değerlendirme
        </a>
        <div className="kullanici">
          {rol.yonetici && (
            <a href="#/basvurular" className="kucuk">
              Başvurular
            </a>
          )}
          <AdDuzenle kullaniciId={kullaniciId} ad={ogretmenAdi} yedek={oturum.user.email ?? ''} degisti={setOgretmenAdi} />
          <button className="bag" onClick={() => supabase.auth.signOut()}>
            Çıkış
          </button>
        </div>
      </header>
      <main className="icerik">
        {rota.sayfa === 'sinif' && <SinifDetay key={rota.id} id={rota.id} />}
        {rota.sayfa === 'uygulama' && <UygulamaSayfasi key={rota.id} id={rota.id} />}
        {rota.sayfa === 'karne' && <Karne key={rota.id} id={rota.id} />}
        {rota.sayfa === 'siniflar' && <Siniflar />}
        {rota.sayfa === 'basvurular' && (rol.yonetici ? <Basvurular /> : <Siniflar />)}
        {rota.sayfa === 'optik' && (
          <Suspense fallback={<p className="soluk">Yükleniyor…</p>}>
            <OptikOku />
          </Suspense>
        )}
      </main>
    </>
  )
}
