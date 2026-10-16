# Öğrenci girişi (plan)

Planlandı 2026-10-16 (telefon notu). Henüz yapılmadı.

## Amaç
Öğrenci, ödev olarak verilen (kâğıt çıktı veya PDF) denemeyi çözünce cevaplarını kendisi sisteme girer. Girişler optik okumayla aynı tabloya yazılır; karne, sınıf raporu ve soru analizi değişmeden çalışır.

## Öğretmen tarafı
- Deneme sınıfa eklenir, "öğrenci girişine açık" işaretlenir, son tarih belirlenir.
- Kâğıt/PDF üzerinde deneme kodu (örn. 8-D05), istenirse QR.
- Çakışma listesi: aynı okul numarasına ikinci bir Google hesabı düşerse iki ad ve e-posta yan yana görünür, doğru olanı öğretmen seçer. Çözülene kadar o numaranın sonuçları öğrenciye ve raporlara yansımaz.
- Girişin kaynağı (optik / öğrenci) işaretli görünür.
- Eşleşen okul numarasını yalnızca öğretmen değiştirebilir.

## Öğrenci tarafı (sayfalar)
1. Giriş: "Google ile giriş" (şimdilik tek yöntem).
2. Numara eşleştirme (ilk girişte bir kez): öğrenci okul numarasını yazar. Sınıf listesinde yoksa kabul edilmez; boşsa eşleşir; başka hesaba aitse ikinci hesap beklemeye düşer. Google adı ve e-postası güvenlik için kaydedilir.
3. Deneme listesi: yalnızca sınıfa eklenmiş, açık ve süresi dolmamış denemeler. Gönderilenler "tamamlandı".
4. Cevap ekranı: soru soru A-B-C-D (E yok), boş bırakma var. Gönderene kadar değiştirilebilir, göndermeden önce boş sayısı özeti.
5. Sonuç ekranı (gönderince): doğru, yanlış, boş, ders bazlı net, sınıf ortalaması. Soru soru doğru cevaplar deneme kapanınca açılır.
6. Denemelerim: geçmiş tüm denemeler tarih sırasıyla, her birinde net (optikle okunanlar dahil). Kapanmış denemelerde soru soru cevaplar ve doğru şıklar.
7. Genel durum: denemeden denemeye toplam net grafiği, ders bazında ortalama net ve en güçlü/zayıf ders, son denemeye göre değişim, sınıf ortalaması çizgisi, kazanım bazlı zayıf konular.

## Kurallar
- Tek gönderim hakkı. Öğrenci yalnızca kendi verisini görür.
- Aynı öğrencinin hem optik hem öğrenci girişi varsa öğretmenin optik okuması geçerli, çelişkide öğretmene işaret düşer.
- Başka kişisel veri istenmez.

## Ön kontroller
- Sorularda kazanım bilgisi var mı (Supabase ve soru üretim verisi)? Yoksa ilk sürümde ders bazlı analiz.
- Supabase dönüş adresleri (Site URL / Redirect URLs) Google girişi için ayarlı mı?

## Sonraya
- Google hesabı olmayan veya kısıtlı öğrenciler için PIN yedeği.
