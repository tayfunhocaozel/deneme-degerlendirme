import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Isaret, Ogrenci } from '../veritabani'
import { netYaz, ozetle } from '../puan'

const SIKLAR = ['A', 'B', 'C', 'D'] as const

// Hızlı giriş kutusundaki her karakter bir soruya karşılık gelir.
//   A B C D → şık,  - . 0 → boş,  * X → birden fazla işaret (geçersiz). Boşluklar yok sayılır.
function metindenIsaretler(metin: string, adet: number): Isaret[] {
  const isaretler: Isaret[] = []
  for (const k of metin.toLocaleUpperCase('tr-TR').replace(/\s/g, '')) {
    if (isaretler.length >= adet) break
    if ('ABCD'.includes(k)) isaretler.push(k as Isaret)
    else if ('-.0'.includes(k)) isaretler.push('bos')
    else if ('*X'.includes(k)) isaretler.push('gecersiz')
  }
  return isaretler
}

function isaretlerdenMetin(isaretler: Isaret[]): string {
  return isaretler.map((i) => (i === 'bos' ? '-' : i === 'gecersiz' ? '*' : i)).join('')
}

export default function CevapGirisi({
  ogrenci,
  anahtar,
  ilkIsaretler,
  sonrakiVar,
  kaydet,
  vazgec,
}: {
  ogrenci: Ogrenci
  anahtar: string[]
  ilkIsaretler: Isaret[] | null
  sonrakiVar: boolean
  kaydet: (isaretler: Isaret[], sonrakine: boolean) => Promise<boolean>
  vazgec: () => void
}) {
  const adet = anahtar.length
  const [metin, setMetin] = useState(ilkIsaretler ? isaretlerdenMetin(ilkIsaretler) : '')
  const [bekliyor, setBekliyor] = useState(false)
  const kutu = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Panel listenin altından açılmış olabilir; görünür hâle getir.
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Dokunmatik ekranda klavye açılıp şıkları kapatmasın diye kutuya otomatik odaklanılmaz.
    if (!window.matchMedia('(pointer: coarse)').matches) kutu.current?.focus({ preventScroll: true })
  }, [])

  const girilen = metindenIsaretler(metin, adet)
  // Girilmemiş sorular boş sayılır.
  const isaretler: Isaret[] = Array.from({ length: adet }, (_, i) => girilen[i] ?? 'bos')
  const ozet = ozetle(isaretler, anahtar)
  const eksik = adet - girilen.length

  function soruyaIsaretle(i: number, isaret: Isaret) {
    const yeni = [...isaretler]
    yeni[i] = yeni[i] === isaret ? 'bos' : isaret
    // Tıklanan sorudan önceki girilmemiş sorular boş olarak doldurulur.
    const uzunluk = Math.max(girilen.length, i + 1)
    setMetin(isaretlerdenMetin(yeni.slice(0, uzunluk)))
  }

  async function gonder(sonrakine: boolean) {
    setBekliyor(true)
    const tamam = await kaydet(isaretler, sonrakine)
    setBekliyor(false)
    if (tamam && sonrakine) setMetin('')
  }

  function tusaBasildi(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      gonder(sonrakiVar)
    }
    if (e.key === 'Escape') vazgec()
  }

  return (
    <div className="kart cevap-girisi" ref={panel}>
      <div className="baslik-satiri">
        <div>
          <h2>
            <span className="soluk">{ogrenci.okul_no}</span> {ogrenci.ad_soyad}
          </h2>
        </div>
        <div className="ozet-kutulari">
          <span className="ozet-kutu dogru">{ozet.dogru} D</span>
          <span className="ozet-kutu yanlis">{ozet.yanlis} Y</span>
          <span className="ozet-kutu bos">{ozet.bos} B</span>
          <span className="ozet-kutu net">{netYaz(ozet.net)} net</span>
        </div>
      </div>

      <label>
        Hızlı giriş: cevapları sırayla yazın (boş için <kbd>-</kbd>, çift işaretli için <kbd>*</kbd>)
        <input
          ref={kutu}
          className="hizli-giris"
          value={metin}
          onChange={(e) => setMetin(isaretlerdenMetin(metindenIsaretler(e.target.value, adet)))}
          onKeyDown={tusaBasildi}
          placeholder="örn. ABDC-BCA…"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </label>
      <p className="soluk kucuk">
        {eksik > 0 ? `${girilen.length} / ${adet} soru girildi; kalan ${eksik} soru boş sayılacak.` : `${adet} sorunun hepsi girildi.`}{' '}
        <span className="masaustu">Enter: kaydet{sonrakiVar ? ' ve sıradaki öğrenciye geç' : ''}.</span>
        <span className="mobil">Telefonda şıklara dokunmanız daha kolay; seçili şıkka yeniden dokunursanız soru boş olur.</span>
      </p>

      <div className="soru-izgara">
        {isaretler.map((isaret, i) => (
          <div key={i} className={`soru-satiri ${i < girilen.length ? '' : 'girilmedi'}`}>
            <span className="soru-no">{i + 1}</span>
            {SIKLAR.map((s) => (
              <button
                key={s}
                type="button"
                tabIndex={-1}
                className={`sik ${isaret === s ? 'secili' : ''}`}
                onClick={() => soruyaIsaretle(i, s)}
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              tabIndex={-1}
              title="Birden fazla işaretli"
              className={`sik gecersiz ${isaret === 'gecersiz' ? 'secili' : ''}`}
              onClick={() => soruyaIsaretle(i, 'gecersiz')}
            >
              *
            </button>
          </div>
        ))}
      </div>

      <div className="dugmeler kayit-cubugu">
        <span className="mobil mobil-ozet">
          <b className="metin-dogru">{ozet.dogru}D</b> <b className="metin-yanlis">{ozet.yanlis}Y</b>{' '}
          <b className="soluk">{ozet.bos}B</b> · <b>{netYaz(ozet.net)}</b>
        </span>
        {sonrakiVar && (
          <button onClick={() => gonder(true)} disabled={bekliyor}>
            Kaydet ve sıradaki →
          </button>
        )}
        <button
          className={sonrakiVar ? 'ikincil kaydet-yalniz' : 'kaydet-yalniz'}
          onClick={() => gonder(false)}
          disabled={bekliyor}
        >
          Kaydet
        </button>
        <button className="ikincil" onClick={vazgec}>
          Vazgeç
        </button>
      </div>
    </div>
  )
}
