import { useState, type FormEvent } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Sinif } from '../veritabani'

// Ağustostan itibaren yeni öğretim yılı sayılır: Ekim 2026 → "2026-2027".
export function buOgretimYili(): string {
  const bugun = new Date()
  const yil = bugun.getMonth() >= 7 ? bugun.getFullYear() : bugun.getFullYear() - 1
  return `${yil}-${yil + 1}`
}

// Yeni sınıf ekler ya da var olan sınıfı düzenler.
export default function SinifFormu({
  sinif,
  kaydedildi,
  vazgec,
}: {
  sinif?: Sinif
  kaydedildi: (s: Sinif) => void
  vazgec: () => void
}) {
  const [ad, setAd] = useState(sinif?.ad ?? '')
  const [duzey, setDuzey] = useState(sinif?.sinif_duzeyi ?? 8)
  const [yil, setYil] = useState(sinif?.ogretim_yili ?? buOgretimYili())
  const [aciklama, setAciklama] = useState(sinif?.aciklama ?? '')
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function kaydet(e: FormEvent) {
    e.preventDefault()
    setHata('')
    if (!/^\d{4}-\d{4}$/.test(yil.trim())) return setHata('Öğretim yılı 2026-2027 biçiminde olmalı.')
    const alanlar = {
      ad: ad.trim(),
      sinif_duzeyi: duzey,
      ogretim_yili: yil.trim(),
      aciklama: aciklama.trim() || null,
    }
    setBekliyor(true)
    const sorgu = sinif
      ? supabase.from('siniflar').update(alanlar).eq('id', sinif.id).select().single()
      : supabase.from('siniflar').insert(alanlar).select().single()
    const { data, error } = await sorgu
    setBekliyor(false)
    if (error) return setHata(hataMetni(error))
    kaydedildi(data)
  }

  return (
    <form className="kart form" onSubmit={kaydet}>
      <h2>{sinif ? 'Sınıfı düzenle' : 'Yeni sınıf'}</h2>
      <div className="satir">
        <label className="genis">
          Sınıf adı
          <input
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            placeholder="8/A"
            required
            autoFocus
          />
        </label>
        <label>
          Sınıf düzeyi
          <select value={duzey} onChange={(e) => setDuzey(Number(e.target.value))}>
            {[5, 6, 7, 8].map((d) => (
              <option key={d} value={d}>
                {d}. sınıf
              </option>
            ))}
          </select>
        </label>
        <label>
          Öğretim yılı
          <input value={yil} onChange={(e) => setYil(e.target.value)} required />
        </label>
      </div>
      <label>
        Açıklama (isteğe bağlı)
        <input
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Örn. LGS hazırlık grubu"
        />
      </label>
      {hata && <p className="hata">{hata}</p>}
      <div className="dugmeler">
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" className="ikincil" onClick={vazgec}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}
