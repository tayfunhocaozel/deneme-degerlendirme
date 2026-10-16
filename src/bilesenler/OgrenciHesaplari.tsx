import { useEffect, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Ogrenci, OgrenciHesabi } from '../veritabani'
import Onay from './Onay'

// Sınıf sayfasında öğrencilerin bağladığı Google hesapları.
//   * Çakışma: aynı numaraya ikinci hesap gelmiş. Doğrusunu öğretmen seçer; o zamana kadar
//     bu numaranın hiçbir hesabı sonuç göremez.
//   * Numarayı yalnızca öğretmen değiştirir (yanlış numarayla eşleşen öğrenci için).
export default function OgrenciHesaplari({ sinifKodu, ogrenciler }: { sinifKodu: string; ogrenciler: Ogrenci[] }) {
  const [hesaplar, setHesaplar] = useState<OgrenciHesabi[] | null>(null)
  const [hata, setHata] = useState('')
  const [listeAcik, setListeAcik] = useState(false)
  const idler = ogrenciler.map((o) => o.id).join(',')

  async function yukle() {
    if (!ogrenciler.length) return setHesaplar([])
    const { data, error } = await supabase
      .from('ogrenci_hesaplari')
      .select('*')
      .in('ogrenci_id', ogrenciler.map((o) => o.id))
      .order('created_at')
    if (error) return setHata(hataMetni(error))
    setHesaplar(data)
  }

  useEffect(() => {
    yukle()
  }, [idler])

  if (!hesaplar) return null

  const ogrenci = (id: number) => ogrenciler.find((o) => o.id === id)
  const gruplar = new Map<number, OgrenciHesabi[]>()
  for (const h of hesaplar) gruplar.set(h.ogrenci_id, [...(gruplar.get(h.ogrenci_id) ?? []), h])
  const cakismalar = [...gruplar.entries()].filter(([, g]) => g.some((h) => h.durum === 'bekliyor'))
  const bagli = hesaplar.filter((h) => h.durum === 'onayli' && !cakismalar.some(([id]) => id === h.ogrenci_id))
  const aktifSayisi = ogrenciler.filter((o) => o.aktif).length
  const hesapsizlar = ogrenciler.filter((o) => o.aktif && !gruplar.has(o.id))

  async function dogruHesap(secilen: OgrenciHesabi, grup: OgrenciHesabi[]) {
    setHata('')
    const digerleri = grup.filter((h) => h.id !== secilen.id).map((h) => h.id)
    const s = await supabase.from('ogrenci_hesaplari').delete().in('id', digerleri)
    if (s.error) return setHata(hataMetni(s.error))
    const g = await supabase.from('ogrenci_hesaplari').update({ durum: 'onayli' }).eq('id', secilen.id)
    if (g.error) return setHata(hataMetni(g.error))
    yukle()
  }

  async function kaldir(ids: number[]) {
    setHata('')
    const { error } = await supabase.from('ogrenci_hesaplari').delete().in('id', ids)
    if (error) return setHata(hataMetni(error))
    yukle()
  }

  async function numaraDegistir(h: OgrenciHesabi, yeniOgrenciId: number) {
    setHata('')
    const { error } = await supabase.from('ogrenci_hesaplari').update({ ogrenci_id: yeniOgrenciId }).eq('id', h.id)
    if (error) return setHata(hataMetni(error))
    yukle()
  }

  return (
    <section className="bolum">
      <h2 className="bolum-basligi">Öğrenci girişi</h2>
      <div className="kart">
        <p>
          Sınıf kodu: <strong className="sinif-kodu">{sinifKodu}</strong>
        </p>
        <p className="soluk kucuk">
          Öğrenciler Google ile girip bu kodu ve okul numaralarını bir kez yazar. {bagli.length} / {aktifSayisi} öğrenci
          hesabını bağladı.
        </p>
        {hata && <p className="hata">{hata}</p>}

        {cakismalar.map(([ogrenciId, grup]) => {
          const o = ogrenci(ogrenciId)
          return (
            <div key={ogrenciId} className="uyari cakisma">
              <p>
                <strong>
                  {o?.okul_no} {o?.ad_soyad}
                </strong>{' '}
                numarasıyla {grup.length} hesap eşleşmek istedi. Doğru hesabı seçin; seçene kadar bu öğrenci sonuçlarını
                göremez.
              </p>
              <ul className="cakisma-listesi">
                {grup.map((h) => (
                  <li key={h.id}>
                    <span>
                      <strong>{h.google_ad || '(adsız)'}</strong> <span className="soluk">{h.eposta}</span>{' '}
                      <span className="soluk kucuk">
                        · {new Date(h.created_at).toLocaleDateString('tr-TR')}
                        {h.durum === 'onayli' ? ' · ilk eşleşen' : ''}
                      </span>
                    </span>
                    <button className="kucuk-dugme" onClick={() => dogruHesap(h, grup)}>
                      Doğru hesap bu
                    </button>
                  </li>
                ))}
              </ul>
              <Onay etiket="Hiçbiri değil" soru="Bu numaradaki bütün hesap bağlantıları kaldırılsın mı?" evet={() => kaldir(grup.map((h) => h.id))} />
            </div>
          )
        })}

        {bagli.length > 0 && (
          <button className="bag" onClick={() => setListeAcik(!listeAcik)}>
            {listeAcik ? '▾' : '▸'} Bağlı hesaplar ({bagli.length})
          </button>
        )}
        {listeAcik && (
          <div className="tablo-kap">
            <table className="tablo kartlasan">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Ad soyad</th>
                  <th>Google hesabı</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bagli.map((h) => {
                  const o = ogrenci(h.ogrenci_id)
                  return (
                    <tr key={h.id}>
                      <td className="hucre-no">{o?.okul_no}</td>
                      <td className="hucre-ad">{o?.ad_soyad}</td>
                      <td data-etiket="Google">
                        {h.google_ad} <span className="soluk kucuk">{h.eposta}</span>
                      </td>
                      <td className="islemler">
                        {hesapsizlar.length > 0 && (
                          <select
                            className="kucuk-secim"
                            value=""
                            onChange={(e) => e.target.value && numaraDegistir(h, Number(e.target.value))}
                            aria-label="Numarayı değiştir"
                          >
                            <option value="">Numarayı değiştir…</option>
                            {hesapsizlar.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.okul_no} {x.ad_soyad}
                              </option>
                            ))}
                          </select>
                        )}
                        <Onay
                          etiket="Kaldır"
                          soru="Bağlantı kaldırılır; öğrenci yeniden kod ve numara girerek eşleşebilir."
                          evet={() => kaldir([h.id])}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
