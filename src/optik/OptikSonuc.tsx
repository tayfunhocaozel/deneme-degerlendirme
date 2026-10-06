import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Ogrenci } from '../veritabani'
import { bicimsizYaz, netYaz, ozetle } from '../puan'
import type { KayitBilgisi } from './OptikOnay.tsx'

// Kaydedildi ekranı: puan, yanlışlardaki yanılgılar, kazanım bazında doğru sayısı, okutulmayanlar.
export default function OptikSonuc({ kayit, sonraki }: { kayit: KayitBilgisi; sonraki: () => void }) {
  const { deneme, sorular, ogrenci, sinif, uygulamaId, isaretler } = kayit
  const ozet = ozetle(
    isaretler,
    sorular.map((s) => s.cevap),
  )
  const [okutulmayanlar, setOkutulmayanlar] = useState<Ogrenci[] | null>(null)
  const [listeAcik, setListeAcik] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [o, s] = await Promise.all([
        supabase.from('ogrenciler').select('*').eq('sinif_id', sinif.id).eq('aktif', true),
        supabase.from('sonuclar').select('ogrenci_id').eq('uygulama_id', uygulamaId),
      ])
      if (o.error || s.error) return
      const girilen = new Set(s.data.map((x) => x.ogrenci_id))
      setOkutulmayanlar(
        o.data.filter((x) => !girilen.has(x.id)).sort((a, b) => a.okul_no.localeCompare(b.okul_no, 'tr', { numeric: true })),
      )
    })()
  }, [sinif.id, uygulamaId])

  const yanlislar = sorular
    .map((s, i) => ({ s, isaret: isaretler[i] }))
    .filter(({ s, isaret }) => isaret !== 'bos' && isaret !== s.cevap)

  const kazanimlar = new Map<string, { dogru: number; toplam: number }>()
  sorular.forEach((s, i) => {
    const k = s.kazanim[0] ?? '—'
    const v = kazanimlar.get(k) ?? { dogru: 0, toplam: 0 }
    v.toplam++
    if (isaretler[i] === s.cevap) v.dogru++
    kazanimlar.set(k, v)
  })

  return (
    <div className="optik-sonuc">
      <div className="kart sonuc-ust">
        <span className="basari kucuk">Kaydedildi</span>
        <h2>{ogrenci.ad_soyad}</h2>
        <p className="soluk">
          {sinif.ad} · {ogrenci.okul_no} · {deneme.deneme_kodu}
        </p>
        <div className="ozet-kutulari">
          <span className="ozet-kutu dogru">{ozet.dogru} D</span>
          <span className="ozet-kutu yanlis">{ozet.yanlis} Y</span>
          <span className="ozet-kutu bos">{ozet.bos} B</span>
          <span className="ozet-kutu net">{netYaz(ozet.net)} net</span>
        </div>
      </div>

      <div className="dugmeler optik-kaydet">
        <button onClick={sonraki}>Sonraki form →</button>
        <a className="dugme-gibi ikincil-bag" href={`#/uygulama/${uygulamaId}`}>
          Deneme sayfası
        </a>
      </div>

      {okutulmayanlar && (
        <div className="kart">
          <button className="bag" onClick={() => setListeAcik(!listeAcik)}>
            {listeAcik ? '▾' : '▸'} {sinif.ad}: okutulmayan {okutulmayanlar.length} öğrenci
          </button>
          {listeAcik && (
            <p className="soluk kucuk okutulmayanlar">
              {okutulmayanlar.length ? okutulmayanlar.map((o) => `${o.okul_no} ${o.ad_soyad}`).join(' · ') : 'Hepsi okutuldu.'}
            </p>
          )}
        </div>
      )}

      <section className="bolum">
        <h3>Kazanımlara göre</h3>
        <div className="kazanim-cipleri">
          {[...kazanimlar.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'tr', { numeric: true }))
            .map(([k, v]) => (
              <span key={k} className="cip">
                {k}: <strong>{v.dogru}</strong>/{v.toplam}
              </span>
            ))}
        </div>
      </section>

      <section className="bolum">
        <h3>Yanlış yaptığı sorular ({yanlislar.length})</h3>
        {yanlislar.length === 0 ? (
          <p className="soluk">Yanlışı yok.</p>
        ) : (
          <ul className="yanilgi-listesi kart">
            {yanlislar.map(({ s, isaret }) => {
              const secenekler = (s.secenekler ?? {}) as Record<string, string>
              const yanilgi = (s.celdiriciler as Record<string, string>)[isaret]
              return (
                <li key={s.sira}>
                  <div className="yanilgi-ust">
                    <span className="etiket etiket-var">{s.sira}. soru</span>
                    <span className="kucuk">
                      Seçtiği: <strong>{isaret === 'gecersiz' ? 'çift işaret' : isaret}</strong>
                      {secenekler[isaret] && ` (${bicimsizYaz(secenekler[isaret])})`} · Doğru: <strong>{s.cevap}</strong>
                      {secenekler[s.cevap] && ` (${bicimsizYaz(secenekler[s.cevap])})`}
                    </span>
                  </div>
                  {yanilgi && <p className="yanilgi-metni">{bicimsizYaz(yanilgi)}</p>}
                  {s.ozet && <p className="soluk kucuk">Soru: {bicimsizYaz(s.ozet)}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
