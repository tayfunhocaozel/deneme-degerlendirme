import { useEffect, useMemo, useRef, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Deneme, DenemeSorusu, Isaret, Ogrenci, Sinif, Sonuc, Uygulama } from '../veritabani'
import { netYaz, ozetle } from '../puan'
import { tarihYaz } from '../bilesenler/SinifDenemeleri'
import type { OkumaSonucu } from './okuyucu.ts'
import { QR_BICIMI } from './kamera.ts'
import { eslestir, type Eslesme } from './eslestir.ts'

export type KayitBilgisi = {
  deneme: Deneme
  sorular: DenemeSorusu[]
  ogrenci: Ogrenci
  sinif: Sinif
  uygulamaId: number
  isaretler: Isaret[]
}

const SIKLAR: Isaret[] = ['A', 'B', 'C', 'D', 'bos']
const isaretYaz = (i: Isaret) => (i === 'bos' ? '–' : i === 'gecersiz' ? '*' : i)

function bugun(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Okunan formu öğretmene gösterir; öğrenci, uygulama ve cevaplar onaylanınca kaydeder.
export default function OptikOnay({
  okuma,
  siniflar,
  ogrenciler,
  kaydedildi,
  yenidenCek,
}: {
  okuma: OkumaSonucu
  siniflar: Sinif[]
  ogrenciler: Ogrenci[]
  kaydedildi: (k: KayitBilgisi) => void
  yenidenCek: () => void
}) {
  const [deneme, setDeneme] = useState<{ deneme: Deneme; sorular: DenemeSorusu[] } | null>(null)
  const [denemeHatasi, setDenemeHatasi] = useState('')
  const [ogrenciId, setOgrenciId] = useState<number | null>(null)
  const [eslesme, setEslesme] = useState<Eslesme | null>(null)
  const [uygulamalar, setUygulamalar] = useState<Uygulama[] | null>(null)
  const [uygulamaSecimi, setUygulamaSecimi] = useState<number | 'yeni'>('yeni')
  const [mevcut, setMevcut] = useState<Sonuc | null>(null)
  const [uzerineYaz, setUzerineYaz] = useState(false)
  const [isaretler, setIsaretler] = useState<Isaret[]>(okuma.cevaplar.map((c) => c.isaret))
  const [degisti, setDegisti] = useState<Set<number>>(new Set())
  const [seciliSoru, setSeciliSoru] = useState<number | null>(null)
  const [bekliyor, setBekliyor] = useState(false)
  const [hata, setHata] = useState('')
  const tuval = useRef<HTMLCanvasElement>(null)

  // QR → deneme
  useEffect(() => {
    ;(async () => {
      const m = okuma.qr.match(QR_BICIMI)
      if (!m) return setDenemeHatasi(`Bu QR platformun formuna ait değil: "${okuma.qr}".`)
      const [, kod, surumMetni] = m
      const surum = Number(surumMetni)
      const d = await supabase.from('denemeler').select('*').eq('deneme_kodu', kod).eq('surum', surum).maybeSingle()
      if (d.error) return setDenemeHatasi(hataMetni(d.error))
      if (!d.data) {
        const diger = await supabase.from('denemeler').select('surum').eq('deneme_kodu', kod)
        const surumler = (diger.data ?? []).map((x) => x.surum).sort()
        return setDenemeHatasi(
          surumler.length
            ? `${kod} denemesinin ${surum}. sürümü platformda yok (yüklü sürüm: ${surumler.join(', ')}). Yanlış cevap anahtarıyla değerlendirme yapılmaz; soru üretim tarafında bu sürüm aktarılmalı.`
            : `Bu deneme platforma yüklenmemiş: ${kod} sürüm ${surum}. Soru üretim tarafında aktarılmalı.`,
        )
      }
      const s = await supabase.from('deneme_sorulari').select('*').eq('deneme_id', d.data.id).order('sira')
      if (s.error) return setDenemeHatasi(hataMetni(s.error))
      if (s.data.length !== okuma.cevaplar.length)
        return setDenemeHatasi(`Denemede ${s.data.length} soru var, formda ${okuma.cevaplar.length}. Form bu denemeye ait olmayabilir.`)
      setDeneme({ deneme: d.data, sorular: s.data })
      const e = eslestir(okuma.ogrenciNo, okuma.noDurum, ogrenciler, siniflar, d.data.sinif)
      setEslesme(e)
      if (e.tur === 'tek') setOgrenciId(e.ogrenci.id)
    })()
  }, [okuma, ogrenciler, siniflar])

  const ogrenci = ogrenciler.find((o) => o.id === ogrenciId) ?? null
  const sinif = ogrenci ? (siniflar.find((s) => s.id === ogrenci.sinif_id) ?? null) : null

  // Öğrenci seçilince: o sınıfta bu denemenin uygulamaları
  useEffect(() => {
    setUygulamalar(null)
    setMevcut(null)
    setUzerineYaz(false)
    if (!ogrenci || !deneme) return
    supabase
      .from('uygulamalar')
      .select('*')
      .eq('sinif_id', ogrenci.sinif_id)
      .eq('deneme_id', deneme.deneme.id)
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return setHata(hataMetni(error))
        setUygulamalar(data)
        setUygulamaSecimi(data[0]?.id ?? 'yeni')
      })
  }, [ogrenci, deneme])

  // Uygulama seçilince: öğrencinin bu uygulamada kaydı var mı
  useEffect(() => {
    setMevcut(null)
    setUzerineYaz(false)
    if (!ogrenci || uygulamaSecimi === 'yeni') return
    supabase
      .from('sonuclar')
      .select('*')
      .eq('uygulama_id', uygulamaSecimi)
      .eq('ogrenci_id', ogrenci.id)
      .maybeSingle()
      .then(({ data }) => setMevcut(data))
  }, [ogrenci, uygulamaSecimi])

  // Düzeltilmiş form önizlemesi (yalnızca bellekte)
  useEffect(() => {
    const t = tuval.current
    if (!t) return
    const { gen, yuk, veri } = okuma.duz
    t.width = gen
    t.height = yuk
    const g = new ImageData(gen, yuk)
    for (let i = 0; i < veri.length; i++) {
      g.data[4 * i] = g.data[4 * i + 1] = g.data[4 * i + 2] = veri[i]
      g.data[4 * i + 3] = 255
    }
    t.getContext('2d')!.putImageData(g, 0, 0)
  }, [okuma, deneme])

  const anahtar = useMemo(() => deneme?.sorular.map((s) => s.cevap) ?? [], [deneme])
  const ozet = deneme ? ozetle(isaretler, anahtar) : null
  const supheliSayisi = okuma.cevaplar.filter((c, i) => c.supheli && !degisti.has(i)).length

  // Öğrenci seçimi listesi: denemenin düzeyindeki sınıflar önce.
  const secenekler = useMemo(() => {
    const duzey = deneme?.deneme.sinif
    return [...siniflar]
      .sort((a, b) => Number(b.sinif_duzeyi === duzey) - Number(a.sinif_duzeyi === duzey) || a.ad.localeCompare(b.ad, 'tr'))
      .map((s) => ({
        sinif: s,
        ogrenciler: ogrenciler
          .filter((o) => o.sinif_id === s.id && o.aktif)
          .sort((a, b) => a.okul_no.localeCompare(b.okul_no, 'tr', { numeric: true })),
      }))
      .filter((g) => g.ogrenciler.length)
  }, [siniflar, ogrenciler, deneme])

  function isaretle(i: number, isaret: Isaret) {
    setIsaretler((eski) => eski.map((x, j) => (j === i ? isaret : x)))
    setDegisti((eski) => new Set(eski).add(i))
    setSeciliSoru(null)
  }

  async function kaydet() {
    if (!deneme || !ogrenci || !sinif) return
    setHata('')
    setBekliyor(true)
    try {
      let uygulamaId = uygulamaSecimi
      if (uygulamaId === 'yeni') {
        const u = await supabase
          .from('uygulamalar')
          .insert({ sinif_id: sinif.id, deneme_id: deneme.deneme.id, tarih: bugun() })
          .select()
          .single()
        if (u.error) return setHata(hataMetni(u.error))
        uygulamaId = u.data.id
        setUygulamalar((eski) => [u.data, ...(eski ?? [])])
        setUygulamaSecimi(u.data.id)
      }
      const { error } = await supabase.rpc('sonuc_kaydet', {
        p_uygulama_id: uygulamaId,
        p_ogrenci_id: ogrenci.id,
        p_cevaplar: isaretler,
        p_giris_yolu: 'optik',
        p_uzerine_yaz: uzerineYaz,
      })
      if (error) {
        if (error.message.includes('zaten_kayitli')) {
          const s = await supabase.from('sonuclar').select('*').eq('uygulama_id', uygulamaId).eq('ogrenci_id', ogrenci.id).maybeSingle()
          setMevcut(s.data)
          return setHata('Bu öğrencinin bu denemede kaydı var. Üzerine yazmak için aşağıdaki kutuyu işaretleyin.')
        }
        if (error.code === 'PGRST202')
          return setHata('Kayıt fonksiyonu (sonuc_kaydet) veritabanında yok. Kurulum SQL’inin çalıştırılması gerekiyor.')
        return setHata(hataMetni(error))
      }
      kaydedildi({ deneme: deneme.deneme, sorular: deneme.sorular, ogrenci, sinif, uygulamaId, isaretler })
    } finally {
      setBekliyor(false)
    }
  }

  const kaydedilebilir = !!deneme && !!ogrenci && uygulamalar !== null && (!mevcut || uzerineYaz) && !bekliyor

  return (
    <div className="optik-onay">
      {denemeHatasi ? (
        <div className="kart">
          <p className="hata">{denemeHatasi}</p>
          <button onClick={yenidenCek}>Başka form okut</button>
        </div>
      ) : !deneme ? (
        <p className="soluk">Deneme bilgileri alınıyor…</p>
      ) : (
        <>
          <div className="kart optik-baslik">
            <span className="soluk kucuk">
              {deneme.deneme.deneme_kodu}
              {deneme.deneme.surum > 1 && ` · sürüm ${deneme.deneme.surum}`}
            </span>
            <strong>{deneme.deneme.baslik}</strong>
          </div>

          <div className="kart form">
            <div className="ogrenci-satiri">
              <span className="soluk kucuk">
                Okunan numara: <strong>{okuma.ogrenciNo ?? '—'}</strong>
                {okuma.noSupheli && ' (soluk işaret, kontrol edin)'}
              </span>
              {ogrenci && sinif ? (
                <span className="ogrenci-adi">
                  {ogrenci.ad_soyad} <span className="soluk">· {sinif.ad} · {ogrenci.okul_no}</span>
                </span>
              ) : null}
            </div>
            {okuma.noDurum === 'ortada_bos_hane' && (
              <p className="uyari">Numarada ortada boş hane var; {okuma.ogrenciNo} olarak okundu. Doğru öğrenci mi, kontrol edin.</p>
            )}
            {eslesme?.tur === 'yok' && !ogrenci && <p className="hata">{eslesme.mesaj} Listeden seçin.</p>}
            {eslesme?.tur === 'coklu' && !ogrenci && (
              <p className="uyari">Bu numara birden fazla sınıfta var. Doğru öğrenciyi seçin.</p>
            )}
            <label>
              Öğrenci
              <select value={ogrenciId ?? ''} onChange={(e) => setOgrenciId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Öğrenci seçin —</option>
                {eslesme?.tur === 'coklu' && (
                  <optgroup label="Bu numaraya uyanlar">
                    {eslesme.adaylar.map((o) => (
                      <option key={`a${o.id}`} value={o.id}>
                        {o.okul_no} {o.ad_soyad} ({siniflar.find((s) => s.id === o.sinif_id)?.ad})
                      </option>
                    ))}
                  </optgroup>
                )}
                {secenekler.map((g) => (
                  <optgroup key={g.sinif.id} label={g.sinif.ad}>
                    {g.ogrenciler.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.okul_no} {o.ad_soyad}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {ogrenci && sinif && uygulamalar !== null && (
              <>
                {uygulamalar.length === 0 ? (
                  <p className="bilgi">
                    {sinif.ad} için {deneme.deneme.deneme_kodu} uygulaması bugünün tarihiyle oluşturulacak.
                  </p>
                ) : uygulamalar.length > 1 ? (
                  <label>
                    Uygulama
                    <select
                      value={uygulamaSecimi}
                      onChange={(e) => setUygulamaSecimi(e.target.value === 'yeni' ? 'yeni' : Number(e.target.value))}
                    >
                      {uygulamalar.map((u) => (
                        <option key={u.id} value={u.id}>
                          {tarihYaz(u.tarih)}
                        </option>
                      ))}
                      <option value="yeni">Yeni uygulama (bugün)</option>
                    </select>
                  </label>
                ) : null}
                {mevcut && (
                  <div className="uyari">
                    <p>
                      {ogrenci.ad_soyad} bu denemede zaten kayıtlı ({mevcut.giris_yolu},{' '}
                      {new Date(mevcut.updated_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}).
                      Üzerine yazılsın mı?
                    </p>
                    <label className="onay-kutusu">
                      <input type="checkbox" checked={uzerineYaz} onChange={(e) => setUzerineYaz(e.target.checked)} />
                      Evet, eski cevapların üzerine yaz
                    </label>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="kart">
            <div className="baslik-satiri optik-ozet">
              {ozet && (
                <span className="ozet-kutulari">
                  <span className="ozet-kutu dogru">{ozet.dogru} D</span>
                  <span className="ozet-kutu yanlis">{ozet.yanlis} Y</span>
                  <span className="ozet-kutu bos">{ozet.bos} B</span>
                  <span className="ozet-kutu net">{netYaz(ozet.net)} net</span>
                </span>
              )}
            </div>
            {supheliSayisi > 0 && (
              <p className="uyari">
                Sarı çerçeveli {supheliSayisi} soruyu kâğıtla karşılaştırın; yanlış okunduysa dokunup düzeltin.
              </p>
            )}
            <div className="optik-izgara">
              {isaretler.map((isaret, i) => {
                const dogru = anahtar[i]
                const tur =
                  isaret === 'bos' ? 'bos' : isaret === 'gecersiz' ? 'gecersiz' : isaret === dogru ? 'dogru' : 'yanlis'
                const supheli = okuma.cevaplar[i].supheli && !degisti.has(i)
                return (
                  <button
                    key={i}
                    type="button"
                    className={`optik-hucre hucre-${tur} ${supheli ? 'supheli' : ''} ${seciliSoru === i ? 'secili' : ''}`}
                    onClick={() => setSeciliSoru(seciliSoru === i ? null : i)}
                    title={`Koyuluk: ${okuma.cevaplar[i].koyuluklar.map((k) => k.toFixed(2)).join(' / ')}`}
                  >
                    <span className="hucre-no">{i + 1}</span>
                    <span className="hucre-isaret">{isaretYaz(isaret)}</span>
                    {degisti.has(i) && <span className="hucre-duzeltildi">düzeltildi</span>}
                  </button>
                )
              })}
            </div>
            {seciliSoru !== null && (
              <div className="sik-secici">
                <span>{seciliSoru + 1}. soru:</span>
                {SIKLAR.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`sik ${isaretler[seciliSoru] === s ? 'secili' : ''}`}
                    onClick={() => isaretle(seciliSoru, s)}
                  >
                    {s === 'bos' ? 'Boş' : s}
                  </button>
                ))}
              </div>
            )}
            <p className="soluk kucuk">
              Yeşil doğru, kırmızı yanlış, gri boş, turuncu çift işaretli. Bir soruya dokunarak değiştirebilirsiniz.
            </p>
          </div>

          <details className="kart duz-onizleme">
            <summary>Okunan form görüntüsü</summary>
            <canvas ref={tuval} />
          </details>

          {hata && <p className="hata">{hata}</p>}
          <div className="dugmeler optik-kaydet">
            <button onClick={kaydet} disabled={!kaydedilebilir}>
              {bekliyor ? 'Kaydediliyor…' : 'Onayla ve kaydet'}
            </button>
            <button className="ikincil" onClick={yenidenCek}>
              Yeniden çek
            </button>
          </div>
        </>
      )}
    </div>
  )
}
