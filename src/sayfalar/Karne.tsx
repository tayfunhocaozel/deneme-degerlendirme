import { useEffect, useMemo, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Database, Deneme, DenemeSorusu, Ogrenci, Sinif, Uygulama } from '../veritabani'
import { bicimsizYaz, netYaz, yuzde } from '../puan'
import { tarihYaz } from '../bilesenler/SinifDenemeleri'
import GelisimGrafigi from '../bilesenler/GelisimGrafigi'

type Satir = Database['public']['Views']['cevap_degerlendirme']['Row']

type Veri = {
  ogrenci: Ogrenci
  sinif: Sinif
  uygulamalar: Uygulama[] // öğrencinin sonucu olanlar, tarihe göre
  denemeler: Map<number, Deneme>
  sorular: Map<string, DenemeSorusu> // "denemeId-sira"
  kazanimlar: Map<string, string>
  satirlar: Satir[] // sınıfın tüm cevapları (bu uygulamalarda)
}

const dogruMu = (s: Satir) => s.dogru_mu === true
const odakKazanim = (s: Satir) => s.kazanim[0] ?? '—'
const BLOOM_SIRASI = ['Hatırla', 'Anla', 'Uygula', 'Analiz', 'Değerlendir', 'Yarat']
const GUCLUK_SIRASI = ['kolay', 'orta', 'zor']

function net(satirlar: Satir[]): number {
  const d = satirlar.filter(dogruMu).length
  const y = satirlar.filter((s) => s.isaretlenen !== 'bos' && !dogruMu(s)).length
  return d - y / 3
}

// Satırları bir anahtara göre gruplayıp öğrencinin ve sınıfın doğru oranını verir.
function basariTablosu(ogr: Satir[], sinif: Satir[], anahtar: (s: Satir) => string | null) {
  const gruplar = new Map<string, { ogr: Satir[]; sinif: Satir[] }>()
  for (const s of sinif) {
    const k = anahtar(s)
    if (!k) continue
    if (!gruplar.has(k)) gruplar.set(k, { ogr: [], sinif: [] })
    gruplar.get(k)!.sinif.push(s)
  }
  for (const s of ogr) {
    const k = anahtar(s)
    if (k) gruplar.get(k)?.ogr.push(s)
  }
  return [...gruplar.entries()]
    .filter(([, g]) => g.ogr.length > 0)
    .map(([ad, g]) => ({
      ad,
      soru: g.ogr.length,
      dogru: g.ogr.filter(dogruMu).length,
      oran: g.ogr.filter(dogruMu).length / g.ogr.length,
      sinifOran: g.sinif.filter(dogruMu).length / g.sinif.length,
    }))
}

