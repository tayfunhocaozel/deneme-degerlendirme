# Yapılacaklar

## Bekleyenler

- [ ] **Açık kaydı kapat:** Supabase panelinde Authentication → Sign In / Providers → "Allow new users to sign up" kapatılacak. Öğretmenler Authentication → Users → "Invite user" ile davetle eklenir. (Kapalı değilse herhangi biri hesap açıp cevap anahtarlarını görebilir.)
- [ ] **Fotoğraftan sınıf listesi okuma için yapay zekâ API anahtarı:** anahtar alınacak, Supabase Edge Function'ın gizli ayarlarına (secrets) konacak; tarayıcıya hiç gitmeyecek. Öğrenci adları yapay zekâ servisine gideceği için velilere verilecek aydınlatma metnine eklenecek.
- [ ] **Soru üretim tarafına deneme aktarımını ekle** (soru üretim oturumunda yapılacak): onaylanan deneme `public.deneme_aktar(veri jsonb)` fonksiyonuyla veritabanına yazılır. `veri`, proje tanımı 4.2'deki JSON biçimidir. `service_role` anahtarı yalnızca o bilgisayarda, yerel bir dosyada durur; depoya girmez.
  - Proje tanımı belgesinin 4.2 ve 4.4 bölümleri bu karara göre güncellenecek (artık `70_Veri` klasörü üzerinden değil, doğrudan veritabanına yazılıyor).
  - Uygulanmış bir denemenin aynı sürümü tekrar gönderilirse fonksiyon reddeder; düzeltme için `surum` artırılmalı.
- [ ] **Supabase dönüş adresi:** Authentication → URL Configuration → Site URL `https://tayfunhocaozel.github.io/deneme-degerlendirme/`; Redirect URLs'e bu adres ve `http://localhost:5173/deneme-degerlendirme/`.
- [ ] **İlk öğretmeni davet et:** Authentication → Users → Invite user.
- [ ] Telefon türü (Android / iPhone) öğrenilecek; optik okuma aşamasında gerekli.

## Tamamlananlar

- [x] Supabase projesi açıldı: `deneme-degerlendirme` (`ihucakamyxyulodwqsmm`, Frankfurt). 2026-10-05
- [x] İlk şema uygulandı ve test edildi (aktarım, değerlendirme görünümü, RLS). 2026-10-05
- [x] `sinif_benim` fonksiyonu private şemaya taşındı; güvenlik denetimi temiz. 2026-10-06
- [x] Uygulama ilk sürümü (giriş, sınıflar, öğrenci ekleme tek tek / Excel'den) GitHub Pages'te yayında: https://tayfunhocaozel.github.io/deneme-degerlendirme/ 2026-10-06
