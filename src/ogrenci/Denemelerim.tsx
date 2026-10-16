import { netYaz } from '../puan'
import { tarihYaz } from '../bilesenler/SinifDenemeleri'
import { useOzet } from './veri'

// Sonucu olan bütün denemeler (öğretmenin optikle okudukları dahil), en yeni üstte.
export default function Denemelerim() {
  const { ozet, hata } = useOzet()
  if (hata) return <p className="hata">{hata}</p>
  if (!ozet) return <p className="soluk">Yükleniyor…</p>

  const liste = ozet.denemeler.filter((d) => d.sonuc).reverse()

  return (
    <>
      <h1>Denemelerim</h1>
      {liste.length === 0 ? (
        <div className="kart bos-durum">
          <p>Henüz sonucu olan bir denemen yok.</p>
        </div>
      ) : (
        <div className="tablo-kap">
          <table className="tablo kartlasan">
            <thead>
              <tr>
                <th>Deneme</th>
                <th className="sayi">D</th>
                <th className="sayi">Y</th>
                <th className="sayi">B</th>
                <th className="sayi">Net</th>
                <th className="sayi">Sınıf ort.</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.uygulama_id}>
                  <td className="hucre-tam">
                    <a href={`#/sonuc/${d.uygulama_id}`}>{d.deneme_kodu}</a>
                    <span className="soluk kucuk">
                      {' '}
                      · {tarihYaz(d.tarih)}
                      {!d.kapali && ' · cevaplar kapanınca açılacak'}
                    </span>
                  </td>
                  <td className="sayi" data-etiket="D">{d.sonuc!.dogru}</td>
                  <td className="sayi" data-etiket="Y">{d.sonuc!.yanlis}</td>
                  <td className="sayi" data-etiket="B">{d.sonuc!.bos}</td>
                  <td className="sayi" data-etiket="Net">
                    <strong>{netYaz(d.sonuc!.net)}</strong>
                  </td>
                  <td className="sayi soluk" data-etiket="Sınıf">
                    {d.sinif_ortalama !== null ? netYaz(d.sinif_ortalama) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
