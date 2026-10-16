# Yapılacaklar

## Bekleyenler

- [ ] **Deneme 5 formunu telefonda yeniden okut:** şablon v2 desteği yayında (2026-10-14). Daha önce "QR platformun formuna ait değil: 8-D05|1|2" hatası veren formlar yeniden denenecek.
- [ ] **Öğretmen/öğrenci rollerini ayır (öncelikli):** şu an giriş yapan her hesap tetikleyiciyle öğretmen kaydı alıyor ve cevap anahtarlarını okuyabiliyor. Kayıt (sign up) Google girişi için açık kalmalı; bu yüzden "açık kaydı kapat" yerine yalnızca davet edilen hesaplar öğretmen olacak, diğerleri numara eşleşene kadar hiçbir şey göremeyecek. Plan: OGRENCI_GIRISI.md.
- [ ] **Google deneme düğmesini kaldır:** `Giris.tsx` içindeki "Google ile giriş (deneme)" yalnızca localhost'ta görünür; öğrenci sayfası yapılınca yerini asıl düğme alacak.
- [ ] **Optik okumayı daha çok gerçek formla dene:** ilk gerçek okuma 2026-10-06'da çalıştı. Deneme_0N_Optik.pdf yazdırılıp kurşun kalemle doldurulacak, Android Chrome'da okutulacak. Ret oranı yüksekse köşe işareti "kare dolululuğu" eşiği (0,88) gerçek fotoğraflarla gözden geçirilecek (üretilmiş testte 0,876 çıkan bir köşe yüzünden ret oldu).
- [ ] **Soru üretim tarafına bildir:** referans okuyucu (`optik_oku_ornek.py`) koyu zeminde çekilen fotoğrafta köşe işaretlerini bulamıyor (`RETR_EXTERNAL` → `RETR_LIST`) ve form ~13 px/mm'den büyük görününce eşik penceresi yetmiyor. Platform sürümünde ikisi düzeltildi.

## Tamamlananlar

- [x] Google ile giriş kuruldu: Google Cloud projesi "Deneme Degerlendirme" (In production, yalnızca openid/email/profile), Supabase Google sağlayıcısı, Site URL ve Redirect URLs. Gizlilik sayfası yayında (gizlilik.html). Öğretmen hesabı Google ile giriş yaptı, mevcut hesaba bağlandı. 2026-10-16
- [x] Supabase projesi açıldı: `deneme-degerlendirme` (`ihucakamyxyulodwqsmm`, Frankfurt). 2026-10-05
- [x] İlk şema uygulandı ve test edildi (aktarım, değerlendirme görünümü, RLS). 2026-10-05
- [x] `sinif_benim` fonksiyonu private şemaya taşındı; güvenlik denetimi temiz. 2026-10-06
- [x] Uygulama ilk sürümü (giriş, sınıflar, öğrenci ekleme tek tek / Excel'den) GitHub Pages'te yayında: https://tayfunhocaozel.github.io/deneme-degerlendirme/ 2026-10-06
- [x] İlk öğretmen hesabı açıldı ve giriş yapıldı. 2026-10-06
- [x] Soru üretim tarafı denemeleri `deneme_aktar` ile gönderiyor; 8-D01…8-D04 yüklendi, test denemesi silindi. 2026-10-06
- [x] Deneme uygulama, elle cevap girişi, öğrenci karnesi ve telefon uyumu yayında; kullanıcı telefonda doğruladı. 2026-10-06
- [x] Sınıf raporu, soru analizi ve telefonla optik okuma yayında; optik okuma telefonda gerçek formla çalıştı. 2026-10-06
- [x] Optik okuyucu şablon sürümüne göre çalışıyor: QR `deneme_kodu|deneme_surumu|sablon_surumu` (iki alanlı eski QR = v1). v1 (A4'e 8, Deneme 1–4) ve v2 (A4'e 6, Deneme 5+) birlikte; üretilmiş testte v1 12'de 10, v2 8'de 8 doğru, 0 yanlış. 2026-10-14
- [x] Fotoğraftan sınıf listesi okuma özelliğinden vazgeçildi; "Fotoğraftan ekle" düğmesi kaldırıldı. 2026-10-09
