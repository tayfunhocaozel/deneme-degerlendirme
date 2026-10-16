import { useState, type FormEvent } from 'react'
import { girisTuruOku, girisTuruYaz, hataMetni, supabase, UYGULAMA_ADRESI, type GirisTuru } from '../supabase'

// Giriş ekranı: öğretmen ve öğrenci sekmeleri.
//   Öğretmen: e-posta + şifre ya da Google. Öğretmen olarak kayıtlı olmayan hesap, girişten sonra
//   başvuru formuna yönlenir (App). "Kaydol" yeni hesap açar ve başvuruyu birlikte gönderir.
//   Öğrenci: yalnızca Google. İlk girişte sınıf kodu ve okul numarasıyla eşleşir (App).
export default function Giris() {
  const [tur, setTur] = useState<GirisTuru>(girisTuruOku)

  function sekmeSec(yeni: GirisTuru) {
    girisTuruYaz(yeni)
    setTur(yeni)
  }

  return (
    <div className="ortala">
      <div className="kart giris-karti">
        <h1>Deneme Değerlendirme</h1>
        <nav className="sekmeler giris-sekmeleri" role="tablist">
          <button
            role="tab"
            aria-selected={tur === 'ogretmen'}
            className={tur === 'ogretmen' ? 'sekme secili' : 'sekme'}
            onClick={() => sekmeSec('ogretmen')}
          >
            Öğretmen
          </button>
          <button
            role="tab"
            aria-selected={tur === 'ogrenci'}
            className={tur === 'ogrenci' ? 'sekme secili' : 'sekme'}
            onClick={() => sekmeSec('ogrenci')}
          >
            Öğrenci
          </button>
        </nav>
        {tur === 'ogretmen' ? <OgretmenGirisi /> : <OgrenciGirisi />}
        <p className="soluk kucuk">
          <a href="gizlilik.html">Gizlilik ve kişisel veriler</a>
        </p>
      </div>
    </div>
  )
}

async function googleIleGir(tur: GirisTuru) {
  girisTuruYaz(tur)
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: UYGULAMA_ADRESI } })
}

function GoogleDugmesi({ tur, etiket }: { tur: GirisTuru; etiket: string }) {
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)
  return (
    <>
      <button
        type="button"
        className="google-dugmesi"
        disabled={bekliyor}
        onClick={async () => {
          setHata('')
          setBekliyor(true)
          const { error } = await googleIleGir(tur)
          if (error) {
            setBekliyor(false)
            setHata(hataMetni(error))
          }
        }}
      >
        <GoogleSimgesi /> {bekliyor ? 'Google’a yönlendiriliyor…' : etiket}
      </button>
      {hata && <p className="hata">{hata}</p>}
    </>
  )
}

