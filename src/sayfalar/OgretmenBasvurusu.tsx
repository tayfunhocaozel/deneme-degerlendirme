import { useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { girisTuruYaz, hataMetni, supabase } from '../supabase'
import type { Rol } from '../ogrenci/tipler'
import SadeUstCubuk from '../bilesenler/SadeUstCubuk'

// Öğretmen sekmesinden giren ama öğretmen olarak kayıtlı olmayan hesap: başvuru formu ya da başvuru durumu.
export default function OgretmenBasvurusu({ oturum, rol, yenile }: { oturum: Session; rol: Rol; yenile: () => void }) {
  const meta = oturum.user.user_metadata ?? {}
  const [ad, setAd] = useState<string>(meta.ad_soyad || meta.full_name || meta.name || '')
  const [okul, setOkul] = useState<string>(meta.okul || '')
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)
  const [yenidenBasvur, setYenidenBasvur] = useState(false)

  async function gonder(e: FormEvent) {
    e.preventDefault()
    setHata('')
    setBekliyor(true)
    const { error } = await supabase.rpc('ogretmen_basvur', {
      p_ad_soyad: ad.replace(/\s+/g, ' ').trim(),
      p_okul: okul.replace(/\s+/g, ' ').trim(),
    })
    setBekliyor(false)
    if (error) return setHata(hataMetni(error))
    setYenidenBasvur(false)
    yenile()
  }

  function ogrenciyeGec() {
    girisTuruYaz('ogrenci')
    yenile()
  }

  const formGoster = !rol.basvuru || yenidenBasvur

  return (
    <>
      <SadeUstCubuk oturum={oturum} />
      <main className="icerik dar-icerik">
        {rol.basvuru === 'bekliyor' && !yenidenBasvur && (
          <div className="kart">
            <h1>Başvurunuz alındı</h1>
            <p>
              <strong>{oturum.user.email}</strong> hesabı öğretmen olarak kayıtlı değil. Başvurunuz onaylanınca bu
              hesapla giriş yapıp sınıflarınızı açabileceksiniz.
            </p>
            <div className="dugmeler">
              <button className="ikincil" onClick={yenile}>
                Durumu yenile
              </button>
              <button className="bag" onClick={() => setYenidenBasvur(true)}>
                Bilgilerimi düzelt
              </button>
            </div>
          </div>
        )}
        {rol.basvuru === 'reddedildi' && !yenidenBasvur && (
          <div className="kart">
            <h1>Başvurunuz onaylanmadı</h1>
            <p>Bir yanlışlık olduğunu düşünüyorsanız bilgilerinizi düzeltip yeniden başvurabilirsiniz.</p>
            <button onClick={() => setYenidenBasvur(true)}>Yeniden başvur</button>
          </div>
        )}
        {formGoster && (
          <form className="kart form" onSubmit={gonder}>
            <h1>Öğretmen başvurusu</h1>
            <p className="soluk">
              <strong>{oturum.user.email}</strong> hesabı öğretmen olarak kayıtlı değil. Öğretmenseniz başvurun;
              onaylanınca giriş yapabilirsiniz.
            </p>
            <label>
              Ad soyad
              <input value={ad} onChange={(e) => setAd(e.target.value)} required />
            </label>
            <label>
              Okul
              <input value={okul} onChange={(e) => setOkul(e.target.value)} required />
            </label>
            {hata && <p className="hata">{hata}</p>}
            <div className="dugmeler">
              <button type="submit" disabled={bekliyor}>
                {bekliyor ? 'Gönderiliyor…' : 'Başvuruyu gönder'}
              </button>
              {yenidenBasvur && (
                <button type="button" className="ikincil" onClick={() => setYenidenBasvur(false)}>
                  Vazgeç
                </button>
              )}
            </div>
          </form>
        )}
        <p className="soluk kucuk">
          Öğrenci misin?{' '}
          <button className="bag" onClick={ogrenciyeGec}>
            Öğrenci ekranına geç
          </button>
        </p>
      </main>
    </>
  )
}
