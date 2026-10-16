import { useEffect, useState, type CSSProperties } from 'react'
import { hataMetni, supabase } from '../supabase'
import { git } from '../yonlendirme'
import { sonTarihYaz } from './tipler'
import { useDeneme } from './veri'

type Secim = 'A' | 'B' | 'C' | 'D' | 'bos'
const SIKLAR = ['A', 'B', 'C', 'D'] as const

// Gönderilmemiş cevaplar bu cihazda saklanır; sayfa kapansa da kaybolmaz.
function taslakAnahtari(kullaniciId: string, id: number) {
  return `taslak:${kullaniciId}:${id}`
}

function taslakOku(anahtar: string, adet: number): Secim[] {
  const bos: Secim[] = Array(adet).fill('bos')
  try {
    const kayit = JSON.parse(localStorage.getItem(anahtar) ?? 'null')
    if (Array.isArray(kayit) && kayit.length === adet) return kayit
  } catch {
    // bozuk ya da erişilemeyen kayıt: boş başla
  }
  return bos
}

export default function CevapEkrani({
  id,
  kullaniciId,
  sinifAdi,
}: {
  id: number
  kullaniciId: string
  sinifAdi?: string
}) {
  const { deneme, hata: yuklemeHatasi } = useDeneme(id)
  const anahtar = taslakAnahtari(kullaniciId, id)
  const [cevaplar, setCevaplar] = useState<Secim[] | null>(null)
  const [onayAcik, setOnayAcik] = useState(false)
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  useEffect(() => {
    if (deneme && !cevaplar) setCevaplar(taslakOku(anahtar, deneme.soru_sayisi))
  }, [deneme])

  useEffect(() => {
    if (!cevaplar) return
    try {
      localStorage.setItem(anahtar, JSON.stringify(cevaplar))
    } catch {
      // depolama kapalıysa taslak yalnızca bu sayfada kalır
    }
  }, [cevaplar])

  if (yuklemeHatasi) return <p className="hata">{yuklemeHatasi}</p>
  if (!deneme || !cevaplar) return <p className="soluk">Yükleniyor…</p>

  if (deneme.gonderildi)
    return (
      <div className="kart bos-durum">
        <p>Bu denemeyi gönderdin.</p>
        <a href={`#/sonuc/${id}`}>Sonucunu gör</a>
      </div>
    )
  if (!deneme.acik)
    return (
      <div className="kart bos-durum">
        <p>Bu denemenin süresi doldu; artık cevap gönderilemez.</p>
        <a href="#/">Denemelere dön</a>
      </div>
    )

  const bosNumaralar = cevaplar.flatMap((c, i) => (c === 'bos' ? [i + 1] : []))
  const bosSayisi = bosNumaralar.length
  const isaretli = cevaplar.length - bosSayisi
  const oran = cevaplar.length ? isaretli / cevaplar.length : 0

  function isaretle(i: number, sik: Secim) {
    setOnayAcik(false)
    setCevaplar((eski) => eski!.map((c, j) => (j === i ? (c === sik ? 'bos' : sik) : c)))
  }

  async function gonder() {
    if (bekliyor) return
    setHata('')
    setBekliyor(true)
    const { error } = await supabase.rpc('ogrenci_gonder', { p_uygulama_id: id, p_cevaplar: cevaplar! })
    if (error) {
      setBekliyor(false)
      return setHata(`${hataMetni(error)} Cevapların bu cihazda duruyor; yeniden deneyebilirsin.`)
    }
    try {
      localStorage.removeItem(anahtar)
    } catch {
      // önemsiz
    }
    git(`/sonuc/${id}`)
  }

  return (
    <>
      <a href="#/" className="geri-bag">
        ← Denemeler
      </a>
      <div className="cevap-kagidi-baslik">
        <h1>{deneme.baslik}</h1>
        <p className="soluk">
          <strong>{deneme.deneme_kodu}</strong>
          {sinifAdi && ` · ${sinifAdi}`} · {deneme.soru_sayisi} soru · son gün {sonTarihYaz(deneme.son_tarih!)}
        </p>
      </div>

      <div className="ilerleme" aria-live="polite">
        <span>
          <strong>
            {isaretli} / {cevaplar.length}
          </strong>{' '}
          işaretli
        </span>
        <span className="soluk">{bosSayisi} boş</span>
        <span className="soluk">%{Math.round(oran * 100)}</span>
        <div className="ilerleme-cubugu" aria-hidden="true">
          <div className="ilerleme-dolu" style={{ width: `${oran * 100}%` }} />
        </div>
      </div>

      <div className="kart cevap-kagidi">
        <p className="soluk kucuk">
          Şıkka dokunarak işaretle; seçili şıkka yeniden dokunursan soru boş olur. Cevapların bu cihazda saklanır.
        </p>
        {/* Kâğıttaki optik form gibi: iki sütun, sorular yukarıdan aşağıya (telefonda tek sütun). */}
        <div
          className="soru-izgara optik-izgara"
          style={{ '--satir': Math.ceil(cevaplar.length / 2) } as CSSProperties}
        >
          {cevaplar.map((c, i) => (
            <div key={i} className={`soru-satiri ${c === 'bos' ? 'girilmedi' : ''}`} role="group" aria-label={`Soru ${i + 1}`}>
              <span className="soru-no">{i + 1}</span>
              {SIKLAR.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`sik ${c === s ? 'secili' : ''}`}
                  aria-pressed={c === s}
                  aria-label={`Soru ${i + 1}, ${s} şıkkı`}
                  onClick={() => isaretle(i, s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="kart gonder-cubugu">
        {onayAcik ? (
          <>
            <p>
              <strong>{isaretli}</strong> soru işaretli, <strong>{bosSayisi}</strong> soru boş.
            </p>
            {bosSayisi > 0 && (
              <p className="uyari">
                Boş sorular: {bosNumaralar.join(', ')}. Bunlar boş sayılacak.
              </p>
            )}
            <p className="kucuk">Gönderdikten sonra cevaplarını değiştiremezsin.</p>
            {hata && <p className="hata">{hata}</p>}
            <div className="dugmeler">
              <button onClick={gonder} disabled={bekliyor}>
                {bekliyor ? 'Gönderiliyor…' : 'Evet, gönder'}
              </button>
              <button className="ikincil" onClick={() => setOnayAcik(false)} disabled={bekliyor}>
                {bosSayisi > 0 ? 'Boş sorulara dön' : 'Kontrol edeyim'}
              </button>
            </div>
          </>
        ) : (
          <div className="dugmeler">
            <span>
              <strong>{isaretli}</strong> işaretli · <span className="soluk">{bosSayisi} boş</span>
            </span>
            <button onClick={() => setOnayAcik(true)}>Denemeyi bitir</button>
          </div>
        )}
      </div>
    </>
  )
}
