import { useMemo, useState } from 'react'
import type { Deneme, DenemeSorusu, Isaret, Ogrenci, Sinif } from '../veritabani'
import { kagitOzeti, kazanimMatrisi, SECENEKLER, soruIstatistikleri, type Kagit } from '../analiz'
import { bicimsizYaz, netYaz, yuzde } from '../puan'
import { exceleAktar, netSayi, yuzdeSayi } from '../disaAktar'

// Bir denemenin bir sınıftaki sonuçları: özet, soru bazında şık dağılımı,
// en sık yanılgılar ve öğrenci × kazanım ısı haritası.
export default function SinifRaporu({
  deneme,
  sinif,
  sorular,
  ogrenciler,
  kagitlar,
}: {
  deneme: Deneme
  sinif: Sinif
  sorular: DenemeSorusu[]
  ogrenciler: Ogrenci[]
  kagitlar: Kagit[]
}) {
  const anahtar = useMemo(() => sorular.map((s) => s.cevap), [sorular])
  const ogrenciAdi = useMemo(() => new Map(ogrenciler.map((o) => [o.id, o])), [ogrenciler])
  const istatistik = useMemo(() => soruIstatistikleri(kagitlar, sorular), [kagitlar, sorular])
  const [bekliyor, setBekliyor] = useState(false)

  if (kagitlar.length === 0)
    return (
      <div className="kart bos-durum">
        <p>Rapor için önce en az bir öğrencinin cevaplarını girin.</p>
      </div>
    )

  const ozetler = kagitlar.map((k) => ({ k, o: kagitOzeti(k, anahtar) }))
  const netler = ozetler.map((x) => x.o.net)
  const ort = (f: (o: (typeof ozetler)[number]['o']) => number) =>
    ozetler.reduce((t, x) => t + f(x.o), 0) / ozetler.length
  const sirali = [...netler].sort((a, b) => a - b)
  const medyan =
    sirali.length % 2 ? sirali[(sirali.length - 1) / 2] : (sirali[sirali.length / 2 - 1] + sirali[sirali.length / 2]) / 2
  const girilmeyen = ogrenciler.filter((o) => o.aktif).length - kagitlar.length

  // Net dağılımı: 2'şer netlik aralıklar.
  const aralik = 2
  const enAlt = Math.min(0, Math.floor(Math.min(...netler) / aralik) * aralik)
  const kutular: { alt: number; sayi: number }[] = []
  for (let a = enAlt; a < deneme.soru_sayisi; a += aralik) kutular.push({ alt: a, sayi: 0 })
  // Tam puan (ör. 20 net) son aralığa düşer.
  for (const n of netler) kutular[Math.min(kutular.length - 1, Math.floor((n - enAlt) / aralik))].sayi++
  const enCokKutu = Math.max(...kutular.map((k) => k.sayi))

  // En sık yanılgılar: (soru, şık) çiftleri.
  const yanilgilar = istatistik
    .flatMap((ist, i) =>
      SECENEKLER.filter((s) => s !== ist.soru.cevap && ist.secim[s] > 0).map((sik) => ({
        ist,
        sira: i + 1,
        sik,
        sayi: ist.secim[sik],
        metin: (ist.soru.celdiriciler as Record<string, string>)[sik] ?? null,
        ogrenciler: kagitlar.filter((k) => k.isaretler[i] === sik).map((k) => ogrenciAdi.get(k.ogrenciId)),
      })),
    )
    .sort((a, b) => b.sayi - a.sayi || a.sira - b.sira)
    .slice(0, 10)

  const { kazanimlar, satir } = kazanimMatrisi(sorular)
  const matrisSatirlari = ozetler
    .map(({ k, o }) => ({ ogrenci: ogrenciAdi.get(k.ogrenciId)!, net: o.net, hucre: satir(k) }))
    .sort((a, b) => a.ogrenci.okul_no.localeCompare(b.ogrenci.okul_no, 'tr', { numeric: true }))
  const sinifHucre = Object.fromEntries(
    kazanimlar.map((kod) => {
      const d = matrisSatirlari.reduce((t, r) => t + r.hucre[kod].dogru, 0)
      const top = matrisSatirlari.reduce((t, r) => t + r.hucre[kod].toplam, 0)
      return [kod, { dogru: d, toplam: top }]
    }),
  )

  async function aktar() {
    setBekliyor(true)
    const isaretYaz = (i: Isaret | undefined) => (i === 'bos' || !i ? '' : i === 'gecersiz' ? '*' : i)
    await exceleAktar(`${deneme.deneme_kodu} ${sinif.ad} sonuçları.xlsx`, [
      {
        ad: 'Öğrenciler',
        satirlar: [
          ['Okul no', 'Ad soyad', 'D', 'Y', 'B', 'Net', ...sorular.map((s) => `${s.sira}`)],
          ...matrisSatirlari.map((r) => {
            const k = kagitlar.find((x) => x.ogrenciId === r.ogrenci.id)!
            const o = kagitOzeti(k, anahtar)
            return [r.ogrenci.okul_no, r.ogrenci.ad_soyad, o.dogru, o.yanlis, o.bos, netSayi(o.net), ...sorular.map((_, i) => isaretYaz(k.isaretler[i]))]
          }),
          ['', 'Cevap anahtarı', '', '', '', '', ...anahtar],
        ],
      },
      {
        ad: 'Sorular',
        satirlar: [
          ['Sıra', 'Soru', 'Kazanım', 'Cevap', 'Doğru %', 'A', 'B', 'C', 'D', 'Boş', 'Çift işaret', 'Özet'],
          ...istatistik.map((ist) => [
            ist.soru.sira,
            ist.soru.soru_id,
            ist.soru.kazanim.join(', '),
            ist.soru.cevap,
            yuzdeSayi(ist.dogruOrani),
            ist.secim.A,
            ist.secim.B,
            ist.secim.C,
            ist.secim.D,
            ist.secim.bos,
            ist.secim.gecersiz,
            bicimsizYaz(ist.soru.ozet ?? ''),
          ]),
        ],
      },
      {
        ad: 'Kazanımlar',
        satirlar: [
          ['Okul no', 'Ad soyad', ...kazanimlar.map((k) => `${k} %`)],
          ...matrisSatirlari.map((r) => [
            r.ogrenci.okul_no,
            r.ogrenci.ad_soyad,
            ...kazanimlar.map((k) => (r.hucre[k].toplam ? yuzdeSayi(r.hucre[k].dogru / r.hucre[k].toplam) : null)),
          ]),
          ['', 'Sınıf', ...kazanimlar.map((k) => yuzdeSayi(sinifHucre[k].dogru / sinifHucre[k].toplam))],
        ],
      },
    ])
    setBekliyor(false)
  }

  return (
    <>
      <div className="baslik-satiri">
        <p className="soluk">
          {kagitlar.length} öğrencinin sonucuna göre
          {girilmeyen > 0 && ` · ${girilmeyen} öğrencinin sonucu girilmedi`}
        </p>
        <button className="ikincil" onClick={aktar} disabled={bekliyor}>
          {bekliyor ? 'Hazırlanıyor…' : "Excel'e aktar"}
        </button>
      </div>

      <div className="olcu-izgara">
        <Olcu ad="Ortalama" deger={`${netYaz(ort((o) => o.net))} net`} />
        <Olcu ad="Ortanca" deger={`${netYaz(medyan)} net`} />
        <Olcu ad="En yüksek" deger={`${netYaz(sirali[sirali.length - 1])} net`} />
        <Olcu ad="En düşük" deger={`${netYaz(sirali[0])} net`} />
        <Olcu
          ad="Ortalama D / Y / B"
          deger={`${netYaz(ort((o) => o.dogru))} / ${netYaz(ort((o) => o.yanlis))} / ${netYaz(ort((o) => o.bos))}`}
        />
      </div>

      <section className="bolum">
        <h2 className="bolum-basligi">Net dağılımı</h2>
        <div className="dagilim">
          {kutular.map((k) => (
            <div key={k.alt} className="dagilim-satiri">
              <span className="dagilim-etiket">
                {k.alt}–{k.alt + aralik}
              </span>
              <span className="dagilim-cubuk">
                <span style={{ width: `${enCokKutu ? (k.sayi / enCokKutu) * 100 : 0}%` }} />
              </span>
              <span className="dagilim-sayi">{k.sayi || ''}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bolum">
        <h2 className="bolum-basligi">Soru bazında sonuçlar</h2>
        <p className="soluk kucuk">Doğru şık yeşil; doğrudan daha çok seçilen yanlış şık kırmızı.</p>
        <div className="tablo-kap">
          <table className="tablo kartlasan soru-tablosu">
            <thead>
              <tr>
                <th>Soru</th>
                <th>Doğru oranı</th>
                {SECENEKLER.map((s) => (
                  <th key={s} className="sayi">
                    {s}
                  </th>
                ))}
                <th className="sayi">Boş</th>
              </tr>
            </thead>
            <tbody>
              {istatistik.map((ist) => {
                const dogruSayi = ist.secim[ist.soru.cevap as Isaret]
                return (
                  <tr key={ist.soru.sira}>
                    <td className="hucre-no" title={bicimsizYaz(ist.soru.ozet ?? '')}>
                      <strong>{ist.soru.sira}.</strong> <span className="soluk kucuk">{ist.soru.kazanim[0]}</span>
                    </td>
                    <td className="hucre-ad">
                      <span className="oran-hucre">
                        <span className="cubuk">
                          <span
                            className={`cubuk-dolu ${ist.dogruOrani >= 0.7 ? 'iyi' : ist.dogruOrani >= 0.4 ? 'orta' : 'zayif'}`}
                            style={{ width: `${ist.dogruOrani * 100}%`, display: 'block' }}
                          />
                        </span>
                        <strong>{yuzde(ist.dogruOrani)}</strong>
                      </span>
                    </td>
                    {SECENEKLER.map((s) => (
                      <td
                        key={s}
                        data-etiket={s}
                        className={`sayi ${s === ist.soru.cevap ? 'sik-dogru' : ist.secim[s] > dogruSayi ? 'sik-tehlike' : ''}`}
                      >
                        {ist.secim[s]}
                      </td>
                    ))}
                    <td className="sayi soluk" data-etiket="Boş">
                      {ist.secim.bos + ist.secim.gecersiz}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bolum">
        <h2 className="bolum-basligi">En sık yanılgılar</h2>
        {yanilgilar.length === 0 ? (
          <p className="soluk">Yanlış cevap yok.</p>
        ) : (
          <div className="yanilgi-sirasi">
            {yanilgilar.map((y) => (
              <details key={`${y.sira}-${y.sik}`} className="kart yanilgi-karti">
                <summary>
                  <span className="yanilgi-sayi">
                    {y.sayi}
                    <small>öğrenci</small>
                  </span>
                  <span className="yanilgi-govde">
                    <span className="kucuk soluk">
                      {y.sira}. soru · {y.sik} şıkkı · {y.ist.soru.kazanim[0]}
                    </span>
                    <span>{y.metin ? bicimsizYaz(y.metin) : 'Bu şık için yanılgı açıklaması yok.'}</span>
                  </span>
                </summary>
                <p className="soluk kucuk">
                  {y.ogrenciler
                    .filter(Boolean)
                    .map((o) => `${o!.okul_no} ${o!.ad_soyad}`)
                    .join(' · ')}
                </p>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="bolum">
        <h2 className="bolum-basligi">Kazanım ısı haritası</h2>
        <p className="soluk kucuk">Her hücre, öğrencinin o kazanımdaki sorulardan doğru yaptığı oran (sorular odak kazanımına göre).</p>
        <div className="tablo-kap isi-kap">
          <table className="tablo isi-haritasi">
            <thead>
              <tr>
                <th className="yapiskan">Öğrenci</th>
                <th className="sayi">Net</th>
                {kazanimlar.map((k) => (
                  <th key={k} className="sayi" title={k}>
                    {k.replace(/^M\./, '')}
                    <small> ({sinifHucre[k].toplam / matrisSatirlari.length})</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrisSatirlari.map((r) => (
                <tr key={r.ogrenci.id}>
                  <td className="yapiskan">
                    <a href={`#/karne/${r.ogrenci.id}`}>
                      <span className="soluk">{r.ogrenci.okul_no}</span> {r.ogrenci.ad_soyad}
                    </a>
                  </td>
                  <td className="sayi">{netYaz(r.net)}</td>
                  {kazanimlar.map((k) => (
                    <IsiHucresi key={k} {...r.hucre[k]} />
                  ))}
                </tr>
              ))}
              <tr className="isi-sinif">
                <td className="yapiskan">
                  <strong>Sınıf</strong>
                </td>
                <td className="sayi">
                  <strong>{netYaz(ort((o) => o.net))}</strong>
                </td>
                {kazanimlar.map((k) => (
                  <IsiHucresi key={k} {...sinifHucre[k]} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function Olcu({ ad, deger }: { ad: string; deger: string }) {
  return (
    <div className="olcu">
      <span className="soluk kucuk">{ad}</span>
      <strong>{deger}</strong>
    </div>
  )
}

function IsiHucresi({ dogru, toplam }: { dogru: number; toplam: number }) {
  if (!toplam) return <td className="sayi soluk">–</td>
  const oran = dogru / toplam
  const seviye = oran >= 0.75 ? 4 : oran >= 0.5 ? 3 : oran >= 0.25 ? 2 : 1
  return (
    <td className={`sayi isi isi-${seviye}`} title={`${dogru}/${toplam}`}>
      {Math.round(oran * 100)}
    </td>
  )
}
