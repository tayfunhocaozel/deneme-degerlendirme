// Yerel test: kamera yerine test görüntüsünü (hafif titreyerek) veren sahte bir akışla KameraEkrani'nı çalıştırır.
// Adres: /deneme-degerlendirme/test/kamera-test.html?g=02_egik  (yalnızca npm run dev; yayına çıkmaz)
import { createRoot } from 'react-dom/client'
import KameraEkrani from '../src/optik/KameraEkrani'
import '../src/stil.css'

const ad = new URLSearchParams(location.search).get('g') ?? '01_duz'
const img = new Image()
img.src = `./goruntu/${ad}.jpg`
await img.decode()
const tuval = document.createElement('canvas')
tuval.width = img.naturalWidth
tuval.height = img.naturalHeight
const c = tuval.getContext('2d')!
let t = 0
setInterval(() => {
  t++
  c.fillStyle = '#777'
  c.fillRect(0, 0, tuval.width, tuval.height)
  c.drawImage(img, Math.sin(t / 3) * 3, Math.cos(t / 4) * 3) // el titremesi
}, 50)
const akis = tuval.captureStream(20)
navigator.mediaDevices.getUserMedia = async () => akis

createRoot(document.getElementById('kok')!).render(
  <KameraEkrani
    okundu={(s) => {
      document.getElementById('sonuc')!.textContent =
        `OKUNDU qr=${s.qr} no=${s.ogrenciNo} (${s.noDurum}) ` + s.cevaplar.map((x) => x.isaret).join(',')
    }}
  />,
)
