import { tarihYaz } from '../bilesenler/SinifDenemeleri'
import { sonTarihYaz } from './tipler'
import { useOzet } from './veri'

// Açık denemeler: cevaplanacaklar ve bu dönemde gönderilenler.
export default function Denemeler() {
  const { ozet, hata } = useOzet()
  if (hata) return <p className="hata">{hata}</p>
  if (!ozet) return <p className="soluk">Yükleniyor…</p>

  const acik = ozet.denemeler.filter((d) => d.acik)
  const bekleyen = acik.filter((d) => !d.gonderildi).sort((a, b) => (a.son_tarih ?? '').localeCompare(b.son_tarih ?? ''))
  const tamamlanan = acik.filter((d) => d.gonderildi)

  return (
    <>
      <h1>Denemeler</h1>
      {bekleyen.length === 0 ? (
        <div className="kart bos-durum">
          <p>Şu an cevaplaman gereken açık deneme yok.</p>
          <p className="soluk kucuk">Öğretmenin bir denemeyi açınca burada görünecek.</p>
        </div>
      ) : (
        <div className="liste">
          {bekleyen.map((d) => (
            <a key={d.uygulama_id} className="liste-satiri" href={`#/cevap/${d.uygulama_id}`}>
              <span className="liste-ana">
                <strong>{d.baslik}</strong>
                <span className="soluk kucuk">
                  {d.deneme_kodu} · {d.soru_sayisi} soru · son gün {sonTarihYaz(d.son_tarih!)}
                </span>
              </span>
              <span className="etiket etiket-yeni">Cevapla</span>
            </a>
          ))}
        </div>
      )}

      {tamamlanan.length > 0 && (
        <section className="bolum">
          <h2 className="bolum-basligi">Gönderdiklerin</h2>
          <div className="liste">
            {tamamlanan.map((d) => (
              <a key={d.uygulama_id} className="liste-satiri" href={`#/sonuc/${d.uygulama_id}`}>
                <span className="liste-ana">
                  <strong>{d.baslik}</strong>
                  <span className="soluk kucuk">
                    {d.deneme_kodu} · {tarihYaz(d.tarih)}
                  </span>
                </span>
                <span className="etiket etiket-var">Tamamlandı</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
