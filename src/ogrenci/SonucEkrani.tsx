import { netYaz } from '../puan'
import { tarihYaz } from '../bilesenler/SinifDenemeleri'
import { sonTarihYaz } from './tipler'
import { useDeneme } from './veri'
import KazanimListesi from './KazanimListesi'

// Bir denemenin sonucu. Soru soru doğru cevaplar deneme kapanınca görünür.
export default function SonucEkrani({ id }: { id: number }) {
  const { deneme, hata } = useDeneme(id)
  if (hata) return <p className="hata">{hata}</p>
  if (!deneme) return <p className="soluk">Yükleniyor…</p>

  const { sonuc } = deneme
  const ogretmenGirdi = deneme.giris_yolu === 'elle' || deneme.giris_yolu === 'optik'

  return (
    <>
      <a href="#/denemelerim" className="geri-bag">
        ← Denemelerim
      </a>
      <h1>{deneme.baslik}</h1>
      <p className="soluk">
        {deneme.deneme_kodu} · {tarihYaz(deneme.tarih)} · {deneme.soru_sayisi} soru
      </p>

      {!sonuc ? (
        <div className="kart bos-durum">
          {deneme.acik && !deneme.gonderildi ? (
            <>
              <p>Bu denemeyi henüz göndermedin.</p>
              <a href={`#/cevap/${id}`}>Cevapla</a>
            </>
          ) : (
            <p>Bu deneme için sonucun yok.</p>
          )}
        </div>
      ) : (
        <>
          <div className="kart">
            <div className="ozet-kutulari">
              <span className="ozet-kutu dogru">{sonuc.dogru} doğru</span>
              <span className="ozet-kutu yanlis">{sonuc.yanlis} yanlış</span>
              <span className="ozet-kutu bos">{sonuc.bos} boş</span>
              <span className="ozet-kutu net">{netYaz(sonuc.net)} net</span>
            </div>
            {deneme.sinif_ortalama !== null && (
              <p className="soluk">
                Sınıf ortalaması <strong>{netYaz(deneme.sinif_ortalama)} net</strong> ({deneme.kisi} öğrenci)
              </p>
            )}
            {ogretmenGirdi && deneme.gonderildi && (
              <p className="soluk kucuk">
                Öğretmenin bu denemede senin kâğıdını da okudu; onun okuması geçerli sayıldı.
              </p>
            )}
          </div>

          {deneme.sorular ? (
            <>
              <section className="bolum">
                <h2 className="bolum-basligi">Kazanımlara göre</h2>
                <KazanimListesi satirlar={deneme.kazanimlar ?? []} sinifOranVar />
              </section>
              <section className="bolum">
                <h2 className="bolum-basligi">Soru soru</h2>
                <div className="tablo-kap">
                  <table className="tablo soru-sonuc-tablosu">
                    <thead>
                      <tr>
                        <th className="sayi">Soru</th>
                        <th>Senin cevabın</th>
                        <th>Doğru cevap</th>
                        <th>Kazanım</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deneme.sorular.map((s) => {
                        const dogru = s.isaretlenen === s.dogru_cevap
                        const bos = s.isaretlenen === 'bos'
                        return (
                          <tr key={s.sira}>
                            <td className="sayi">{s.sira}</td>
                            <td className={bos ? 'soluk' : dogru ? 'metin-dogru' : 'metin-yanlis'}>
                              <strong>
                                {bos ? 'boş' : s.isaretlenen === 'gecersiz' ? 'çift işaret' : s.isaretlenen}
                              </strong>{' '}
                              {!bos && (dogru ? '✓' : '✗')}
                            </td>
                            <td>
                              <strong>{s.dogru_cevap}</strong>
                            </td>
                            <td className="soluk kucuk">{s.kazanim}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <p className="soluk">
              Soru soru doğru cevaplar ve kazanım analizi deneme kapanınca açılacak
              {deneme.son_tarih && !deneme.kapali ? ` (${sonTarihYaz(deneme.son_tarih)})` : ''}.
            </p>
          )}
        </>
      )}
    </>
  )
}
