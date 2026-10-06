import { useState, type ReactNode } from 'react'

// Silme gibi geri alınamayan işlemler için iki adımlı düğme:
// önce düğme, tıklanınca "Emin misiniz?" ile Evet / Vazgeç.
export default function Onay({
  etiket,
  soru,
  evet,
  tehlikeli = true,
}: {
  etiket: ReactNode
  soru: string
  evet: () => void
  tehlikeli?: boolean
}) {
  const [acik, setAcik] = useState(false)
  if (!acik)
    return (
      <button type="button" className={tehlikeli ? 'bag tehlike' : 'bag'} onClick={() => setAcik(true)}>
        {etiket}
      </button>
    )
  return (
    <span className="onay">
      <span>{soru}</span>
      <button
        type="button"
        className={tehlikeli ? 'kucuk-dugme tehlike-dolu' : 'kucuk-dugme'}
        onClick={() => {
          setAcik(false)
          evet()
        }}
      >
        Evet
      </button>
      <button type="button" className="kucuk-dugme ikincil" onClick={() => setAcik(false)}>
        Vazgeç
      </button>
    </span>
  )
}
