// Yerel test: test görüntülerini tarayıcıdaki Worker okuyucusuyla okur ve gerçek değerlerle karşılaştırır.
// Yalnızca `npm run dev` ile açılır (/deneme-degerlendirme/test/optik-test.html); yayına çıkmaz.
import { formuOku, okuyucuyuHazirla } from '../src/optik/okuma.ts'

const cikti = document.getElementById('cikti')!
const yaz = (s: string) => (cikti.textContent += s + '\n')
const isaretYaz = (i: string) => (i === 'bos' ? '-' : i === 'gecersiz' ? '*' : i)

async function goruntuVerisi(url: string): Promise<ImageData> {
  const img = new Image()
  img.src = url
  await img.decode()
  const t = document.createElement('canvas')
  t.width = img.naturalWidth
  t.height = img.naturalHeight
  const c = t.getContext('2d')!
  c.drawImage(img, 0, 0)
  return c.getImageData(0, 0, t.width, t.height)
}

;(async () => {
  cikti.textContent = ''
  let bas = performance.now()
  await okuyucuyuHazirla()
  yaz(`OpenCV yüklendi: ${Math.round(performance.now() - bas)} ms`)
  const gercek = await (await fetch('./goruntu/gercek.json')).json()
  let dogru = 0
  let ret = 0
  let yanlis = 0
  for (const ad of Object.keys(gercek)) {
    const g = gercek[ad]
    const veri = await goruntuVerisi(`./goruntu/${ad}.jpg`)
    bas = performance.now()
    try {
      const s = await formuOku(veri, null)
      const gNo = g.no.includes('#') ? null : g.no.trim() ? Number(g.no.replace(/ /g, '')) : null
      const cev = s.cevaplar.map((c) => isaretYaz(c.isaret)).join('')
      const tamam = s.ogrenciNo === gNo && cev === g.cevaplar
      tamam ? dogru++ : yanlis++
      yaz(`${ad.padEnd(22)} ${tamam ? 'DOĞRU ' : 'YANLIŞ'} ${Math.round(performance.now() - bas)}ms no=${s.ogrenciNo} (${s.noDurum}) ${cev}`)
    } catch (e) {
      ret++
      yaz(`${ad.padEnd(22)} RET    ${Math.round(performance.now() - bas)}ms ${(e as Error).message}`)
    }
  }
  yaz(`SONUÇ: ${dogru} doğru, ${ret} ret, ${yanlis} yanlış`)
})()
