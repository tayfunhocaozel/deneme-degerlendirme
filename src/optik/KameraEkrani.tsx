import { useEffect, useRef, useState } from 'react'
import { fener, kameraAc, kameraKapat, kareYakala, netlik, qrAra, yerlesikQrVar, type Kamera } from './kamera.ts'
import { formuOku, okuyucuyuHazirla } from './okuma.ts'
import type { OkumaSonucu, QrBilgisi } from './okuyucu.ts'
import { SABLON } from './sablon.ts'

const ARALIK_MS = 180
const EN_AZ_PXMM = 8.5 // formun ~850 px'ten küçük görünmesi okumayı bozar
// Sabitlik yalnızca hareket bulanıklığını önlemek için: köşeler çekilen karede yeniden bulunduğu için
// tam hareketsizlik gerekmez. Elde tutulan telefonda QR kenarının %4'ü fazla sıkıydı, hiç tetiklenmiyordu.
const SABIT_KARE = 2
const SABIT_ESIK = 0.12 // ardışık karelerde QR merkezinin kayması < QR kenarı × 0,12
const BOYUT_ESIK = 0.1
const KACIRMA_TOLERANSI = 2 // QR bir iki karede kaçırılırsa geçmiş sıfırlanmaz
const EN_COK_BEKLEME_MS = 2000 // QR bu kadar süre görünür kalırsa koşullar sağlanmasa da çek

type Durum = { metin: string; tur: 'bilgi' | 'iyi' | 'uyari' | 'hata' }

