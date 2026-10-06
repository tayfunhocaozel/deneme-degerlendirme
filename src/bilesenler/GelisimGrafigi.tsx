// Öğrencinin denemeler boyunca neti ve sınıf ortalaması (çizgi grafik, SVG).
type Nokta = { etiket: string; ogrenci: number; sinif: number; en: number }

const G = 640
const Y = 220
const KENAR = { sol: 36, sag: 16, ust: 16, alt: 32 }

export default function GelisimGrafigi({ noktalar }: { noktalar: Nokta[] }) {
  const ust = Math.max(...noktalar.map((n) => n.en))
  const alt = Math.min(0, ...noktalar.map((n) => Math.floor(Math.min(n.ogrenci, n.sinif))))
  const genislik = G - KENAR.sol - KENAR.sag
  const yukseklik = Y - KENAR.ust - KENAR.alt
  const x = (i: number) => KENAR.sol + (noktalar.length === 1 ? genislik / 2 : (i * genislik) / (noktalar.length - 1))
  const y = (deger: number) => KENAR.ust + yukseklik - ((deger - alt) / (ust - alt)) * yukseklik
  const cizgi = (alan: 'ogrenci' | 'sinif') => noktalar.map((n, i) => `${x(i)},${y(n[alan])}`).join(' ')
  const izgara = [0, 0.25, 0.5, 0.75, 1].map((o) => Math.round(alt + o * (ust - alt)))

  return (
    <figure className="grafik">
      <svg viewBox={`0 0 ${G} ${Y}`} role="img" aria-label="Denemelere göre net gelişimi">
        {izgara.map((d) => (
          <g key={d}>
            <line x1={KENAR.sol} x2={G - KENAR.sag} y1={y(d)} y2={y(d)} className="grafik-izgara" />
            <text x={KENAR.sol - 8} y={y(d)} className="grafik-eksen" textAnchor="end" dominantBaseline="middle">
              {d}
            </text>
          </g>
        ))}
        <polyline points={cizgi('sinif')} className="grafik-sinif" />
        <polyline points={cizgi('ogrenci')} className="grafik-ogrenci" />
        {noktalar.map((n, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(n.sinif)} r={3} className="grafik-sinif-nokta" />
            <circle cx={x(i)} cy={y(n.ogrenci)} r={5} className="grafik-ogrenci-nokta" />
            <text x={x(i)} y={y(n.ogrenci) - 10} className="grafik-deger" textAnchor="middle">
              {n.ogrenci.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
            </text>
            <text x={x(i)} y={Y - 10} className="grafik-eksen" textAnchor="middle">
              {n.etiket}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="grafik-aciklama">
        <span className="lejant ogrenci" /> Öğrencinin neti <span className="lejant sinif" /> Sınıf ortalaması
      </figcaption>
    </figure>
  )
}
