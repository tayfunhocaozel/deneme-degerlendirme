// Service worker: uygulama dosyalarını telefonda önbelleğe alır.
// En büyük kazanç optik okuyucunun OpenCV dosyası (~15 MB): ilk açılıştan sonra yeniden indirilmez.
// Yalnızca bu sitenin dosyalarına karışır; Supabase istekleri (başka adres) olduğu gibi geçer.
const ONBELLEK = 'deneme-degerlendirme-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (olay) => {
  olay.waitUntil(
    caches
      .keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== ONBELLEK).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (olay) => {
  const istek = olay.request
  if (istek.method !== 'GET') return
  const adres = new URL(istek.url)
  if (adres.origin !== self.location.origin) return

  // Derleme dosyaları adlarında içerik özeti taşır, değişmez: önce önbellek.
  if (adres.pathname.includes('/assets/')) {
    olay.respondWith(
      caches.open(ONBELLEK).then(async (o) => {
        const kayitli = await o.match(istek)
        if (kayitli) return kayitli
        const yanit = await fetch(istek)
        if (yanit.ok) o.put(istek, yanit.clone())
        return yanit
      }),
    )
    return
  }

  // Sayfa ve diğer dosyalar: önce ağ (güncel sürüm), ağ yoksa önbellek.
  olay.respondWith(
    fetch(istek)
      .then((yanit) => {
        if (yanit.ok) {
          const kopya = yanit.clone()
          caches.open(ONBELLEK).then((o) => o.put(istek, kopya))
        }
        return yanit
      })
      .catch(() => caches.match(istek).then((k) => k ?? Response.error())),
  )
})