// Kamera önizlemesi, otomatik yakalama ve deklanşör. Okuma başarılı olunca `okundu` çağrılır.
export default function KameraEkrani({ okundu }: { okundu: (s: OkumaSonucu) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const kamera = useRef<Kamera | null>(null)
  const sonQr = useRef<QrBilgisi | null>(null)
  const isleniyor = useRef(false)
  const bekleme = useRef(0) // hatadan sonra otomatik yakalamayı kısa süre durdur
  const [durum, setDurum] = useState<Durum>({ metin: 'Kamera açılıyor…', tur: 'bilgi' })
  const [hazir, setHazir] = useState(false)
  const [yerlesik, setYerlesik] = useState<boolean | null>(null)
  const [fenerVar, setFenerVar] = useState(false)
  const [fenerAcik, setFenerAcik] = useState(false)
  const [okuyor, setOkuyor] = useState(false)
  const [okuyucuHazir, setOkuyucuHazir] = useState(false)
  const [kameraHatasi, setKameraHatasi] = useState('')
  const sonKare = useRef<ImageData | null>(null) // okunamayan kare: öğretmen isterse telefona indirir
  const [indirilebilir, setIndirilebilir] = useState(false)
  // Döngü, okuyucunun hazır olup olmadığını güncel okusun diye.
  const okuyucuHazirRef = useRef(false)
  okuyucuHazirRef.current = okuyucuHazir

  async function yakala(qr: QrBilgisi | null) {
    if (isleniyor.current || !video.current) return
    isleniyor.current = true
    setOkuyor(true)
    setDurum({ metin: 'Form okunuyor…', tur: 'bilgi' })
    try {
      const kare = kareYakala(video.current)
      // Worker'a aktarılınca veri boşalır; sorun bildirmek için bir kopyası tutulur.
      sonKare.current = new ImageData(new Uint8ClampedArray(kare.data), kare.width, kare.height)
      const sonuc = await formuOku(kare, qr)
      sonKare.current = null
      okundu(sonuc)
    } catch (h) {
      setDurum({ metin: (h as Error).message, tur: 'hata' })
      setIndirilebilir(!!sonKare.current)
      bekleme.current = Date.now() + 2500
    } finally {
      isleniyor.current = false
      setOkuyor(false)
    }
  }

  useEffect(() => {
    let iptal = false
    let zamanlayici = 0
    const gecmis: { x: number; y: number; s: number; n: number }[] = []
    let kacirma = 0
    let ilkGorulme = 0
    okuyucuyuHazirla()
      .then(() => !iptal && setOkuyucuHazir(true))
      .catch(() => !iptal && setDurum({ metin: 'Okuyucu yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.', tur: 'hata' }))

    async function dongu() {
      if (iptal || !video.current) return
      if (!isleniyor.current && Date.now() > bekleme.current) {
        const qr = await qrAra(video.current)
        sonQr.current = qr
        if (!qr) {
          if (++kacirma > KACIRMA_TOLERANSI) {
            gecmis.length = 0
            ilkGorulme = 0
            setDurum({ metin: 'QR aranıyor… Formu çerçeveye alın.', tur: 'bilgi' })
          }
        } else {
          kacirma = 0
          if (!ilkGorulme) ilkGorulme = Date.now()
          const s = Math.hypot(qr.kose[1][0] - qr.kose[0][0], qr.kose[1][1] - qr.kose[0][1])
          const x = qr.kose.reduce((t, p) => t + p[0], 0) / 4
          const y = qr.kose.reduce((t, p) => t + p[1], 0) / 4
          gecmis.push({ x, y, s, n: netlik(video.current, qr) })
          if (gecmis.length > 8) gecmis.shift()
          const son = gecmis.slice(-SABIT_KARE)
          const sabit =
            son.length === SABIT_KARE &&
            son.every((g) => Math.hypot(g.x - x, g.y - y) < SABIT_ESIK * s && Math.abs(g.s - s) < BOYUT_ESIK * s)
          const enNet = Math.max(...gecmis.map((g) => g.n))
          const net = gecmis[gecmis.length - 1].n >= 0.6 * enNet
          const sureDoldu = Date.now() - ilkGorulme > EN_COK_BEKLEME_MS
          if (s / SABLON.qr.kod_alani.kenar < EN_AZ_PXMM) setDurum({ metin: 'Form küçük görünüyor: biraz yaklaşın.', tur: 'uyari' })
          else if (!okuyucuHazirRef.current) setDurum({ metin: 'Okuyucu yükleniyor, bir saniye…', tur: 'bilgi' })
          else if ((sabit && net) || sureDoldu) {
            gecmis.length = 0
            ilkGorulme = 0
            await yakala(qr)
          } else setDurum({ metin: 'Form bulundu, sabit tutun…', tur: 'iyi' })
        }
      }
      zamanlayici = window.setTimeout(dongu, ARALIK_MS)
    }

    ;(async () => {
      try {
        const yer = await yerlesikQrVar()
        if (iptal) return
        setYerlesik(yer)
        kamera.current = await kameraAc(video.current!)
        if (iptal) return kameraKapat(kamera.current)
        setFenerVar(kamera.current.fenerVar)
        setHazir(true)
        if (yer) dongu()
        else setDurum({ metin: 'Formu çerçeveye alıp deklanşöre basın.', tur: 'bilgi' })
      } catch (h) {
        setKameraHatasi((h as Error).message)
      }
    })()
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
      kameraKapat(kamera.current)
      kamera.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Okunamayan kareyi telefona JPEG olarak indirir (hiçbir yere gönderilmez).
  function kareyiIndir() {
    const k = sonKare.current
    if (!k) return
    const t = document.createElement('canvas')
    t.width = k.width
    t.height = k.height
    t.getContext('2d')!.putImageData(k, 0, 0)
    t.toBlob(
      (b) => {
        if (!b) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `okunamayan-form-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      },
      'image/jpeg',
      0.95,
    )
  }

  async function fenerDegistir() {
    if (!kamera.current) return
    try {
      await fener(kamera.current.iz, !fenerAcik)
      setFenerAcik(!fenerAcik)
    } catch {
      setFenerVar(false)
    }
  }

  if (kameraHatasi)
    return (
      <div className="kart bos-durum">
        <p className="hata">{kameraHatasi}</p>
        <button onClick={() => window.location.reload()}>Sayfayı yenile</button>
      </div>
    )

  return (
    <div className="kamera-kap">
      <div className="kamera-cerceve">
        <video ref={video} className="kamera-video" playsInline muted />
        <div className="kamera-kilavuz" aria-hidden="true">
          <span className="kose ku-sol" />
          <span className="kose ku-sag" />
          <span className="kose ka-sol" />
          <span className="kose ka-sag" />
        </div>
        {okuyor && <div className="kamera-perde">Okunuyor…</div>}
      </div>
      <p className={`kamera-durum durum-${durum.tur}`} role="status">
        {durum.metin}
      </p>
      <div className="kamera-dugmeler">
        {fenerVar && (
          <button className="ikincil" onClick={fenerDegistir} aria-pressed={fenerAcik}>
            {fenerAcik ? 'Feneri kapat' : 'Fener'}
          </button>
        )}
        <button className="deklansor" onClick={() => yakala(sonQr.current)} disabled={!hazir || okuyor || !okuyucuHazir}>
          {okuyucuHazir ? 'Çek' : 'Hazırlanıyor…'}
        </button>
      </div>
      {indirilebilir && (
        <p className="kucuk">
          Okunamayan fotoğrafı incelemek için{' '}
          <button className="bag" onClick={kareyiIndir}>
            telefona indirin
          </button>
          .
        </p>
      )}
      <p className="soluk kucuk">
        Form sabit tutulamazsa “Çek” düğmesine basabilirsiniz. Formun dört köşesindeki siyah kareler ve QR kod kadrajda olsun. Fotoğraf yalnızca bu telefonda işlenir, hiçbir yere
        gönderilmez.
        {yerlesik === false && ' Bu tarayıcıda otomatik yakalama yok; deklanşöre basın.'}
      </p>
    </div>
  )
}
