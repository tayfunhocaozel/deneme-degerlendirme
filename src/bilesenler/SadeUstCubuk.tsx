import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

// Öğretmen olmayan ekranların (öğrenci, başvuru) ortak üst çubuğu.
export default function SadeUstCubuk({ oturum, children }: { oturum: Session; children?: ReactNode }) {
  return (
    <header className="ust-cubuk">
      <a href="#/" className="logo">
        Deneme Değerlendirme
      </a>
      <div className="kullanici">
        {children}
        <span className="soluk kucuk masaustu">{oturum.user.email}</span>
        <button className="bag" onClick={() => supabase.auth.signOut()}>
          Çıkış
        </button>
      </div>
    </header>
  )
}