export default function Karne({ id }: { id: number }) {
  const [veri, setVeri] = useState<Veri | null | undefined>(undefined)
  const [hata, setHata] = useState('')
  const [secim, setSecim] = useState<number | 'hepsi'>('hepsi') // uygulama_id

  useEffect(() => {
    ;(async () => {
      const o = await supabase.from('ogrenciler').select('*').eq('id', id).maybeSingle()
      if (o.error) return setHata(hataMetni(o.error))
      if (!o.data) return setVeri(null)
      const [s, u, k] = await Promise.all([
        supabase.from('siniflar').select('*').eq('id', o.data.sinif_id).single(),
        supabase.from('uygulamalar').select('*').eq('sinif_id', o.data.sinif_id).order('tarih'),
        supabase.from('kazanimlar').select('*'),
      ])
      if (s.error || u.error || k.error) return setHata(hataMetni(s.error ?? u.error ?? k.error))
      const tumIdler = u.data.map((x) => x.id)
      const c = tumIdler.length
        ? await supabase.from('cevap_degerlendirme').select('*').in('uygulama_id', tumIdler)
        : { data: [] as Satir[], error: null }
      if (c.error) return setHata(hataMetni(c.error))
      const ogrUygulamalar = new Set(c.data.filter((x) => x.ogrenci_id === id).map((x) => x.uygulama_id))
      const uygulamalar = u.data.filter((x) => ogrUygulamalar.has(x.id))
      const denemeIdleri = [...new Set(uygulamalar.map((x) => x.deneme_id))]
      const [d, ds] = denemeIdleri.length
        ? await Promise.all([
            supabase.from('denemeler').select('*').in('id', denemeIdleri),
            supabase.from('deneme_sorulari').select('*').in('deneme_id', denemeIdleri),
          ])
        : [{ data: [] as Deneme[], error: null }, { data: [] as DenemeSorusu[], error: null }]
      if (d.error || ds.error) return setHata(hataMetni(d.error ?? ds.error))
      setVeri({
        ogrenci: o.data,
        sinif: s.data,
        uygulamalar,
        denemeler: new Map(d.data.map((x) => [x.id, x])),
        sorular: new Map(ds.data.map((x) => [`${x.deneme_id}-${x.sira}`, x])),
        kazanimlar: new Map(k.data.map((x) => [x.kod, x.aciklama])),
        satirlar: c.data.filter((x) => ogrUygulamalar.has(x.uygulama_id)),
      })
    })()
  }, [id])

  const hesap = useMemo(() => {
    if (!veri) return null
    const kapsam = veri.satirlar.filter((s) => secim === 'hepsi' || s.uygulama_id === secim)
    const ogr = kapsam.filter((s) => s.ogrenci_id === id)
    return {
      ogr,
      kazanim: basariTablosu(ogr, kapsam, odakKazanim).sort((a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true })),
      bloom: basariTablosu(ogr, kapsam, (s) => s.bloom).sort(
        (a, b) => BLOOM_SIRASI.indexOf(a.ad) - BLOOM_SIRASI.indexOf(b.ad),
      ),
      gucluk: basariTablosu(ogr, kapsam, (s) => s.gucluk).sort(
        (a, b) => GUCLUK_SIRASI.indexOf(a.ad) - GUCLUK_SIRASI.indexOf(b.ad),
      ),
    }
  }, [veri, secim, id])

  if (hata && veri === undefined) return <p className="hata">{hata}</p>
  if (veri === undefined || !hesap) return <p className="soluk">Yükleniyor…</p>
  if (veri === null)
    return (
      <div className="kart bos-durum">
        <p>Öğrenci bulunamadı.</p>
        <a href="#/">Sınıflarıma dön</a>
      </div>
    )

  const { ogrenci, sinif, uygulamalar, denemeler, sorular, kazanimlar, satirlar } = veri

  // Deneme bazında sonuçlar (gelişim tablosu ve grafiği her zaman tüm denemeleri gösterir).
  const denemeSonuclari = uygulamalar.map((u) => {
    const tumu = satirlar.filter((s) => s.uygulama_id === u.id)
    const ogr = tumu.filter((s) => s.ogrenci_id === id)
    const ogrenciler = new Set(tumu.map((s) => s.ogrenci_id))
    const sinifNetleri = [...ogrenciler].map((oid) => net(tumu.filter((s) => s.ogrenci_id === oid)))
    const sinifNet = sinifNetleri.reduce((t, n) => t + n, 0) / sinifNetleri.length
    const ogrNet = net(ogr)
    return {
      uygulama: u,
      deneme: denemeler.get(u.deneme_id),
      dogru: ogr.filter(dogruMu).length,
      yanlis: ogr.filter((s) => s.isaretlenen !== 'bos' && !dogruMu(s)).length,
      bos: ogr.filter((s) => s.isaretlenen === 'bos').length,
      net: ogrNet,
      sinifNet,
      sira: sinifNetleri.filter((n) => n > ogrNet).length + 1,
      kisi: ogrenciler.size,
    }
  })

  // Yanılgılar: odak kazanıma göre gruplanır.
  const yanlislar = hesap.ogr
    .filter((s) => s.isaretlenen !== 'bos' && !dogruMu(s))
    .sort((a, b) => a.uygulama_id - b.uygulama_id || a.sira - b.sira)
  const yanilgiGruplari = new Map<string, Satir[]>()
  for (const s of yanlislar) {
    const k = odakKazanim(s)
    yanilgiGruplari.set(k, [...(yanilgiGruplari.get(k) ?? []), s])
  }
  const boslar = hesap.ogr.filter((s) => s.isaretlenen === 'bos')
  const cokluDeneme = uygulamalar.length > 1
  const denemeAdi = (uygulamaId: number) => {
    const u = uygulamalar.find((x) => x.id === uygulamaId)
    return u ? (denemeler.get(u.deneme_id)?.deneme_kodu ?? '') : ''
  }

  return (
    <>
      <a href={`#/sinif/${sinif.id}`} className="geri-bag">
        ← {sinif.ad}
      </a>
      <div className="baslik-satiri">
        <div>
          <h1>{ogrenci.ad_soyad}</h1>
          <p className="soluk">
            {ogrenci.okul_no} · {sinif.ad} · {uygulamalar.length} deneme
          </p>
        </div>
        <button className="ikincil yazdir-gizle" onClick={() => window.print()}>
          Yazdır
        </button>
      </div>

      {uygulamalar.length === 0 ? (
        <div className="kart bos-durum">
          <p>Bu öğrencinin henüz girilmiş bir deneme sonucu yok.</p>
        </div>
      ) : (
        <>
          <section className="bolum">
            <h2 className="bolum-basligi">Deneme sonuçları</h2>
            <div className="tablo-kap">
              <table className="tablo">
                <thead>
                  <tr>
                    <th>Deneme</th>
                    <th className="sayi">D</th>
                    <th className="sayi">Y</th>
                    <th className="sayi">B</th>
                    <th className="sayi">Net</th>
                    <th className="sayi">Sınıf ort.</th>
                    <th className="sayi">Sıra</th>
                  </tr>
                </thead>
                <tbody>
                  {denemeSonuclari.map((d) => (
                    <tr key={d.uygulama.id}>
                      <td>
                        <a href={`#/uygulama/${d.uygulama.id}`}>{d.deneme?.deneme_kodu}</a>
                        <span className="soluk kucuk"> · {tarihYaz(d.uygulama.tarih)}</span>
                      </td>
                      <td className="sayi">{d.dogru}</td>
                      <td className="sayi">{d.yanlis}</td>
                      <td className="sayi">{d.bos}</td>
                      <td className="sayi">
                        <strong>{netYaz(d.net)}</strong>
                      </td>
                      <td className="sayi soluk">{netYaz(d.sinifNet)}</td>
                      <td className="sayi soluk">
                        {d.sira}/{d.kisi}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cokluDeneme ? (
              <GelisimGrafigi
                noktalar={denemeSonuclari.map((d) => ({
                  etiket: d.deneme?.deneme_kodu ?? '',
                  ogrenci: d.net,
                  sinif: d.sinifNet,
                  en: d.deneme?.soru_sayisi ?? 20,
                }))}
              />
            ) : (
              <p className="soluk kucuk">Gelişim grafiği ikinci deneme girilince görünecek.</p>
            )}
          </section>

          {cokluDeneme && (
            <label className="kapsam-secimi yazdir-gizle">
              Aşağıdaki analizler için
              <select
                value={secim}
                onChange={(e) => setSecim(e.target.value === 'hepsi' ? 'hepsi' : Number(e.target.value))}
              >
                <option value="hepsi">Tüm denemeler</option>
                {uygulamalar.map((u) => (
                  <option key={u.id} value={u.id}>
                    {denemeler.get(u.deneme_id)?.deneme_kodu} · {tarihYaz(u.tarih)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <section className="bolum">
            <h2 className="bolum-basligi">Kazanımlara göre başarı</h2>
            <p className="soluk kucuk">Her soru odak kazanımına (ilk kazanım kodu) göre sayılır.</p>
            <BasariListesi
              satirlar={hesap.kazanim.map((k) => ({ ...k, aciklama: kazanimlar.get(k.ad) }))}
            />
          </section>

          <div className="iki-sutun">
            <section className="bolum">
              <h2 className="bolum-basligi">Bloom basamağına göre</h2>
              <BasariListesi satirlar={hesap.bloom} />
            </section>
            <section className="bolum">
              <h2 className="bolum-basligi">Güçlüğe göre</h2>
              <BasariListesi satirlar={hesap.gucluk.map((g) => ({ ...g, ad: g.ad[0].toLocaleUpperCase('tr-TR') + g.ad.slice(1) }))} />
            </section>
          </div>

          <section className="bolum">
            <h2 className="bolum-basligi">Düştüğü yanılgılar ({yanlislar.length})</h2>
            {yanlislar.length === 0 ? (
              <p className="soluk">Yanlış cevabı yok.</p>
            ) : (
              [...yanilgiGruplari.entries()]
                .sort((a, b) => b[1].length - a[1].length)
                .map(([kod, liste]) => (
                  <div key={kod} className="kart yanilgi-grubu">
                    <h3>
                      {kod} <span className="soluk">· {liste.length} yanlış</span>
                    </h3>
                    {kazanimlar.get(kod) && <p className="soluk kucuk">{kazanimlar.get(kod)}</p>}
                    <ul className="yanilgi-listesi">
                      {liste.map((s) => {
                        const soru = sorular.get(`${s.deneme_id}-${s.sira}`)
                        const secenekler = (soru?.secenekler ?? {}) as Record<string, string>
                        return (
                          <li key={`${s.uygulama_id}-${s.sira}`}>
                            <div className="yanilgi-ust">
                              <span className="etiket etiket-var">
                                {cokluDeneme && `${denemeAdi(s.uygulama_id)} · `}
                                {s.sira}. soru
                              </span>
                              <span className="kucuk">
                                Seçtiği: <strong>{s.isaretlenen === 'gecersiz' ? 'çift işaret' : s.isaretlenen}</strong>
                                {secenekler[s.isaretlenen] && ` (${bicimsizYaz(secenekler[s.isaretlenen])})`} · Doğru:{' '}
                                <strong>{s.dogru_cevap}</strong>
                                {secenekler[s.dogru_cevap] && ` (${bicimsizYaz(secenekler[s.dogru_cevap])})`}
                              </span>
                            </div>
                            {s.yanilgi && <p className="yanilgi-metni">{bicimsizYaz(s.yanilgi)}</p>}
                            {soru?.ozet && <p className="soluk kucuk">Soru: {bicimsizYaz(soru.ozet)}</p>}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
            )}
            {boslar.length > 0 && (
              <p className="soluk">
                Boş bıraktığı sorular:{' '}
                {boslar.map((s) => `${cokluDeneme ? denemeAdi(s.uygulama_id) + ' ' : ''}${s.sira}`).join(', ')}
              </p>
            )}
          </section>
        </>
      )}
    </>
  )
}

function BasariListesi({
  satirlar,
}: {
  satirlar: { ad: string; soru: number; dogru: number; oran: number; sinifOran: number; aciklama?: string }[]
}) {
  if (satirlar.length === 0) return <p className="soluk">Veri yok.</p>
  return (
    <div className="basari-listesi">
      {satirlar.map((s) => (
        <div key={s.ad} className="basari-satiri" title={s.aciklama}>
          <div className="basari-ust">
            <span>
              <strong>{s.ad}</strong>
              {s.aciklama && <span className="soluk kucuk basari-aciklama"> {s.aciklama}</span>}
            </span>
            <span className="kucuk">
              <strong>{yuzde(s.oran)}</strong>{' '}
              <span className="soluk">
                ({s.dogru}/{s.soru}) · sınıf {yuzde(s.sinifOran)}
              </span>
            </span>
          </div>
          <div className="cubuk">
            <div
              className={`cubuk-dolu ${s.oran >= 0.7 ? 'iyi' : s.oran >= 0.4 ? 'orta' : 'zayif'}`}
              style={{ width: `${s.oran * 100}%` }}
            />
            <div className="cubuk-sinif" style={{ left: `${s.sinifOran * 100}%` }} title="Sınıf ortalaması" />
          </div>
        </div>
      ))}
    </div>
  )
}
