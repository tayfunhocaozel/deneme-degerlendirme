import { useState, type FormEvent } from 'react'
import { hataMetni, supabase } from '../supabase'

// Davet ya da şifre sıfırlama bağlantısıyla gelen öğretmen burada şifresini belirler.
export default function SifreBelirle({ mevcutAd, bitti }: { mevcutAd: string; bitti: () => void }) {
  const [ad, setAd] = useState(mevcutAd)
  const [sifre, setSifre] = useState('')
  const [tekrar, setTekrar] = useState('')
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function kaydet(e: FormEvent) {
    e.preventDefault()
    setHata('')
    if (sifre.length < 8) return setHata('Şifre en az 8 karakter olmalı.')
    if (sifre !== tekrar) return setHata('Şifreler aynı değil.')
    setBekliyor(true)
    const { data, error } = await supabase.auth.updateUser({ password: sifre })
    if (error) {
      setBekliyor(false)
      return setHata(hataMetni(error))
    }
    if (ad.trim()) {
      await supabase.from('ogretmenler').update({ ad_soyad: ad.trim() }).eq('id', data.user.id)
    }
    setBekliyor(false)
    bitti()
  }

  return (
    <div className="ortala">
      <form className="kart giris-karti" onSubmit={kaydet}>
        <h1>Şifrenizi belirleyin</h1>
        <label>
          Ad soyad
          <input value={ad} onChange={(e) => setAd(e.target.value)} autoComplete="name" />
        </label>
        <label>
          Yeni şifre
          <input
            type="password"
            autoComplete="new-password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            required
          />
        </label>
        <label>
          Yeni şifre (tekrar)
          <input
            type="password"
            autoComplete="new-password"
            value={tekrar}
            onChange={(e) => setTekrar(e.target.value)}
            required
          />
        </label>
        {hata && <p className="hata">{hata}</p>}
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet ve devam et'}
        </button>
      </form>
    </div>
  )
}
