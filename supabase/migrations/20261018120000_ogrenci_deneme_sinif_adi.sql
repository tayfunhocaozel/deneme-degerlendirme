-- Cevap ekranında sınıf adı: ogrenci_deneme() artık sınıf adını da döndürür
-- (öğrenci birden fazla sınıfa bağlıysa hangi sınıfın denemesi olduğu görünsün).
-- Fonksiyonun geri kalanı 20261016130000_ogrenci_girisi.sql ile aynı.

create or replace function public.ogrenci_deneme(p_uygulama_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ogr bigint;
  v_u record;
  v_acik boolean;
  v_kapali boolean;
  v_sonuc bigint;
  v_yol text;
  v_gonderildi timestamptz;
  v_sonuc_json jsonb;
  v_ortalama numeric;
  v_kisi int;
  v_sorular jsonb;
  v_kazanimlar jsonb;
begin
  select b.ogrenci_id into v_ogr
  from private.aktif_ogrencilerim() b(ogrenci_id)
  join public.ogrenciler o on o.id = b.ogrenci_id
  join public.uygulamalar u on u.sinif_id = o.sinif_id
  where u.id = p_uygulama_id;
  if v_ogr is null then raise exception 'erisim_yok'; end if;

  select u.id, u.tarih, u.son_tarih, u.ogrenci_girisi, d.deneme_kodu, d.baslik, d.soru_sayisi, d.sure_dk,
         s.ad as sinif
  into v_u
  from public.uygulamalar u
  join public.denemeler d on d.id = u.deneme_id
  join public.siniflar s on s.id = u.sinif_id
  where u.id = p_uygulama_id;
  v_acik := v_u.ogrenci_girisi and v_u.son_tarih > now();
  v_kapali := not v_u.ogrenci_girisi or v_u.son_tarih <= now();

  select id, giris_yolu into v_sonuc, v_yol from public.sonuclar
  where uygulama_id = p_uygulama_id and ogrenci_id = v_ogr;
  select gonderildi into v_gonderildi from public.ogrenci_gonderimleri
  where uygulama_id = p_uygulama_id and ogrenci_id = v_ogr;
  if not v_acik and v_sonuc is null and v_gonderildi is null then raise exception 'erisim_yok'; end if;

  if v_sonuc is not null then
    select jsonb_build_object(
             'dogru', count(*) filter (where dogru_mu),
             'yanlis', count(*) filter (where isaretlenen <> 'bos' and dogru_mu is not true),
             'bos', count(*) filter (where isaretlenen = 'bos'),
             'net', count(*) filter (where dogru_mu)
                    - count(*) filter (where isaretlenen <> 'bos' and dogru_mu is not true) / 3.0)
    into v_sonuc_json
    from public.cevap_degerlendirme where sonuc_id = v_sonuc;

    select avg(n), count(*) into v_ortalama, v_kisi from (
      select count(*) filter (where dogru_mu)
             - count(*) filter (where isaretlenen <> 'bos' and dogru_mu is not true) / 3.0 as n
      from public.cevap_degerlendirme where uygulama_id = p_uygulama_id group by sonuc_id) t;

    if v_kapali then
      select jsonb_agg(jsonb_build_object(
               'sira', cd.sira, 'isaretlenen', cd.isaretlenen, 'dogru_cevap', cd.dogru_cevap,
               'kazanim', cd.kazanim[1], 'konu', ds.konu) order by cd.sira)
      into v_sorular
      from public.cevap_degerlendirme cd
      join public.deneme_sorulari ds on ds.deneme_id = cd.deneme_id and ds.sira = cd.sira
      where cd.sonuc_id = v_sonuc;

      select jsonb_agg(jsonb_build_object(
               'kod', k.kod, 'aciklama', kz.aciklama, 'dogru', k.dogru, 'toplam', k.toplam,
               'sinif_oran', k.sinif_oran) order by k.kod)
      into v_kazanimlar
      from (
        select coalesce(kazanim[1], '—') as kod,
               count(*) filter (where ogrenci_id = v_ogr and dogru_mu) as dogru,
               count(*) filter (where ogrenci_id = v_ogr) as toplam,
               (count(*) filter (where dogru_mu))::numeric / count(*) as sinif_oran
        from public.cevap_degerlendirme where uygulama_id = p_uygulama_id
        group by 1
      ) k
      left join public.kazanimlar kz on kz.kod = k.kod;
    end if;
  end if;

  return jsonb_build_object(
    'uygulama_id', v_u.id,
    'deneme_kodu', v_u.deneme_kodu,
    'baslik', v_u.baslik,
    'sinif', v_u.sinif,
    'soru_sayisi', v_u.soru_sayisi,
    'sure_dk', v_u.sure_dk,
    'tarih', v_u.tarih,
    'son_tarih', v_u.son_tarih,
    'acik', v_acik,
    'kapali', v_kapali,
    'gonderildi', v_gonderildi,
    'giris_yolu', v_yol,
    'sonuc', v_sonuc_json,
    'sinif_ortalama', v_ortalama,
    'kisi', v_kisi,
    'sorular', v_sorular,
    'kazanimlar', v_kazanimlar
  );
end;
$$;
