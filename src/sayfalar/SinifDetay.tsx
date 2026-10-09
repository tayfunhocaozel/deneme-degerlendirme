import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Ogrenci, Sinif } from '../veritabani'
import SinifFormu from '../bilesenler/SinifFormu'
import TopluEkle from '../bilesenler/TopluEkle'
import Onay from '../bilesenler/Onay'
import SinifDenemeleri from '../bilesenler/SinifDenemeleri'
import { git } from '../yonlendirme'

const numaraSirasi = (a: Ogrenci, b: Ogrenci) =>
  a.okul_no.localeCompare(b.okul_no, 'tr', { numeric: true })

export default function SinifDetay({ id }: { id: number }) {
  const [sinif, setSinif] = useState<Sinif | null | undefined>(undefined)
  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([])
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')
  const [mod, setMod] = useState<'liste' | 'duzenle' | 'toplu'>('liste')
  const [pasifAcik, setPasifAcik] = useState(false)

  async function yukle() {
    const [s, o] = await Promise.all([
      supabase.from('siniflar').select('*').eq('id', id).maybeSingle(),
      supabase.from('ogrenciler').select('*').eq('sinif_id', id),
    ])
    if (s.error || o.error) return setHata(hataMetni(s.error ?? o.error))
    setSinif(s.data)
    setOgrenciler(o.data.sort(numaraSirasi))
  }

  useEffect(() => {
    yukle()
  }, [id])

  const mevcutNumaralar = useMemo(() => new Set(ogrenciler.map((o) => o.okul_no)), [ogrenciler])
  const aktifler = ogrenciler.filter((o) => o.aktif)
  const pasifler = ogrenciler.filter((o) => !o.aktif)

  async function sinifiSil() {
    const { error } = await supabase.from('siniflar').delete().eq('id', id)
    if (error) return setHata(hataMetni(error))
    git('/')
  }

  async function ogrenciGuncelle(ogrenci: Ogrenci, alanlar: Partial<Pick<Ogrenci, 'okul_no' | 'ad_soyad' | 'aktif'>>) {
    setHata('')
    const { data, error } = await supabase
      .from('ogrenciler')
      .update(alanlar)
      .eq('id', ogrenci.id)
      .select()
      .single()
    if (error) {
      setHata(hataMetni(error))
      return false
    }
    setOgrenciler((eski) => eski.map((o) => (o.id === data.id ? data : o)).sort(numaraSirasi))
    return true
  }

  async function ogrenciSil(ogrenci: Ogrenci) {
    setHata('')
    const { error } = await supabase.from('ogrenciler').delete().eq('id', ogrenci.id)
    if (error) return setHata(hataMetni(error))
    setOgrenciler((eski) => eski.filter((o) => o.id !== ogrenci.id))
  }

  if (hata && sinif === undefined) return <p className="hata">{hata}</p>
  if (sinif === undefined) return <p className="soluk">Yükleniyor…</p>
  if (sinif === null)
    return (
      <div className="kart bos-durum">
        <p>Sınıf bulunamadı.</p>
        <a href="#/">Sınıflarıma dön</a>
      </div>
    )

  return (
    <>
      <a href="#/" className="geri-bag">
        ← Sınıflarım
      </a>

      {mod === 'duzenle' ? (
        <SinifFormu
          sinif={sinif}
          kaydedildi={(s) => {
            setSinif(s)
            setMod('liste')
          }}
          vazgec={() => setMod('liste')}
        />
      ) : (
        <div className="baslik-satiri">
          <div>
            <h1>{sinif.ad}</h1>
            <p className="soluk">
              {sinif.sinif_duzeyi}. sınıf · {sinif.ogretim_yili} · {aktifler.length} öğrenci
              {sinif.aciklama && ` · ${sinif.aciklama}`}
            </p>
          </div>
          <div className="dugmeler">
            <button className="ikincil" onClick={() => setMod('duzenle')}>
              Düzenle
            </button>
            <Onay
              etiket="Sınıfı sil"
              soru="Sınıf, öğrencileri ve tüm deneme sonuçları silinecek. Emin misiniz?"
              evet={sinifiSil}
            />
          </div>
        </div>
      )}

      {hata && <p className="hata">{hata}</p>}

      <SinifDenemeleri sinifId={id} sinifDuzeyi={sinif.sinif_duzeyi} ogrenciSayisi={aktifler.length} />

      <h2 className="bolum-basligi">Öğrenciler</h2>
      {bilgi && <p className="basari">{bilgi}</p>}

      {mod === 'toplu' ? (
        <TopluEkle
          sinifId={id}
          mevcutNumaralar={mevcutNumaralar}
          eklendi={(adet) => {
            setMod('liste')
            setBilgi(`${adet} öğrenci eklendi.`)
            yukle()
          }}
          kapat={() => setMod('liste')}
        />
      ) : (
        <>
          <TekOgrenciEkle
            sinifId={id}
            mevcutNumaralar={mevcutNumaralar}
            eklendi={(o) => {
              setBilgi('')
              setOgrenciler((eski) => [...eski, o].sort(numaraSirasi))
            }}
          />
          <div className="dugmeler alt-bosluk">
            <button className="ikincil" onClick={() => { setBilgi(''); setMod('toplu') }}>
              Excel'den toplu ekle
            </button>
          </div>
        </>
      )}

      <OgrenciTablosu ogrenciler={aktifler} guncelle={ogrenciGuncelle} sil={ogrenciSil} />

      {pasifler.length > 0 && (
        <div className="pasif-bolum">
          <button className="bag" onClick={() => setPasifAcik(!pasifAcik)}>
            {pasifAcik ? '▾' : '▸'} Sınıftan ayrılan öğrenciler ({pasifler.length})
          </button>
          {pasifAcik && <OgrenciTablosu ogrenciler={pasifler} guncelle={ogrenciGuncelle} sil={ogrenciSil} />}
        </div>
      )}
    </>
  )
}

