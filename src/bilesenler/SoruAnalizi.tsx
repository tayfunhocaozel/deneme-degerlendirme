import { useEffect, useMemo, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Deneme, DenemeSorusu, Isaret, Sinif } from '../veritabani'
import {
  ayirtYorumu,
  celdiriciDurumlari,
  gozlenenGucluk,
  guclukUyumu,
  ISLEVSIZ_ESIK,
  soruIstatistikleri,
  ustAltGruplar,
  type Kagit,
} from '../analiz'
import { bicimsizYaz, yuzde } from '../puan'
import { exceleAktar, yuzdeSayi } from '../disaAktar'

const UYUM_METNI = {
  uyumlu: 'Etiketle uyumlu',
  'daha-kolay': 'Etiketten kolay',
  'daha-zor': 'Etiketten zor',
  etiketsiz: 'Etiket yok',
} as const

const KUCUK_ORNEKLEM = 20

// Soru üretimine geri bildirim: gözlenen güçlük, ayırt edicilik, çeldiricilerin işleyişi.
export default function SoruAnalizi({
  deneme,
  sinif,
  sorular,
  sinifKagitlari,
}: {
  deneme: Deneme
  sinif: Sinif
  sorular: DenemeSorusu[]
  sinifKagitlari: Kagit[]
}) {
  const [kapsam, setKapsam] = useState<'sinif' | 'hepsi'>('sinif')
  const [tumu, setTumu] = useState<{ kagitlar: Kagit[]; sinifSayisi: number } | null>(null)
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  // "Tüm sınıflarım": bu denemenin öğretmenin bütün sınıflarındaki sonuçları.
  useEffect(() => {
    if (kapsam !== 'hepsi' || tumu) return
    ;(async () => {
      const u = await supabase.from('uygulamalar').select('id, sinif_id').eq('deneme_id', deneme.id)
      if (u.error) return setHata(hataMetni(u.error))
      const s = await supabase.from('sonuclar').select('id, ogrenci_id').in('uygulama_id', u.data.map((x) => x.id))
      if (s.error) return setHata(hataMetni(s.error))
      const c = s.data.length
        ? await supabase.from('cevaplar').select('*').in('sonuc_id', s.data.map((x) => x.id))
        : { data: [], error: null }
      if (c.error) return setHata(hataMetni(c.error))
      const harita = new Map<number, Isaret[]>()
      for (const cevap of c.data) {
        const dizi = harita.get(cevap.sonuc_id) ?? []
        dizi[cevap.sira - 1] = cevap.isaretlenen
        harita.set(cevap.sonuc_id, dizi)
      }
      setTumu({
        kagitlar: s.data.map((x) => ({ ogrenciId: x.ogrenci_id, isaretler: harita.get(x.id) ?? [] })),
        sinifSayisi: new Set(u.data.map((x) => x.sinif_id)).size,
      })
    })()
  }, [kapsam, tumu, deneme.id])

  const kagitlar = kapsam === 'sinif' ? sinifKagitlari : (tumu?.kagitlar ?? null)

  const analiz = useMemo(() => {
    if (!kagitlar || kagitlar.length === 0) return null
    const istatistik = soruIstatistikleri(kagitlar, sorular)
    const { ust, alt } = ustAltGruplar(kagitlar, sorular.map((s) => s.cevap))
    return istatistik.map((ist) => {
      const celdiriciler = celdiriciDurumlari(ist, ust.length, alt.length)
      const uyum = guclukUyumu(ist.soru.gucluk, ist.dogruOrani)
      const ayirt = ayirtYorumu(ist.ayirt)
      const sorunlar = [
        uyum === 'daha-kolay' || uyum === 'daha-zor' ? UYUM_METNI[uyum] : null,
        ayirt.sinif !== 'iyi' ? `Ayırt edicilik ${ayirt.metin.toLocaleLowerCase('tr-TR')}` : null,
        ...celdiriciler.filter((c) => c.islevsiz).map((c) => `${c.sik} şıkkı işlevsiz`),
        ...celdiriciler.filter((c) => c.ters).map((c) => `${c.sik} şıkkını iyi öğrenciler daha çok seçti`),
      ].filter((x): x is string => !!x)
      return { ist, celdiriciler, uyum, ayirt, sorunlar }
    })
  }, [kagitlar, sorular])

  async function aktar() {
    if (!analiz || !kagitlar) return
    setBekliyor(true)
    await exceleAktar(`${deneme.deneme_kodu} soru analizi.xlsx`, [
      {
        ad: 'Soru analizi',
        satirlar: [
          [
            'Deneme', 'Sıra', 'Soru', 'Kazanım', 'Bloom', 'Güçlük etiketi', 'Doğru %', 'Gözlenen güçlük', 'Uyum',
            'Ayırt edicilik', 'Yorum', 'A %', 'B %', 'C %', 'D %', 'Boş %', 'İşlevsiz çeldirici',
            'Ters çalışan çeldirici', 'Öğrenci sayısı', 'Özet',
          ],
          ...analiz.map(({ ist, celdiriciler, uyum, ayirt }) => [
            deneme.deneme_kodu,
            ist.soru.sira,
            ist.soru.soru_id,
            ist.soru.kazanim.join(', '),
            ist.soru.bloom,
            ist.soru.gucluk,
            yuzdeSayi(ist.dogruOrani),
            gozlenenGucluk(ist.dogruOrani),
            UYUM_METNI[uyum],
            Math.round(ist.ayirt * 100) / 100,
            ayirt.metin,
            ...(['A', 'B', 'C', 'D'] as const).map((s) => yuzdeSayi(ist.secim[s] / ist.n)),
            yuzdeSayi((ist.secim.bos + ist.secim.gecersiz) / ist.n),
            celdiriciler.filter((c) => c.islevsiz).map((c) => c.sik).join(', '),
            celdiriciler.filter((c) => c.ters).map((c) => c.sik).join(', '),
            ist.n,
            bicimsizYaz(ist.soru.ozet ?? ''),
          ]),
        ],
      },
    ])
    setBekliyor(false)
  }

  const sorunlular = analiz?.filter((a) => a.sorunlar.length > 0) ?? []

  return (
    <>
      <div className="baslik-satiri">
        <div className="secim-dugmeleri" role="radiogroup">
          <button className={kapsam === 'sinif' ? 'secili' : ''} onClick={() => setKapsam('sinif')}>
            Yalnızca {sinif.ad}
          </button>
          <button className={kapsam === 'hepsi' ? 'secili' : ''} onClick={() => setKapsam('hepsi')}>
            Tüm sınıflarım
          </button>
        </div>
        <button className="ikincil" onClick={aktar} disabled={bekliyor || !analiz}>
          {bekliyor ? 'Hazırlanıyor…' : "Excel'e aktar"}
        </button>
      </div>

      {hata && <p className="hata">{hata}</p>}
      {kagitlar === null ? (
        <p className="soluk">Yükleniyor…</p>
      ) : !analiz ? (
        <div className="kart bos-durum">
          <p>Analiz için önce cevapları girin.</p>
        </div>
      ) : (
        <>
          <p className="soluk">
            {kagitlar.length} öğrencinin sonucuna göre
            {kapsam === 'hepsi' && tumu && ` · ${tumu.sinifSayisi} sınıf`}
          </p>
          {kagitlar.length < KUCUK_ORNEKLEM && (
            <p className="uyari">
              Öğrenci sayısı az ({kagitlar.length}). Güçlük ve ayırt edicilik değerleri yaklaşık; birkaç sınıfın sonucu
              girildikçe güvenilir hâle gelir.
            </p>
          )}

          <div className="olcu-izgara">
            <div className="olcu">
              <span className="soluk kucuk">Ortalama doğru oranı</span>
              <strong>{yuzde(analiz.reduce((t, a) => t + a.ist.dogruOrani, 0) / analiz.length)}</strong>
            </div>
            <div className="olcu">
              <span className="soluk kucuk">Ortalama ayırt edicilik</span>
              <strong>
                {(analiz.reduce((t, a) => t + a.ist.ayirt, 0) / analiz.length).toLocaleString('tr-TR', {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div className="olcu">
              <span className="soluk kucuk">Etiketiyle uyumlu</span>
              <strong>
                {analiz.filter((a) => a.uyum === 'uyumlu').length} / {analiz.length} soru
              </strong>
            </div>
            <div className="olcu">
              <span className="soluk kucuk">Gözden geçirilecek</span>
              <strong>{sorunlular.length} soru</strong>
            </div>
          </div>

          {sorunlular.length > 0 && (
            <section className="bolum">
              <h2 className="bolum-basligi">Gözden geçirilecek sorular</h2>
              <div className="liste">
                {sorunlular.map(({ ist, sorunlar }) => (
                  <div key={ist.soru.sira} className="liste-satiri sorun-satiri">
                    <span className="liste-ana">
                      <strong>
                        {ist.soru.sira}. soru <span className="soluk kucuk">({ist.soru.soru_id})</span>
                      </strong>
                      {ist.soru.ozet && <span className="soluk kucuk">{bicimsizYaz(ist.soru.ozet)}</span>}
                    </span>
                    <span className="sorun-etiketleri">
                      {sorunlar.map((s) => (
                        <span key={s} className="etiket etiket-tekrar">
                          {s}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bolum">
            <h2 className="bolum-basligi">Tüm sorular</h2>
            <div className="tablo-kap">
              <table className="tablo kartlasan analiz-tablosu">
                <thead>
                  <tr>
                    <th>Soru</th>
                    <th>Güçlük (etiket → gözlenen)</th>
                    <th>Ayırt edicilik</th>
                    <th>Çeldiriciler (seçilme oranı)</th>
                  </tr>
                </thead>
                <tbody>
                  {analiz.map(({ ist, celdiriciler, uyum, ayirt }) => (
                    <tr key={ist.soru.sira}>
                      <td className="hucre-tam" title={bicimsizYaz(ist.soru.ozet ?? '')}>
                        <strong>{ist.soru.sira}.</strong>{' '}
                        <span className="soluk kucuk">
                          {ist.soru.soru_id} · {ist.soru.kazanim[0]} · {ist.soru.bloom}
                        </span>
                      </td>
                      <td>
                        <span className="kucuk">
                          {ist.soru.gucluk ?? '—'} → <strong>{yuzde(ist.dogruOrani)}</strong> ({gozlenenGucluk(ist.dogruOrani)})
                        </span>{' '}
                        <span className={`etiket ${uyum === 'uyumlu' ? 'etiket-yeni' : uyum === 'etiketsiz' ? 'etiket-var' : 'etiket-uyari'}`}>
                          {UYUM_METNI[uyum]}
                        </span>
                      </td>
                      <td>
                        <span className="kucuk">
                          <strong>{ist.ayirt.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</strong>{' '}
                        </span>
                        <span className={`etiket etiket-${ayirt.sinif === 'iyi' ? 'yeni' : ayirt.sinif === 'orta' ? 'uyari' : 'tekrar'}`}>
                          {ayirt.metin}
                        </span>
                      </td>
                      <td>
                        <span className="celdirici-cipleri">
                          {celdiriciler.map((c) => (
                            <span
                              key={c.sik}
                              className={`cip ${c.islevsiz ? 'cip-islevsiz' : ''} ${c.ters ? 'cip-ters' : ''}`}
                              title={(ist.soru.celdiriciler as Record<string, string>)[c.sik] ?? ''}
                            >
                              {c.sik} {yuzde(c.oran)}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="kart aciklama-kutusu">
            <summary>Bu değerler nasıl hesaplanıyor?</summary>
            <ul>
              <li>
                <strong>Gözlenen güçlük:</strong> soruyu doğru yapan öğrencilerin oranı. %70 ve üstü kolay, %40–70 orta,
                %40 altı zor sayılır ve bankadaki etiketle karşılaştırılır.
              </li>
              <li>
                <strong>Ayırt edicilik:</strong> öğrenciler netlerine göre sıralanır; en yüksek %27 ile en düşük %27'nin
                doğru oranları arasındaki fark. 0,40 ve üstü çok iyi, 0,30–0,39 iyi, 0,20–0,29 gözden geçirilmeli, 0,20
                altı zayıf.
              </li>
              <li>
                <strong>İşlevsiz çeldirici</strong> (üstü çizili): öğrencilerin %{ISLEVSIZ_ESIK * 100}'inden azının
                seçtiği yanlış şık. Öğrenciyi çekmediği için yanılgıyı ölçmüyor.
              </li>
              <li>
                <strong>Ters çalışan çeldirici</strong> (kırmızı): iyi öğrencilerin zayıflardan daha çok seçtiği yanlış
                şık. Soruda belirsizlik ya da cevap anahtarında hata olabilir.
              </li>
            </ul>
          </details>
        </>
      )}
    </>
  )
}
