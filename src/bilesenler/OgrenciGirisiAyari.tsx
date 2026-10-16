import { useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { Uygulama } from '../veritabani'

// <input type="datetime-local"> yerel saat biçimi: YYYY-AA-GGTSS:DD
function yerelGirdi(tarih: Date): string {
  const iki = (n: number) => String(n).padStart(2, '0')
  return `${tarih.getFullYear()}-${iki(tarih.getMonth() + 1)}-${iki(tarih.getDate())}T${iki(tarih.getHours())}:${iki(tarih.getMinutes())}`
}

function haftayaGeceYarisi(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 0, 0)
  return yerelGirdi(d)
}

function zamanYaz(t: string) {
  return new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

// Deneme sayfasında: denemeyi öğrencilerin kendi cevabını girmesine açma / kapatma.
export default function OgrenciGirisiAyari({
  uygulama,
  sinifKodu,
  gonderimSayisi,
  degisti,
}: {
  uygulama: Uygulama
  sinifKodu: string
  gonderimSayisi: number
  degisti: (u: Uygulama) => void
}) {
  const [duzenle, setDuzenle] = useState(false)
  const [sonTarih, setSonTarih] = useState(
    uygulama.son_tarih && new Date(uygulama.son_tarih) > new Date() ? yerelGirdi(new Date(uygulama.son_tarih)) : haftayaGeceYarisi(),
  )
  const [hata, setHata] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  const acik = uygulama.ogrenci_girisi && !!uygulama.son_tarih && new Date(uygulama.son_tarih) > new Date()
  const kapandi = uygulama.ogrenci_girisi && !acik

  async function guncelle(alanlar: { ogrenci_girisi: boolean; son_tarih: string | null }) {
    setHata('')
    setBekliyor(true)
    const { data, error } = await supabase.from('uygulamalar').update(alanlar).eq('id', uygulama.id).select().single()
    setBekliyor(false)
    if (error) return setHata(hataMetni(error))
    setDuzenle(false)
    degisti(data)
  }

  function kaydet() {
    const t = new Date(sonTarih)
    if (Number.isNaN(t.getTime()) || t <= new Date()) return setHata('Son gün ileri bir tarih olmalı.')
    guncelle({ ogrenci_girisi: true, son_tarih: t.toISOString() })
  }

  return (
    <div className="kart ogrenci-girisi-ayari">
      {duzenle ? (
        <>
          <label>
            Son gün ve saat
            <input type="datetime-local" value={sonTarih} onChange={(e) => setSonTarih(e.target.value)} />
          </label>
          <p className="soluk kucuk">
            Öğrenciler sınıf kodu <strong>{sinifKodu}</strong> ile eşleştikten sonra bu denemenin cevaplarını kendileri
            girer. Son gün geçince giriş kapanır ve öğrenciler soru soru doğru cevapları görür.
          </p>
          {hata && <p className="hata">{hata}</p>}
          <div className="dugmeler">
            <button onClick={kaydet} disabled={bekliyor}>
              {acik ? 'Kaydet' : 'Öğrencilere aç'}
            </button>
            <button className="ikincil" onClick={() => setDuzenle(false)} disabled={bekliyor}>
              Vazgeç
            </button>
          </div>
        </>
      ) : (
        <div className="baslik-satiri">
          <p>
            {acik ? (
              <>
                <span className="etiket etiket-yeni">Öğrencilere açık</span> son gün {zamanYaz(uygulama.son_tarih!)} ·
                sınıf kodu <strong>{sinifKodu}</strong> · {gonderimSayisi} öğrenci gönderdi
              </>
            ) : kapandi ? (
              <>
                <span className="etiket etiket-var">Öğrenci girişi kapandı</span> {zamanYaz(uygulama.son_tarih!)} ·{' '}
                {gonderimSayisi} öğrenci gönderdi
              </>
            ) : (
              <span className="soluk">Öğrenciler bu denemenin cevaplarını kendileri giremiyor.</span>
            )}
          </p>
          <div className="dugmeler">
            <button className="ikincil" onClick={() => setDuzenle(true)} disabled={bekliyor}>
              {acik ? 'Son günü değiştir' : kapandi ? 'Yeniden aç' : 'Öğrenci girişine aç'}
            </button>
            {acik && (
              <button
                className="ikincil"
                disabled={bekliyor}
                onClick={() => guncelle({ ogrenci_girisi: true, son_tarih: new Date().toISOString() })}
              >
                Şimdi kapat
              </button>
            )}
          </div>
          {hata && <p className="hata">{hata}</p>}
        </div>
      )}
    </div>
  )
}