function TekOgrenciEkle({
  sinifId,
  mevcutNumaralar,
  eklendi,
}: {
  sinifId: number
  mevcutNumaralar: Set<string>
  eklendi: (o: Ogrenci) => void
}) {
  const [no, setNo] = useState('')
  const [ad, setAd] = useState('')
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function ekle(e: FormEvent) {
    e.preventDefault()
    setHata('')
    if (mevcutNumaralar.has(no)) return setHata(`${no} numaralı öğrenci bu sınıfta zaten var.`)
    setBekliyor(true)
    const { data, error } = await supabase
      .from('ogrenciler')
      .insert({ sinif_id: sinifId, okul_no: no, ad_soyad: ad.replace(/\s+/g, ' ').trim() })
      .select()
      .single()
    setBekliyor(false)
    if (error) return setHata(hataMetni(error))
    eklendi(data)
    setNo('')
    setAd('')
    document.getElementById('yeni-okul-no')?.focus()
  }

  return (
    <form className="kart tek-ekle" onSubmit={ekle}>
      <input
        id="yeni-okul-no"
        className="no-girdi"
        inputMode="numeric"
        placeholder="Okul no"
        value={no}
        onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))}
        required
      />
      <input placeholder="Ad soyad" value={ad} onChange={(e) => setAd(e.target.value)} required />
      <button type="submit" disabled={bekliyor}>
        Ekle
      </button>
      {hata && <p className="hata tam-satir">{hata}</p>}
    </form>
  )
}

function OgrenciTablosu({
  ogrenciler,
  guncelle,
  sil,
}: {
  ogrenciler: Ogrenci[]
  guncelle: (o: Ogrenci, alanlar: Partial<Pick<Ogrenci, 'okul_no' | 'ad_soyad' | 'aktif'>>) => Promise<boolean>
  sil: (o: Ogrenci) => void
}) {
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null)
  const [no, setNo] = useState('')
  const [ad, setAd] = useState('')

  if (ogrenciler.length === 0) return <p className="soluk">Bu sınıfta henüz öğrenci yok.</p>

  return (
    <div className="tablo-kap">
      <table className="tablo kartlasan">
        <thead>
          <tr>
            <th>Okul no</th>
            <th>Ad soyad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ogrenciler.map((o) =>
            duzenlenen === o.id ? (
              <tr key={o.id}>
                <td className="hucre-no">
                  <input
                    className="no-girdi"
                    inputMode="numeric"
                    value={no}
                    onChange={(e) => setNo(e.target.value.replace(/\D/g, ''))}
                  />
                </td>
                <td className="hucre-ad">
                  <input value={ad} onChange={(e) => setAd(e.target.value)} />
                </td>
                <td className="islemler">
                  <button
                    className="kucuk-dugme"
                    disabled={!no || !ad.trim()}
                    onClick={async () => {
                      if (await guncelle(o, { okul_no: no, ad_soyad: ad.replace(/\s+/g, ' ').trim() }))
                        setDuzenlenen(null)
                    }}
                  >
                    Kaydet
                  </button>
                  <button className="kucuk-dugme ikincil" onClick={() => setDuzenlenen(null)}>
                    Vazgeç
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={o.id} className={o.aktif ? '' : 'pasif-satir'}>
                <td className="hucre-no">{o.okul_no}</td>
                <td className="hucre-ad">
                  <a href={`#/karne/${o.id}`}>{o.ad_soyad}</a>
                </td>
                <td className="islemler">
                  <button
                    className="bag"
                    onClick={() => {
                      setDuzenlenen(o.id)
                      setNo(o.okul_no)
                      setAd(o.ad_soyad)
                    }}
                  >
                    Düzenle
                  </button>
                  {o.aktif ? (
                    <Onay
                      etiket="Ayrıldı"
                      soru="Öğrenci listeden çıkar, sonuçları saklanır."
                      evet={() => guncelle(o, { aktif: false })}
                      tehlikeli={false}
                    />
                  ) : (
                    <button className="bag" onClick={() => guncelle(o, { aktif: true })}>
                      Geri al
                    </button>
                  )}
                  <Onay
                    etiket="Sil"
                    soru="Öğrencinin tüm deneme sonuçları da silinir."
                    evet={() => sil(o)}
                  />
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}
