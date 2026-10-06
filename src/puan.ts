import type { Isaret } from './veritabani'

export type Ozet = { dogru: number; yanlis: number; bos: number; net: number }

// LGS kuralı: 3 yanlış 1 doğruyu götürür. Birden fazla işaretli (geçersiz) soru yanlış sayılır.
export function ozetle(isaretler: Isaret[], cevapAnahtari: string[]): Ozet {
  let dogru = 0
  let yanlis = 0
  let bos = 0
  cevapAnahtari.forEach((cevap, i) => {
    const isaret = isaretler[i] ?? 'bos'
    if (isaret === 'bos') bos++
    else if (isaret === cevap) dogru++
    else yanlis++
  })
  return { dogru, yanlis, bos, net: dogru - yanlis / 3 }
}

export function netYaz(net: number): string {
  return net.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function yuzde(oran: number): string {
  return `%${Math.round(oran * 100)}`
}

// Bankanın biçim söz dizimini düz metne çevirir: {3/8} → 3/8, {√12} → √12, 2^{5} → 2⁵, **kalın** → kalın.
const UST: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
}
export function bicimsizYaz(metin: string): string {
  return metin
    .replace(/\^\{([^}]*)\}/g, (_, us: string) => [...us].map((k) => UST[k] ?? k).join(''))
    .replace(/\{\^([^}]*)\}/g, '$1̅')
    .replace(/\{([^}]*)\}/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
}
