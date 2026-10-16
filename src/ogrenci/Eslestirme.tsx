import { useState, type FormEvent } from 'react'
import { girisTuruYaz, hataMetni, supabase } from '../supabase'
import { git } from '../yonlendirme'

const SONUC_METNI: Record<string, string> = {
  kod_yok: 'Bu sınıf kodu bulunamadı. Öğretmeninin verdiği kodu kontrol et.',
  numara_yok: 'Bu numara sınıf listesinde yok. Numaranı kontrol et ya da öğretmenine sor.',
  zaten_eslesti: 'Bu sınıfla zaten eşleştin.',
}

// İlk girişte (ya da yeni sınıfta) öğrenci hesabını sınıf listesindeki kaydına bağlar.
export default function Eslestirme({ ilk, yenile }: { ilk: boolean; yenile: () => void }) {
  const [kod, setKod] = useState('')
  const [no, setNo] = useState('')
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function gonder(e: FormEvent) {
    e.preventDefault()
    setHata('')
    setBekliyor(true)
    const { data, error } = await supabase.rpc('ogrenci_eslestir', { p_sinif_kodu: kod, p_okul_no: no })
    setBekliyor(false)
    if (error) return setHata(hataMetni(error))
    if (data === 'onayli' || data === 'bekliyor' || data === 'zaten_eslesti') {
      git('/')
      return yenile()
    }
    setHata(SONUC_METNI[data] ?? data)
  }

  return (
    <form className="kart form" onSubmit={gonder}>
      <h1>{ilk ? 'Hoş geldin' : 'Sınıf ekle'}</h1>
      <p>
        Öğretmeninin verdiği <strong>sınıf kodunu</strong> ve <strong>okul numaranı</strong> yaz. Bu bir kez yapılır;
        numaranı sonradan yalnızca öğretmenin değiştirebilir.
      </p>
      <label>
        Sınıf kodu
        <input
          className="kod-girdi"
          value={kod}
          onChange={(e) => setKod(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6))}
          placeholder="örn. 3FA9C2"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          minLength={6}
        />
      </label>
      <label>
        Okul numarası
        <input
          inputMode="numeric"
          value={no}
          onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))}
          required
        />
      </label>
      {hata && <p className="hata">{hata}</p>}
      <div className="dugmeler">
        <button type="submit" disabled={bekliyor || kod.length !== 6 || !no}>
          {bekliyor ? 'Kontrol ediliyor…' : 'Eşleştir'}
        </button>
        {!ilk && (
          <a href="#/" className="bag">
            Vazgeç
          </a>
        )}
      </div>
      {ilk && (
        <p className="soluk kucuk">
          Öğretmen misiniz?{' '}
          <button
            type="button"
            className="bag"
            onClick={() => {
              girisTuruYaz('ogretmen')
              yenile()
            }}
          >
            Öğretmen ekranına geçin
          </button>
        </p>
      )}
    </form>
  )
}
