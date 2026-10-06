# Yapılacaklar

## Bekleyenler

- [ ] **Açık kaydı kapat:** Supabase panelinde Authentication → Sign In / Providers → "Allow new users to sign up" kapatılacak. Öğretmenler Authentication → Users → "Invite user" ile davetle eklenir. (Kapalı değilse herhangi biri hesap açıp cevap anahtarlarını görebilir.)
- [ ] **Fotoğraftan sınıf listesi okuma için yapay zekâ API anahtarı:** anahtar alınacak, Supabase Edge Function'ın gizli ayarlarına (secrets) konacak; tarayıcıya hiç gitmeyecek. Öğrenci adları yapay zekâ servisine gideceği için velilere verilecek aydınlatma metnine eklenecek.
- [ ] **Supabase dönüş adresi:** Authentication → URL Configuration → Site URL `https://tayfunhocaozel.github.io/deneme-degerlendirme/`; Redirect URLs'e bu adres ve `http://localhost:5173/deneme-degerlendirme/`.
- [ ] Telefon türü (Android / iPhone) öğrenilecek; optik okuma aşamasında gerekli.

## Tamamlananlar

- [x] Supabase projesi açıldı: `deneme-degerlendirme` (`ihucakamyxyulodwqsmm`, Frankfurt). 2026-10-05
- [x] İlk şema uygulandı ve test edildi (aktarım, değerlendirme görünümü, RLS). 2026-10-05
- [x] `sinif_benim` fonksiyonu private şemaya taşındı; güvenlik denetimi temiz. 2026-10-06
- [x] Uygulama ilk sürümü (giriş, sınıflar, öğrenci ekleme tek tek / Excel'den) GitHub Pages'te yayında: https://tayfunhocaozel.github.io/deneme-degerlendirme/ 2026-10-06
- [x] İlk öğretmen hesabı açıldı ve giriş yapıldı. 2026-10-06
- [x] Soru üretim tarafı denemeleri `deneme_aktar` ile gönderiyor; 8-D01…8-D04 yüklendi, test denemesi silindi. 2026-10-06
- [x] Deneme uygulama, elle cevap girişi, öğrenci karnesi ve telefon uyumu yayında; kullanıcı telefonda doğruladı. 2026-10-06
