import { useState, type FormEvent } from 'react'
import { hataMetni, supabase } from '../supabase'

// Üst çubuktaki öğretmen adı: tıklanınca düzenlenir.
export default function AdDuzenle({
  kullaniciId,
  ad,
  yedek,
  degisti,
}: {
  kullaniciId: string
  ad: string
  yedek: string
  degisti: (ad: string) => void
}) {
  const [acik, setAcik] = useState(false)
  const [deger, setDeger] = useState(ad)
  const [hata, setHata] = useState('')

  async function kaydet(e: FormEvent) {
    e.preventDefault()
    const yeni = deger.replace(/\s+/g, ' ').trim()
    const { error } = await supabase.from('ogretmenler').update({ ad_soyad: yeni }).eq('id', kullaniciId)
    if (error) return setHata(hataMetni(error))
    degisti(yeni)
    setAcik(false)
  }

  if (!acik)
    return (
      <button
        className="bag ad-dugmesi"
        title="Adınızı düzenleyin"
        onClick={() => {
          setDeger(ad)
          setHata('')
          setAcik(true)
        }}
      >
        {ad || `${yedek} · adınızı ekleyin`}
      </button>
    )

  return (
    <form className="ad-formu" onSubmit={kaydet}>
      <input
        value={deger}
        onChange={(e) => setDeger(e.target.value)}
        placeholder="Ad soyad"
        autoFocus
        title={hata || undefined}
      />
      <button type="submit" className="kucuk-dugme">
        Kaydet
      </button>
      <button type="button" className="kucuk-dugme ikincil" onClick={() => setAcik(false)}>
        Vazgeç
      </button>
    </form>
  )
}
