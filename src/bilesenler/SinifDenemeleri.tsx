import { useEffect, useState, type FormEvent } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Deneme, Uygulama } from '../veritabani'
import { git } from '../yonlendirme'

export function tarihYaz(tarih: string): string {
  return new Date(tarih + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function bugun(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Sınıf sayfasındaki "Denemeler" bölümü: bu sınıfta uygulanan denemeler ve yeni deneme ekleme.
export default function SinifDenemeleri({
  sinifId,
  sinifDuzeyi,
  ogrenciSayisi,
}: {
  sinifId: number
  sinifDuzeyi: number
  ogrenciSayisi: number
}) {
  const [uygulamalar, setUygulamalar] = useState<Uygulama[] | null>(null)
  const [denemeler, setDenemeler] = useState<Deneme[]>([])
  const [girilen, setGirilen] = useState<Record<number, number>>({})
  const [hata, setHata] = useState('')
  const [formAcik, setFormAcik] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [u, d] = await Promise.all([
        supabase.from('uygulamalar').select('*').eq('sinif_id', sinifId).order('tarih', { ascending: false }),
        supabase.from('denemeler').select('*').order('deneme_kodu').order('surum', { ascending: false }),
      ])
      if (u.error || d.error) return setHata(hataMetni(u.error ?? d.error))
      setDenemeler(d.data)
      setUygulamalar(u.data)
      if (u.data.length) {
        const s = await supabase.from('sonuclar').select('uygulama_id').in('uygulama_id', u.data.map((x) => x.id))
        if (s.error) return setHata(hataMetni(s.error))
        const sayac: Record<number, number> = {}
        for (const { uygulama_id } of s.data) sayac[uygulama_id] = (sayac[uygulama_id] ?? 0) + 1
        setGirilen(sayac)
      }
    })()
  }, [sinifId])

  const denemeBul = (id: number) => denemeler.find((d) => d.id === id)

  return (
    <section className="bolum">
      <div className="baslik-satiri">
        <h2>Denemeler</h2>
        {!formAcik && (
          <button className="ikincil" onClick={() => setFormAcik(true)} disabled={denemeler.length === 0}>
            + Deneme ekle
          </button>
        )}
      </div>
      {hata && <p className="hata">{hata}</p>}
      {formAcik && (
        <DenemeEkleFormu
          sinifId={sinifId}
          sinifDuzeyi={sinifDuzeyi}
          denemeler={denemeler}
          uygulananlar={new Set(uygulamalar?.map((u) => u.deneme_id))}
          vazgec={() => setFormAcik(false)}
        />
      )}
      {uygulamalar === null ? (
        <p className="soluk">Yükleniyor…</p>
      ) : denemeler.length === 0 ? (
        <p className="soluk">Sistemde henüz deneme yok. Denemeler soru üretim tarafından eklenince burada seçilebilecek.</p>
      ) : uygulamalar.length === 0 && !formAcik ? (
        <p className="soluk">Bu sınıfa henüz deneme eklenmedi. “Deneme ekle” ile denemeyi ve uygulama tarihini seçin.</p>
      ) : (
        <div className="liste">
          {uygulamalar.map((u) => {
            const d = denemeBul(u.deneme_id)
            const sayi = girilen[u.id] ?? 0
            return (
              <a key={u.id} className="liste-satiri" href={`#/uygulama/${u.id}`}>
                <span className="liste-ana">
                  <strong>{d?.baslik ?? 'Deneme'}</strong>
                  <span className="soluk kucuk">
                    {d?.deneme_kodu}
                    {d && d.surum > 1 && ` · sürüm ${d.surum}`} · {tarihYaz(u.tarih)}
                  </span>
                </span>
                <span className={sayi >= ogrenciSayisi && sayi > 0 ? 'etiket etiket-yeni' : 'etiket etiket-var'}>
                  {sayi} / {ogrenciSayisi} girildi
                </span>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}

function DenemeEkleFormu({
  sinifId,
  sinifDuzeyi,
  denemeler,
  uygulananlar,
  vazgec,
}: {
  sinifId: number
  sinifDuzeyi: number
  denemeler: Deneme[]
  uygulananlar: Set<number>
  vazgec: () => void
}) {
  // Sınıfın düzeyine uyan denemeler önce gelir.
  const sirali = [...denemeler].sort((a, b) => Number(b.sinif === sinifDuzeyi) - Number(a.sinif === sinifDuzeyi))
  const [denemeId, setDenemeId] = useState(sirali[0]?.id ?? 0)
  const [tarih, setTarih] = useState(bugun())
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function kaydet(e: FormEvent) {
    e.preventDefault()
    setBekliyor(true)
    const { data, error } = await supabase
      .from('uygulamalar')
      .insert({ sinif_id: sinifId, deneme_id: denemeId, tarih })
      .select()
      .single()
    setBekliyor(false)
    if (error) return setHata(hataMetni(error))
    git(`/uygulama/${data.id}`)
  }

  return (
    <form className="kart form" onSubmit={kaydet}>
      <div className="satir">
        <label className="genis">
          Deneme
          <select value={denemeId} onChange={(e) => setDenemeId(Number(e.target.value))}>
            {sirali.map((d) => (
              <option key={d.id} value={d.id}>
                {d.deneme_kodu}
                {d.surum > 1 ? ` (sürüm ${d.surum})` : ''} · {d.baslik}
              </option>
            ))}
          </select>
        </label>
        <label>
          Uygulama tarihi
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} required />
        </label>
      </div>
      {uygulananlar.has(denemeId) && (
        <p className="uyari">Bu deneme bu sınıfa daha önce eklenmiş. Yine de yeni bir uygulama olarak eklenebilir.</p>
      )}
      {hata && <p className="hata">{hata}</p>}
      <div className="dugmeler">
        <button type="submit" disabled={bekliyor || !denemeId}>
          {bekliyor ? 'Ekleniyor…' : 'Ekle ve cevap girişine geç'}
        </button>
        <button type="button" className="ikincil" onClick={vazgec}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}
