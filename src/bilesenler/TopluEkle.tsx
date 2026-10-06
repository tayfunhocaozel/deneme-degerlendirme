import { useMemo, useState, type ChangeEvent } from 'react'
import { hataMetni, supabase } from '../supabase'
import { metniAyristir, tabloyuAyristir, type ListeSatiri } from '../listeAyristir'

type Satir = ListeSatiri & { secili: boolean }
type Durum = 'yeni' | 'var' | 'tekrar' | 'eksik'

const DURUM_METNI: Record<Durum, string> = {
  yeni: 'Eklenecek',
  var: 'Sınıfta zaten var',
  tekrar: 'Listede iki kez',
  eksik: 'Numara ya da ad eksik',
}

// Excel dosyası ya da yapıştırılan liste → önizleme (düzeltilebilir) → onaylanınca kayıt.
export default function TopluEkle({
  sinifId,
  mevcutNumaralar,
  eklendi,
  kapat,
}: {
  sinifId: number
  mevcutNumaralar: Set<string>
  eklendi: (adet: number) => void
  kapat: () => void
}) {
  const [metin, setMetin] = useState('')
  const [satirlar, setSatirlar] = useState<Satir[] | null>(null)
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  function onizle(liste: ListeSatiri[]) {
    setHata('')
    if (liste.length === 0) {
      setHata('Listede okul numarası olan satır bulunamadı. Her satırda numara ve ad soyad olmalı.')
      return
    }
    setSatirlar(liste.map((s) => ({ ...s, secili: true })))
  }

  async function dosyaSecildi(e: ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya) return
    try {
      // Excel kütüphanesi büyük; yalnızca dosya seçilince indirilir.
      const { read, utils } = await import('xlsx')
      const kitap = read(await dosya.arrayBuffer())
      const sayfa = kitap.Sheets[kitap.SheetNames[0]]
      onizle(tabloyuAyristir(utils.sheet_to_json<unknown[]>(sayfa, { header: 1, raw: false, defval: '' })))
    } catch {
      setHata('Dosya okunamadı. Excel (.xlsx, .xls) ya da CSV dosyası seçin.')
    }
  }

  const durumlar = useMemo<Durum[]>(() => {
    if (!satirlar) return []
    const gorulen = new Map<string, number>()
    satirlar.forEach((s) => s.secili && gorulen.set(s.okul_no, (gorulen.get(s.okul_no) ?? 0) + 1))
    return satirlar.map((s) => {
      if (!s.okul_no || !s.ad_soyad) return 'eksik'
      if (mevcutNumaralar.has(s.okul_no)) return 'var'
      if (s.secili && (gorulen.get(s.okul_no) ?? 0) > 1) return 'tekrar'
      return 'yeni'
    })
  }, [satirlar, mevcutNumaralar])

  const eklenecekler = satirlar?.filter((s, i) => s.secili && durumlar[i] === 'yeni') ?? []
  const engel = satirlar?.some((s, i) => s.secili && durumlar[i] === 'tekrar')

  function degistir(i: number, alan: Partial<Satir>) {
    setSatirlar((eski) => eski!.map((s, j) => (j === i ? { ...s, ...alan } : s)))
  }

  async function kaydet() {
    setBekliyor(true)
    const { error } = await supabase.from('ogrenciler').insert(
      eklenecekler.map((s) => ({ sinif_id: sinifId, okul_no: s.okul_no, ad_soyad: s.ad_soyad })),
    )
    setBekliyor(false)
    if (error) return setHata(hataMetni(error))
    eklendi(eklenecekler.length)
  }

  if (!satirlar)
    return (
      <div className="kart form">
        <h2>Toplu öğrenci ekle</h2>
        <label className="dosya-sec">
          <span className="dugme-gibi">Excel dosyası seç</span>
          <input type="file" accept=".xlsx,.xls,.csv,.ods" onChange={dosyaSecildi} hidden />
          <span className="soluk kucuk">İlk sayfadaki okul numarası ve ad soyad sütunları okunur.</span>
        </label>
        <p className="soluk ayrac">ya da</p>
        <label>
          Excel'den kopyalayıp buraya yapıştırın (her satırda numara ve ad soyad)
          <textarea
            rows={8}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            placeholder={'245\tAli Yılmaz\n312\tAyşe Demir'}
          />
        </label>
        {hata && <p className="hata">{hata}</p>}
        <div className="dugmeler">
          <button onClick={() => onizle(metniAyristir(metin))} disabled={!metin.trim()}>
            Önizle
          </button>
          <button className="ikincil" onClick={kapat}>
            Vazgeç
          </button>
        </div>
      </div>
    )

  return (
    <div className="kart form">
      <h2>Listeyi kontrol edin</h2>
      <p className="soluk">
        Yanlış okunan numara ya da adı burada düzeltebilir, eklemek istemediğiniz satırın işaretini kaldırabilirsiniz.
      </p>
      <div className="tablo-kap">
        <table className="tablo">
          <thead>
            <tr>
              <th></th>
              <th>Okul no</th>
              <th>Ad soyad</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, i) => (
              <tr key={i} className={s.secili ? '' : 'pasif-satir'}>
                <td>
                  <input
                    type="checkbox"
                    checked={s.secili}
                    onChange={(e) => degistir(i, { secili: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    className="no-girdi"
                    inputMode="numeric"
                    value={s.okul_no}
                    onChange={(e) => degistir(i, { okul_no: e.target.value.replace(/\D/g, '') })}
                  />
                </td>
                <td>
                  <input value={s.ad_soyad} onChange={(e) => degistir(i, { ad_soyad: e.target.value })} />
                </td>
                <td>
                  <span className={`etiket etiket-${durumlar[i]}`}>{DURUM_METNI[durumlar[i]]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {engel && <p className="hata">Aynı okul numarası listede iki kez var. Birini düzeltin ya da işaretini kaldırın.</p>}
      {hata && <p className="hata">{hata}</p>}
      <div className="dugmeler">
        <button onClick={kaydet} disabled={bekliyor || engel || eklenecekler.length === 0}>
          {bekliyor ? 'Kaydediliyor…' : `${eklenecekler.length} öğrenciyi ekle`}
        </button>
        <button className="ikincil" onClick={() => setSatirlar(null)}>
          Geri
        </button>
        <button className="ikincil" onClick={kapat}>
          Vazgeç
        </button>
      </div>
    </div>
  )
}
