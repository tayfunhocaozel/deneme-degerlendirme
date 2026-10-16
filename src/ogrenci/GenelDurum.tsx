import { netYaz, yuzde } from '../puan'
import GelisimGrafigi from '../bilesenler/GelisimGrafigi'
import KazanimListesi from './KazanimListesi'
import { useOzet } from './veri'

// Denemeden denemeye gelişim ve kazanım bazlı güçlü/zayıf konular.
export default function GenelDurum() {
  const { ozet, hata } = useOzet()
  if (hata) return <p className="hata">{hata}</p>
  if (!ozet) return <p className="soluk">Yükleniyor…</p>

  const sonuclu = ozet.denemeler.filter((d) => d.sonuc)
  if (sonuclu.length === 0)
    return (
      <>
        <h1>Genel durum</h1>
        <div className="kart bos-durum">
          <p>İlk denemenin sonucu gelince gelişimin burada görünecek.</p>
        </div>
      </>
    )

  const netler = sonuclu.map((d) => d.sonuc!.net)
  const ortalama = netler.reduce((t, n) => t + n, 0) / netler.length
  const son = netler[netler.length - 1]
  const degisim = netler.length > 1 ? son - netler[netler.length - 2] : null
  const kazanimlar = ozet.kazanimlar.filter((k) => k.toplam > 0)
  const sirali = [...kazanimlar].sort((a, b) => a.dogru / a.toplam - b.dogru / b.toplam)
  const enZayif = sirali[0]
  const enGuclu = sirali[sirali.length - 1]

  return (
    <>
      <h1>Genel durum</h1>
      <div className="ozet-serit">
        <span>
          <strong>{sonuclu.length}</strong> deneme
        </span>
        <span>
          Ortalama <strong>{netYaz(ortalama)} net</strong>
        </span>
        <span>
          Son deneme <strong>{netYaz(son)} net</strong>
          {degisim !== null && (
            <span className={degisim >= 0 ? 'metin-dogru' : 'metin-yanlis'}>
              {' '}
              ({degisim >= 0 ? '+' : ''}
              {netYaz(degisim)})
            </span>
          )}
        </span>
      </div>

      <section className="bolum">
        <h2 className="bolum-basligi">Netlerin</h2>
        {sonuclu.length > 1 ? (
          <GelisimGrafigi
            ogrenciEtiketi="Senin netin"
            noktalar={sonuclu.map((d) => ({
              etiket: d.deneme_kodu,
              ogrenci: d.sonuc!.net,
              sinif: d.sinif_ortalama ?? 0,
              en: d.soru_sayisi,
            }))}
          />
        ) : (
          <p className="soluk kucuk">Grafik ikinci denemenin sonucu gelince görünecek.</p>
        )}
      </section>

      <section className="bolum">
        <h2 className="bolum-basligi">Kazanımlar</h2>
        {kazanimlar.length === 0 ? (
          <p className="soluk">Kazanım analizi, cevapları açıklanan (kapanmış) denemelerden hesaplanır.</p>
        ) : (
          <>
            {sirali.length > 1 && (
              <p>
                En güçlü olduğun: <strong>{enGuclu.kod}</strong> ({yuzde(enGuclu.dogru / enGuclu.toplam)}). Çalışman
                gereken: <strong>{enZayif.kod}</strong> ({yuzde(enZayif.dogru / enZayif.toplam)}).
              </p>
            )}
            <KazanimListesi satirlar={sirali} />
            <p className="soluk kucuk">Cevapları açıklanan (kapanmış) denemelerden hesaplanır.</p>
          </>
        )}
      </section>
    </>
  )
}
