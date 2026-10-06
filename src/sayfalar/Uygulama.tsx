import { useEffect, useMemo, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Deneme, DenemeSorusu, Isaret, Ogrenci, Sinif, Sonuc, Uygulama } from '../veritabani'
import { netYaz, ozetle } from '../puan'
import CevapGirisi from '../bilesenler/CevapGirisi'
import Onay from '../bilesenler/Onay'
import { tarihYaz } from '../bilesenler/SinifDenemeleri'
import { git } from '../yonlendirme'

type Veri = {
  uygulama: Uygulama
  deneme: Deneme
  sorular: DenemeSorusu[]
  sinif: Sinif
  ogrenciler: Ogrenci[]
}

// Bir denemenin bir sınıftaki uygulanışı: öğrenci listesi ve elle cevap girişi.
export default function UygulamaSayfasi({ id }: { id: number }) {
  const [veri, setVeri] = useState<Veri | null | undefined>(undefined)
  const [sonuclar, setSonuclar] = useState<Map<number, Sonuc>>(new Map())
  const [isaretler, setIsaretler] = useState<Map<number, Isaret[]>>(new Map()) // sonuc_id → işaretler
  const [secili, setSecili] = useState<number | null>(null) // ogrenci_id
  const [hata, setHata] = useState('')

  useEffect(() => {
    ;(async () => {
      const u = await supabase.from('uygulamalar').select('*').eq('id', id).maybeSingle()
      if (u.error) return setHata(hataMetni(u.error))
      if (!u.data) return setVeri(null)
      const [d, ds, s, o, so] = await Promise.all([
        supabase.from('denemeler').select('*').eq('id', u.data.deneme_id).single(),
        supabase.from('deneme_sorulari').select('*').eq('deneme_id', u.data.deneme_id).order('sira'),
        supabase.from('siniflar').select('*').eq('id', u.data.sinif_id).single(),
        supabase.from('ogrenciler').select('*').eq('sinif_id', u.data.sinif_id),
        supabase.from('sonuclar').select('*').eq('uygulama_id', id),
      ])
      if (d.error || ds.error || s.error || o.error || so.error)
        return setHata(hataMetni(d.error ?? ds.error ?? s.error ?? o.error ?? so.error))
      const c = so.data.length
        ? await supabase.from('cevaplar').select('*').in('sonuc_id', so.data.map((x) => x.id))
        : { data: [], error: null }
      if (c.error) return setHata(hataMetni(c.error))

      const harita = new Map<number, Isaret[]>()
      for (const cevap of c.data) {
        const dizi = harita.get(cevap.sonuc_id) ?? []
        dizi[cevap.sira - 1] = cevap.isaretlenen
        harita.set(cevap.sonuc_id, dizi)
      }
      const sonucIdleri = new Set(so.data.map((x) => x.ogrenci_id))
      setIsaretler(harita)
      setSonuclar(new Map(so.data.map((x) => [x.ogrenci_id, x])))
      setVeri({
        uygulama: u.data,
        deneme: d.data,
        sorular: ds.data,
        sinif: s.data,
        // Sınıftan ayrılan öğrenci yalnızca sonucu girilmişse listede kalır.
        ogrenciler: o.data
          .filter((x) => x.aktif || sonucIdleri.has(x.id))
          .sort((a, b) => a.okul_no.localeCompare(b.okul_no, 'tr', { numeric: true })),
      })
    })()
  }, [id])

  const anahtar = useMemo(() => veri?.sorular.map((s) => s.cevap) ?? [], [veri])

  function ogrenciOzeti(ogrenciId: number) {
    const sonuc = sonuclar.get(ogrenciId)
    if (!sonuc) return null
    return ozetle(isaretler.get(sonuc.id) ?? [], anahtar)
  }

  if (hata && veri === undefined) return <p className="hata">{hata}</p>
  if (veri === undefined) return <p className="soluk">Yükleniyor…</p>
  if (veri === null)
    return (
      <div className="kart bos-durum">
        <p>Bu deneme kaydı bulunamadı.</p>
        <a href="#/">Sınıflarıma dön</a>
      </div>
    )

  const { uygulama, deneme, sinif, ogrenciler } = veri
  const girilmemisler = ogrenciler.filter((o) => !sonuclar.has(o.id))
  const ozetler = ogrenciler.map((o) => ogrenciOzeti(o.id)).filter((x) => x !== null)
  const ortalama = ozetler.length ? ozetler.reduce((t, x) => t + x.net, 0) / ozetler.length : null
  const seciliOgrenci = ogrenciler.find((o) => o.id === secili)

  function sonrakiGirilmemis(simdiki: number): Ogrenci | undefined {
    const sira = ogrenciler.findIndex((o) => o.id === simdiki)
    return [...ogrenciler.slice(sira + 1), ...ogrenciler.slice(0, sira)].find(
      (o) => !sonuclar.has(o.id) && o.aktif,
    )
  }

  async function kaydet(ogrenci: Ogrenci, yeniIsaretler: Isaret[], sonrakine: boolean) {
    setHata('')
    const s = await supabase
      .from('sonuclar')
      .upsert(
        {
          uygulama_id: id,
          ogrenci_id: ogrenci.id,
          giris_yolu: 'elle',
          onaylandi: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'uygulama_id,ogrenci_id' },
      )
      .select()
      .single()
    if (s.error) {
      setHata(hataMetni(s.error))
      return false
    }
    const c = await supabase
      .from('cevaplar')
      .upsert(
        yeniIsaretler.map((isaretlenen, i) => ({ sonuc_id: s.data.id, sira: i + 1, isaretlenen })),
        { onConflict: 'sonuc_id,sira' },
      )
    if (c.error) {
      setHata(hataMetni(c.error))
      return false
    }
    setSonuclar((eski) => new Map(eski).set(ogrenci.id, s.data))
    setIsaretler((eski) => new Map(eski).set(s.data.id, yeniIsaretler))
    const sonraki = sonrakine ? sonrakiGirilmemis(ogrenci.id) : undefined
    setSecili(sonraki?.id ?? null)
    return true
  }

  async function sonucuSil(ogrenciId: number) {
    const sonuc = sonuclar.get(ogrenciId)
    if (!sonuc) return
    const { error } = await supabase.from('sonuclar').delete().eq('id', sonuc.id)
    if (error) return setHata(hataMetni(error))
    setSonuclar((eski) => {
      const yeni = new Map(eski)
      yeni.delete(ogrenciId)
      return yeni
    })
  }

  async function uygulamayiSil() {
    const { error } = await supabase.from('uygulamalar').delete().eq('id', id)
    if (error) return setHata(hataMetni(error))
    git(`/sinif/${sinif.id}`)
  }

  return (
    <>
      <a href={`#/sinif/${sinif.id}`} className="geri-bag">
        ← {sinif.ad}
      </a>
      <div className="baslik-satiri">
        <div>
          <h1>{deneme.baslik}</h1>
          <p className="soluk">
            {sinif.ad} · {tarihYaz(uygulama.tarih)} · {deneme.soru_sayisi} soru
            {deneme.sure_dk && ` · ${deneme.sure_dk} dk`} · {deneme.deneme_kodu}
            {deneme.surum > 1 && ` (sürüm ${deneme.surum})`}
          </p>
        </div>
        <Onay
          etiket="Bu denemeyi sınıftan kaldır"
          soru="Bu uygulamada girilen bütün sonuçlar silinecek. Emin misiniz?"
          evet={uygulamayiSil}
        />
      </div>

      <div className="ozet-serit">
        <span>
          <strong>
            {sonuclar.size} / {ogrenciler.length}
          </strong>{' '}
          öğrencinin cevapları girildi
        </span>
        {ortalama !== null && (
          <span>
            Sınıf ortalaması <strong>{netYaz(ortalama)} net</strong>
          </span>
        )}
        {girilmemisler.length > 0 && !seciliOgrenci && (
          <button onClick={() => setSecili(girilmemisler[0].id)}>
            {sonuclar.size === 0 ? 'Cevap girmeye başla' : 'Kalanlardan devam et'}
          </button>
        )}
      </div>

      {hata && <p className="hata">{hata}</p>}

      {seciliOgrenci && (
        <CevapGirisi
          key={seciliOgrenci.id}
          ogrenci={seciliOgrenci}
          anahtar={anahtar}
          ilkIsaretler={
            sonuclar.has(seciliOgrenci.id) ? (isaretler.get(sonuclar.get(seciliOgrenci.id)!.id) ?? null) : null
          }
          sonrakiVar={!!sonrakiGirilmemis(seciliOgrenci.id)}
          kaydet={(yeni, sonrakine) => kaydet(seciliOgrenci, yeni, sonrakine)}
          vazgec={() => setSecili(null)}
        />
      )}

      <div className="tablo-kap">
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th>
              <th>Ad soyad</th>
              <th className="sayi">D</th>
              <th className="sayi">Y</th>
              <th className="sayi">B</th>
              <th className="sayi">Net</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ogrenciler.map((o) => {
              const ozet = ogrenciOzeti(o.id)
              return (
                <tr key={o.id} className={o.id === secili ? 'secili-satir' : o.aktif ? '' : 'pasif-satir'}>
                  <td>{o.okul_no}</td>
                  <td>
                    <a href={`#/karne/${o.id}`}>{o.ad_soyad}</a>
                  </td>
                  {ozet ? (
                    <>
                      <td className="sayi">{ozet.dogru}</td>
                      <td className="sayi">{ozet.yanlis}</td>
                      <td className="sayi">{ozet.bos}</td>
                      <td className="sayi">
                        <strong>{netYaz(ozet.net)}</strong>
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="soluk kucuk">
                      girilmedi
                    </td>
                  )}
                  <td className="islemler">
                    <button className="bag" onClick={() => setSecili(o.id)}>
                      {ozet ? 'Düzenle' : 'Gir'}
                    </button>
                    {ozet && (
                      <Onay etiket="Sil" soru="Bu öğrencinin cevapları silinsin mi?" evet={() => sonucuSil(o.id)} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
