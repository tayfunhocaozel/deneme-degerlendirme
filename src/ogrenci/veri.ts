import { useEffect, useState } from 'react'
import { hataMetni, supabase } from '../supabase'
import type { DenemeAyrintisi, OgrenciOzeti } from './tipler'

// Öğrencinin tüm denemeleri ve kazanım özeti (tek çağrı).
export function useOzet() {
  const [ozet, setOzet] = useState<OgrenciOzeti | null>(null)
  const [hata, setHata] = useState('')
  useEffect(() => {
    supabase.rpc('ogrenci_ozeti').then(({ data, error }) => {
      if (error) return setHata(hataMetni(error))
      setOzet(data as unknown as OgrenciOzeti)
    })
  }, [])
  return { ozet, hata }
}

export function useDeneme(id: number) {
  const [deneme, setDeneme] = useState<DenemeAyrintisi | null>(null)
  const [hata, setHata] = useState('')
  useEffect(() => {
    supabase.rpc('ogrenci_deneme', { p_uygulama_id: id }).then(({ data, error }) => {
      if (error) return setHata(hataMetni(error))
      setDeneme(data as unknown as DenemeAyrintisi)
    })
  }, [id])
  return { deneme, setDeneme, hata }
}
