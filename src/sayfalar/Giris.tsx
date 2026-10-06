import { useState, type FormEvent } from 'react'
import { hataMetni, supabase, UYGULAMA_ADRESI } from '../supabase'

export default function Giris() {
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function girisYap(e: FormEvent) {
    e.preventDefault()
    setHata('')
    setBilgi('')
    setBekliyor(true)
    const { error } = await supabase.auth.signInWithPassword({ email: eposta.trim(), password: sifre })
    setBekliyor(false)
    if (error) setHata(hataMetni(error))
  }

  async function sifremiUnuttum() {
    setHata('')
    setBilgi('')
    if (!eposta.trim()) {
      setHata('Önce e-posta adresinizi yazın.')
      return
    }
    setBekliyor(true)
    const { error } = await supabase.auth.resetPasswordForEmail(eposta.trim(), {
      redirectTo: UYGULAMA_ADRESI,
    })
    setBekliyor(false)
    if (error) setHata(hataMetni(error))
    else setBilgi('Şifre yenileme bağlantısı e-posta adresinize gönderildi.')
  }

  return (
    <div className="ortala">
      <form className="kart giris-karti" onSubmit={girisYap}>
        <h1>Deneme Değerlendirme</h1>
        <p className="soluk">Öğretmen girişi</p>
        <label>
          E-posta
          <input
            type="email"
            autoComplete="email"
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
            required
          />
        </label>
        <label>
          Şifre
          <input
            type="password"
            autoComplete="current-password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            required
          />
        </label>
        {hata && <p className="hata">{hata}</p>}
        {bilgi && <p className="basari">{bilgi}</p>}
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? 'Bekleyin…' : 'Giriş yap'}
        </button>
        <button type="button" className="bag" onClick={sifremiUnuttum} disabled={bekliyor}>
          Şifremi unuttum
        </button>
        <p className="soluk kucuk">Hesaplar yalnızca davetle açılır.</p>
      </form>
    </div>
  )
}
