import type { Session } from '@supabase/supabase-js'
import { useOgrenciRota } from '../yonlendirme'
import SadeUstCubuk from '../bilesenler/SadeUstCubuk'
import type { Eslesme, Rol } from './tipler'
import Eslestirme from './Eslestirme'
import Denemeler from './Denemeler'
import CevapEkrani from './CevapEkrani'
import SonucEkrani from './SonucEkrani'
import Denemelerim from './Denemelerim'
import GenelDurum from './GenelDurum'

const SEKMELER: [string, string, string[]][] = [
  ['#/', 'Denemeler', ['denemeler', 'cevap']],
  ['#/denemelerim', 'Denemelerim', ['denemelerim', 'sonuc']],
  ['#/durum', 'Genel durum', ['durum']],
]

// Öğrenci tarafı: ilk girişte numara eşleştirme, sonra denemeler / denemelerim / genel durum.
export default function OgrenciUygulamasi({ oturum, rol, yenile }: { oturum: Session; rol: Rol; yenile: () => void }) {
  const rota = useOgrenciRota()
  const onayli = rol.eslesmeler.filter((e) => e.durum === 'onayli')
  const sorunlu = rol.eslesmeler.filter((e) => e.durum !== 'onayli')

  if (rol.eslesmeler.length === 0 || rota.sayfa === 'sinif-ekle')
    return (
      <>
        <SadeUstCubuk oturum={oturum} />
        <main className="icerik dar-icerik">
          <Eslestirme ilk={rol.eslesmeler.length === 0} yenile={yenile} />
        </main>
      </>
    )

  if (onayli.length === 0)
    return (
      <>
        <SadeUstCubuk oturum={oturum} />
        <main className="icerik dar-icerik">
          <EslesmeDurumu eslesmeler={sorunlu} />
          <div className="dugmeler">
            <button className="ikincil" onClick={yenile}>
              Durumu yenile
            </button>
            <a href="#/sinif-ekle" className="bag">
              Başka bir sınıf kodu gir
            </a>
          </div>
        </main>
      </>
    )

  return (
    <>
      <SadeUstCubuk oturum={oturum}>
        <span className="kucuk">{onayli[0].ad_soyad}</span>
      </SadeUstCubuk>
      <main className="icerik">
        <nav className="sekmeler ogrenci-sekmeleri">
          {SEKMELER.map(([adres, ad, sayfalar]) => (
            <a key={adres} href={adres} className={sayfalar.includes(rota.sayfa) ? 'sekme secili' : 'sekme'}>
              {ad}
            </a>
          ))}
        </nav>
        {sorunlu.length > 0 && <EslesmeDurumu eslesmeler={sorunlu} />}
        {rota.sayfa === 'denemeler' && <Denemeler />}
        {rota.sayfa === 'cevap' && <CevapEkrani
            key={rota.id}
            id={rota.id}
            kullaniciId={oturum.user.id}
          />}
        {rota.sayfa === 'sonuc' && <SonucEkrani key={rota.id} id={rota.id} />}
        {rota.sayfa === 'denemelerim' && <Denemelerim />}
        {rota.sayfa === 'durum' && <GenelDurum />}
      </main>
    </>
  )
}

function EslesmeDurumu({ eslesmeler }: { eslesmeler: Eslesme[] }) {
  return (
    <div className="kart uyari">
      {eslesmeler.map((e) => (
        <p key={`${e.sinif}-${e.okul_no}`}>
          <strong>
            {e.sinif} · {e.okul_no}
          </strong>
          :{' '}
          {e.durum === 'bekliyor'
            ? 'Bu numara başka bir hesapla da eşleşmiş. Öğretmenin doğru hesabı seçince sonuçlarını görebileceksin.'
            : 'Bu numarayla başka bir hesap da eşleşmek istedi. Öğretmenin onaylayana kadar bu sınıfın sonuçları görünmez.'}
        </p>
      ))}
    </div>
  )
}
