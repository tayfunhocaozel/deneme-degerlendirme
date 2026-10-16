import { yuzde } from '../puan'
import type { KazanimOzeti } from './tipler'

// Kazanım başarı çubukları (öğretmen karnesindeki listenin öğrenci sürümü).
export default function KazanimListesi({
  satirlar,
  sinifOranVar = false,
}: {
  satirlar: (KazanimOzeti & { sinif_oran?: number })[]
  sinifOranVar?: boolean
}) {
  const dolu = satirlar.filter((s) => s.toplam > 0)
  if (dolu.length === 0) return <p className="soluk">Veri yok.</p>
  return (
    <div className="basari-listesi">
      {dolu.map((s) => {
        const oran = s.dogru / s.toplam
        return (
          <div key={s.kod} className="basari-satiri" title={s.aciklama ?? undefined}>
            <div className="basari-ust">
              <span>
                <strong>{s.kod}</strong>
                {s.aciklama && <span className="soluk kucuk basari-aciklama"> {s.aciklama}</span>}
              </span>
              <span className="kucuk">
                <strong>{yuzde(oran)}</strong>{' '}
                <span className="soluk">
                  ({s.dogru}/{s.toplam})
                  {sinifOranVar && s.sinif_oran !== undefined && ` · sınıf ${yuzde(s.sinif_oran)}`}
                </span>
              </span>
            </div>
            <div className="cubuk">
              <div
                className={`cubuk-dolu ${oran >= 0.7 ? 'iyi' : oran >= 0.4 ? 'orta' : 'zayif'}`}
                style={{ width: `${oran * 100}%` }}
              />
              {sinifOranVar && s.sinif_oran !== undefined && (
                <div className="cubuk-sinif" style={{ left: `${s.sinif_oran * 100}%` }} title="Sınıf ortalaması" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