function OgretmenGirisi() {
  const [mod, setMod] = useState<'giris' | 'kaydol'>('giris')
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [ad, setAd] = useState('')
  const [okul, setOkul] = useState('')
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  function temizle() {
    setHata('')
    setBilgi('')
  }

  async function girisYap(e: FormEvent) {
    e.preventDefault()
    temizle()
    girisTuruYaz('ogretmen')
    setBekliyor(true)
    const { error } = await supabase.auth.signInWithPassword({ email: eposta.trim(), password: sifre })
    setBekliyor(false)
    if (error)
      setHata(
        error.message === 'Invalid login credentials'
          ? 'E-posta ya da şifre hatalı. Hesabınız yoksa aşağıdan kaydolabilirsiniz.'
          : hataMetni(error),
      )
  }

  async function kaydol(e: FormEvent) {
    e.preventDefault()
    temizle()
    if (sifre.length < 8) return setHata('Şifre en az 8 karakter olmalı.')
    girisTuruYaz('ogretmen')
    setBekliyor(true)
    const adSoyad = ad.replace(/\s+/g, ' ').trim()
    const okulAdi = okul.replace(/\s+/g, ' ').trim()
    const { data, error } = await supabase.auth.signUp({
      email: eposta.trim(),
      password: sifre,
      // E-posta doğrulaması gerekiyorsa başvuru formu bu bilgilerle dolu açılır.
      options: { emailRedirectTo: UYGULAMA_ADRESI, data: { ad_soyad: adSoyad, okul: okulAdi } },
    })
    if (error) {
      setBekliyor(false)
      return setHata(hataMetni(error))
    }
    if (data.session) {
      // Doğrulama gerekmiyor: oturum açıldı, başvuruyu hemen gönder. App başvuru durumunu gösterir.
      const b = await supabase.rpc('ogretmen_basvur', { p_ad_soyad: adSoyad, p_okul: okulAdi })
      setBekliyor(false)
      if (b.error) setHata(hataMetni(b.error))
      return
    }
    setBekliyor(false)
    // Supabase, kayıtlı bir e-postada da hata vermeden boş kimlikle döner.
    if (data.user && data.user.identities?.length === 0)
      return setHata('Bu e-postayla zaten bir hesap var. Giriş yapın ya da şifrenizi yenileyin.')
    setBilgi('E-postanıza bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayınca başvurunuz tamamlanacak.')
  }

  async function sifremiUnuttum() {
    temizle()
    if (!eposta.trim()) return setHata('Önce e-posta adresinizi yazın.')
    setBekliyor(true)
    const { error } = await supabase.auth.resetPasswordForEmail(eposta.trim(), { redirectTo: UYGULAMA_ADRESI })
    setBekliyor(false)
    if (error) setHata(hataMetni(error))
    else setBilgi('Şifre yenileme bağlantısı e-posta adresinize gönderildi.')
  }

  if (mod === 'kaydol')
    return (
      <form className="giris-formu" onSubmit={kaydol}>
        <p className="soluk">
          Öğretmen hesabı başvurusu. Başvurunuz onaylanınca sınıflarınızı açabilirsiniz.
        </p>
        <GoogleDugmesi tur="ogretmen" etiket="Google ile kaydol" />
        <p className="ayrac">
          <span>ya da e-postayla</span>
        </p>
        <label>
          Ad soyad
          <input autoComplete="name" value={ad} onChange={(e) => setAd(e.target.value)} required />
        </label>
        <label>
          Okul
          <input autoComplete="organization" value={okul} onChange={(e) => setOkul(e.target.value)} required />
        </label>
        <label>
          E-posta
          <input type="email" autoComplete="email" value={eposta} onChange={(e) => setEposta(e.target.value)} required />
        </label>
        <label>
          Şifre (en az 8 karakter)
          <input
            type="password"
            autoComplete="new-password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            required
          />
        </label>
        {hata && <p className="hata">{hata}</p>}
        {bilgi && <p className="basari">{bilgi}</p>}
        <button type="submit" disabled={bekliyor}>
          {bekliyor ? 'Bekleyin…' : 'Kaydol ve başvur'}
        </button>
        <button
          type="button"
          className="bag"
          onClick={() => {
            temizle()
            setMod('giris')
          }}
        >
          Hesabım var, giriş yapayım
        </button>
      </form>
    )

  return (
    <form className="giris-formu" onSubmit={girisYap}>
      <label>
        E-posta
        <input type="email" autoComplete="email" value={eposta} onChange={(e) => setEposta(e.target.value)} required />
      </label>
      <label>
        Şifre
        <input
          type="password"
          autoComplete="current-password"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          required
        />
      </label>
      {hata && <p className="hata">{hata}</p>}
      {bilgi && <p className="basari">{bilgi}</p>}
      <button type="submit" disabled={bekliyor}>
        {bekliyor ? 'Bekleyin…' : 'Giriş yap'}
      </button>
      <button type="button" className="bag" onClick={sifremiUnuttum} disabled={bekliyor}>
        Şifremi unuttum
      </button>
      <p className="ayrac">
        <span>ya da</span>
      </p>
      <GoogleDugmesi tur="ogretmen" etiket="Google ile giriş" />
      <p className="kucuk">
        Hesabınız yok mu?{' '}
        <button
          type="button"
          className="bag"
          onClick={() => {
            temizle()
            setMod('kaydol')
          }}
        >
          Öğretmen olarak kaydolun
        </button>
      </p>
    </form>
  )
}

function OgrenciGirisi() {
  return (
    <div className="giris-formu">
      <p>Okul hesabın ya da kişisel Google hesabınla giriş yap.</p>
      <GoogleDugmesi tur="ogrenci" etiket="Google ile giriş" />
      <p className="soluk kucuk">
        İlk girişte öğretmeninin verdiği <strong>sınıf kodunu</strong> ve <strong>okul numaranı</strong> yazacaksın. Bu
        bir kez yapılır.
      </p>
    </div>
  )
}

function GoogleSimgesi() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
