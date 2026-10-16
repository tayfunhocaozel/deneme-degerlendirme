-- Öğrenci girişi ve öğretmen başvurusu (plan: OGRENCI_GIRISI.md).
--
--   * Öğretmen başvurusu: öğretmen olmayan hesap başvurur, yönetici onaylar.
--   * Sınıf kodu: öğrenci ilk girişte sınıf kodu + okul numarasıyla öğrenci kaydına eşleşir.
--     Aynı numaraya ikinci hesap gelirse "bekliyor" düşer; öğretmen çözene kadar o
--     numaranın hiçbir hesabı veri göremez ve gönderim yapamaz.
--   * Uygulama öğrenci girişine açılır (son tarihle). Öğrenci tek kez gönderir.
--     Gönderim ogrenci_gonderimleri'nde saklanır; öğrencinin sonucu yoksa sonuclar'a da
--     yazılır. Öğretmenin elle/optik girişi her zaman geçerlidir (üzerine yazar).
--   * Öğrenci tablolara doğrudan erişmez; yalnızca aşağıdaki fonksiyonlarla kendi
--     verisini okur. Soru soru doğru cevaplar deneme kapanınca ve öğrencinin sonucu
--     varsa açılır.

-- ---------------------------------------------------------------------------
-- Yönetici (başvuruları onaylayan öğretmen)
-- ---------------------------------------------------------------------------
alter table public.ogretmenler add column yonetici boolean not null default false;

update public.ogretmenler set yonetici = true
where id = (select id from auth.users where email = 'tayfunhocaozel@gmail.com');

-- Öğretmen kendi satırında yalnızca adını değiştirebilir (yonetici alanını değil).
revoke update on public.ogretmenler from authenticated;
grant update (ad_soyad) on public.ogretmenler to authenticated;

create function private.yonetici_mi()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select yonetici from public.ogretmenler where id = (select auth.uid())), false);
$$;

revoke execute on function private.yonetici_mi() from public, anon;
grant execute on function private.yonetici_mi() to authenticated;

-- ---------------------------------------------------------------------------
-- Öğretmen başvuruları
-- ---------------------------------------------------------------------------
create table public.ogretmen_basvurulari (
  kullanici_id  uuid primary key references auth.users (id) on delete cascade,
  ad_soyad      text not null,
  okul          text not null,
  eposta        text not null,
  durum         text not null default 'bekliyor' check (durum in ('bekliyor', 'onaylandi', 'reddedildi')),
  created_at    timestamptz not null default now(),
  karar_zamani  timestamptz
);

alter table public.ogretmen_basvurulari enable row level security;

create policy "kendi basvurusu ya da yonetici" on public.ogretmen_basvurulari
  for select to authenticated
  using (kullanici_id = (select auth.uid()) or (select private.yonetici_mi()));

-- Başvuru yapar ya da reddedilmiş/bekleyen başvuruyu yeniler.
create function public.ogretmen_basvur(p_ad_soyad text, p_okul text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'giris_gerekli'; end if;
  if exists (select 1 from public.ogretmenler where id = v_uid) then raise exception 'zaten_ogretmen'; end if;
  if coalesce(trim(p_ad_soyad), '') = '' or coalesce(trim(p_okul), '') = '' then
    raise exception 'eksik_bilgi';
  end if;
  insert into public.ogretmen_basvurulari (kullanici_id, ad_soyad, okul, eposta)
  select v_uid, trim(p_ad_soyad), trim(p_okul), coalesce(u.email, '') from auth.users u where u.id = v_uid
  on conflict (kullanici_id) do update
    set ad_soyad = excluded.ad_soyad, okul = excluded.okul, durum = 'bekliyor',
        created_at = now(), karar_zamani = null;
  return 'bekliyor';
end;
$$;

-- Yönetici başvuruyu onaylar (öğretmen satırı açılır) ya da reddeder.
create function public.basvuru_karar(p_kullanici_id uuid, p_onay boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ad text;
begin
  if not private.yonetici_mi() then raise exception 'yetki_yok'; end if;
  update public.ogretmen_basvurulari
    set durum = case when p_onay then 'onaylandi' else 'reddedildi' end, karar_zamani = now()
    where kullanici_id = p_kullanici_id
    returning ad_soyad into v_ad;
  if v_ad is null then raise exception 'basvuru_yok'; end if;
  if p_onay then
    insert into public.ogretmenler (id, ad_soyad) values (p_kullanici_id, v_ad)
    on conflict (id) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sınıf kodu ve öğrenci girişine açık uygulama
-- ---------------------------------------------------------------------------
-- Onaltılık 6 karakter: O/0, I/1 karışmaz. Var olan sınıflara da ayrı ayrı üretilir.
alter table public.siniflar
  add column katilim_kodu text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6));

alter table public.uygulamalar
  add column ogrenci_girisi boolean not null default false,
  add column son_tarih timestamptz,
  add constraint ogrenci_girisi_son_tarih check (not ogrenci_girisi or son_tarih is not null);

alter table public.sonuclar drop constraint sonuclar_giris_yolu_check;
alter table public.sonuclar
  add constraint sonuclar_giris_yolu_check check (giris_yolu in ('elle', 'optik', 'ogrenci'));

-- ---------------------------------------------------------------------------
-- Öğrenci hesabı ↔ öğrenci kaydı eşleşmesi
-- ---------------------------------------------------------------------------
create table public.ogrenci_hesaplari (
  id            bigint generated always as identity primary key,
  kullanici_id  uuid   not null references auth.users (id) on delete cascade,
  ogrenci_id    bigint not null references public.ogrenciler (id) on delete cascade,
  durum         text   not null default 'onayli' check (durum in ('onayli', 'bekliyor')),
  google_ad     text   not null default '',
  eposta        text   not null default '',
  created_at    timestamptz not null default now(),
  unique (kullanici_id, ogrenci_id)
);
-- Bir öğrenci kaydının en fazla bir onaylı hesabı olur.
create unique index ogrenci_hesaplari_tek_onayli on public.ogrenci_hesaplari (ogrenci_id) where durum = 'onayli';
create index on public.ogrenci_hesaplari (kullanici_id);

alter table public.ogrenci_hesaplari enable row level security;

-- Öğretmen kendi sınıfındaki eşleşmeleri görür, çakışmayı çözer, numarayı değiştirir, siler.
create policy "ogretmen okur" on public.ogrenci_hesaplari
  for select to authenticated
  using (exists (select 1 from public.ogrenciler o where o.id = ogrenci_id and private.sinif_benim(o.sinif_id)));
create policy "ogretmen degistirir" on public.ogrenci_hesaplari
  for update to authenticated
  using (exists (select 1 from public.ogrenciler o where o.id = ogrenci_id and private.sinif_benim(o.sinif_id)))
  with check (exists (select 1 from public.ogrenciler o where o.id = ogrenci_id and private.sinif_benim(o.sinif_id)));
create policy "ogretmen siler" on public.ogrenci_hesaplari
  for delete to authenticated
  using (exists (select 1 from public.ogrenciler o where o.id = ogrenci_id and private.sinif_benim(o.sinif_id)));

-- Oturumdaki hesabın veri görebildiği öğrenci kayıtları: onaylı ve çakışmasız.
create function private.aktif_ogrencilerim()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select h.ogrenci_id from public.ogrenci_hesaplari h
  join public.ogrenciler o on o.id = h.ogrenci_id
  where h.kullanici_id = (select auth.uid())
    and h.durum = 'onayli'
    and o.aktif
    and not exists (
      select 1 from public.ogrenci_hesaplari b where b.ogrenci_id = h.ogrenci_id and b.durum = 'bekliyor');
$$;

revoke execute on function private.aktif_ogrencilerim() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Öğrenci gönderimleri (tek hak)
-- ---------------------------------------------------------------------------
create table public.ogrenci_gonderimleri (
  uygulama_id   bigint not null references public.uygulamalar (id) on delete cascade,
  ogrenci_id    bigint not null references public.ogrenciler (id) on delete cascade,
  kullanici_id  uuid   not null references auth.users (id) on delete cascade,
  cevaplar      text[] not null,
  gonderildi    timestamptz not null default now(),
  primary key (uygulama_id, ogrenci_id)
);

alter table public.ogrenci_gonderimleri enable row level security;

create policy "ogretmen okur" on public.ogrenci_gonderimleri
  for select to authenticated
  using (exists (select 1 from public.uygulamalar u where u.id = uygulama_id and private.sinif_benim(u.sinif_id)));
-- Silinirse öğrenci yeniden gönderebilir (öğretmen hakkı geri verir).
create policy "ogretmen siler" on public.ogrenci_gonderimleri
  for delete to authenticated
  using (exists (select 1 from public.uygulamalar u where u.id = uygulama_id and private.sinif_benim(u.sinif_id)));

-- ---------------------------------------------------------------------------
-- Optik/elle giriş, öğrencinin girdiği sonucun üzerine her zaman yazar.
-- ---------------------------------------------------------------------------
create or replace function public.sonuc_kaydet(
  p_uygulama_id bigint,
  p_ogrenci_id bigint,
  p_cevaplar text[],
  p_giris_yolu text default 'optik',
  p_uzerine_yaz boolean default false
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_soru_sayisi int;
  v_id bigint;
  v_yol text;
  v_adet int := coalesce(array_length(p_cevaplar, 1), 0);
begin
  if p_giris_yolu not in ('elle', 'optik') then
    raise exception 'Geçersiz giriş yolu.';
  end if;
  select d.soru_sayisi into v_soru_sayisi
  from public.uygulamalar u
  join public.denemeler d on d.id = u.deneme_id
  where u.id = p_uygulama_id;
  if v_soru_sayisi is null then
    raise exception 'Uygulama bulunamadı ya da bu sınıf size ait değil.';
  end if;
  if v_adet <> v_soru_sayisi then
    raise exception '% cevap bekleniyordu, % geldi.', v_soru_sayisi, v_adet;
  end if;

  select id, giris_yolu into v_id, v_yol from public.sonuclar
  where uygulama_id = p_uygulama_id and ogrenci_id = p_ogrenci_id
  for update;
  if v_id is not null and not p_uzerine_yaz and v_yol <> 'ogrenci' then
    raise exception 'zaten_kayitli';
  end if;

  insert into public.sonuclar (uygulama_id, ogrenci_id, giris_yolu, onaylandi)
  values (p_uygulama_id, p_ogrenci_id, p_giris_yolu, true)
  on conflict (uygulama_id, ogrenci_id) do update
    set giris_yolu = excluded.giris_yolu, onaylandi = true, updated_at = now()
  returning id into v_id;

  insert into public.cevaplar (sonuc_id, sira, isaretlenen)
  select v_id, i, p_cevaplar[i] from generate_subscripts(p_cevaplar, 1) as i
  on conflict (sonuc_id, sira) do update set isaretlenen = excluded.isaretlenen;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Oturumdaki hesabın rolü (uygulama hangi ekranı açacağına buna bakar)
-- ---------------------------------------------------------------------------
create function public.rolum()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ogretmen', exists (select 1 from public.ogretmenler where id = (select auth.uid())),
    'yonetici', private.yonetici_mi(),
    'basvuru', (select durum from public.ogretmen_basvurulari where kullanici_id = (select auth.uid())),
    'eslesmeler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sinif', s.ad,
        'ogretim_yili', s.ogretim_yili,
        'okul_no', o.okul_no,
        -- Ad yalnızca onaylı eşleşmede gösterilir (başkasının numarasını deneyen adı öğrenemesin).
        'ad_soyad', case when h.durum = 'onayli' then o.ad_soyad end,
        'durum', case
          when h.durum = 'bekliyor' then 'bekliyor'
          when exists (select 1 from public.ogrenci_hesaplari b
                       where b.ogrenci_id = h.ogrenci_id and b.durum = 'bekliyor') then 'cakisma'
          else 'onayli' end
      ) order by h.created_at)
      from public.ogrenci_hesaplari h
      join public.ogrenciler o on o.id = h.ogrenci_id
      join public.siniflar s on s.id = o.sinif_id
      where h.kullanici_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Numara eşleştirme
-- Dönüş: onayli | bekliyor | kod_yok | numara_yok | zaten_eslesti
-- ---------------------------------------------------------------------------
create function public.ogrenci_eslestir(p_sinif_kodu text, p_okul_no text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sinif bigint;
  v_ogr bigint;
  v_ad text;
  v_eposta text;
  v_durum text;
begin
  if v_uid is null then raise exception 'giris_gerekli'; end if;
  if exists (select 1 from public.ogretmenler where id = v_uid) then raise exception 'ogretmen_hesabi'; end if;

  select id into v_sinif from public.siniflar where katilim_kodu = upper(trim(p_sinif_kodu));
  if v_sinif is null then return 'kod_yok'; end if;

  if exists (select 1 from public.ogrenci_hesaplari h join public.ogrenciler o on o.id = h.ogrenci_id
             where h.kullanici_id = v_uid and o.sinif_id = v_sinif) then
    return 'zaten_eslesti';
  end if;

  select id into v_ogr from public.ogrenciler
  where sinif_id = v_sinif and okul_no = trim(p_okul_no) and aktif;
  if v_ogr is null then return 'numara_yok'; end if;

  select coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''), coalesce(email, '')
  into v_ad, v_eposta from auth.users where id = v_uid;

  v_durum := case when exists (select 1 from public.ogrenci_hesaplari where ogrenci_id = v_ogr)
                  then 'bekliyor' else 'onayli' end;
  insert into public.ogrenci_hesaplari (kullanici_id, ogrenci_id, durum, google_ad, eposta)
  values (v_uid, v_ogr, v_durum, v_ad, v_eposta);
  return v_durum;
end;
$$;

-- ---------------------------------------------------------------------------
-- Öğrencinin tüm denemeleri ve kazanım özeti (deneme listesi, denemelerim, genel durum)
-- ---------------------------------------------------------------------------
create function public.ogrenci_ozeti()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with u as (
    select u.id, u.tarih, u.son_tarih, o.id as ogrenci_id,
           d.deneme_kodu, d.baslik, d.soru_sayisi, d.sure_dk,
           (u.ogrenci_girisi and u.son_tarih > now()) as acik,
           (not u.ogrenci_girisi or u.son_tarih <= now()) as kapali
    from private.aktif_ogrencilerim() b(ogrenci_id)
    join public.ogrenciler o on o.id = b.ogrenci_id
    join public.uygulamalar u on u.sinif_id = o.sinif_id
    join public.denemeler d on d.id = u.deneme_id
  ),
  puan as (
    select cd.uygulama_id, cd.ogrenci_id,
           count(*) filter (where cd.dogru_mu) as dogru,
           count(*) filter (where cd.isaretlenen <> 'bos' and cd.dogru_mu is not true) as yanlis,
           count(*) filter (where cd.isaretlenen = 'bos') as bos
    from public.cevap_degerlendirme cd
    where cd.uygulama_id in (select id from u)
    group by cd.uygulama_id, cd.ogrenci_id
  ),
  sinif as (
    select uygulama_id, avg(dogru - yanlis / 3.0) as ortalama, count(*) as kisi
    from puan group by uygulama_id
  )
  select jsonb_build_object(
    'denemeler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'uygulama_id', u.id,
        'deneme_kodu', u.deneme_kodu,
        'baslik', u.baslik,
        'soru_sayisi', u.soru_sayisi,
        'sure_dk', u.sure_dk,
        'tarih', u.tarih,
        'son_tarih', u.son_tarih,
        'acik', u.acik,
        'kapali', u.kapali,
        'gonderildi', g.gonderildi,
        'sonuc', case when p.uygulama_id is null then null else jsonb_build_object(
          'dogru', p.dogru, 'yanlis', p.yanlis, 'bos', p.bos, 'net', p.dogru - p.yanlis / 3.0) end,
        'sinif_ortalama', si.ortalama,
        'kisi', si.kisi
      ) order by u.tarih, u.id)
      from u
      left join puan p on p.uygulama_id = u.id and p.ogrenci_id = u.ogrenci_id
      left join sinif si on si.uygulama_id = u.id
      left join public.ogrenci_gonderimleri g on g.uygulama_id = u.id and g.ogrenci_id = u.ogrenci_id
      -- Henüz uygulanmamış (açık olmayan, sonucu olmayan) denemeler gösterilmez.
      where u.acik or p.uygulama_id is not null or g.uygulama_id is not null), '[]'::jsonb),
    -- Kazanım özeti yalnızca kapanmış denemelerden (açıkken soru soru doğruluk sızmasın).
    'kazanimlar', coalesce((
      select jsonb_agg(jsonb_build_object('kod', k.kod, 'aciklama', kz.aciklama, 'dogru', k.dogru, 'toplam', k.toplam)
                       order by k.kod)
      from (
        select coalesce(cd.kazanim[1], '—') as kod,
               count(*) filter (where cd.dogru_mu) as dogru, count(*) as toplam
        from u
        join public.cevap_degerlendirme cd on cd.uygulama_id = u.id and cd.ogrenci_id = u.ogrenci_id
        where u.kapali
        group by 1
      ) k
      left join public.kazanimlar kz on kz.kod = k.kod), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Tek deneme ayrıntısı (cevap ekranı, sonuç ekranı)
-- ---------------------------------------------------------------------------
create function public.ogrenci_deneme(p_uygulama_id bigint)
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

  select u.id, u.tarih, u.son_tarih, u.ogrenci_girisi, d.deneme_kodu, d.baslik, d.soru_sayisi, d.sure_dk
  into v_u
  from public.uygulamalar u join public.denemeler d on d.id = u.deneme_id
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

-- ---------------------------------------------------------------------------
-- Öğrenci gönderimi
-- ---------------------------------------------------------------------------
create function public.ogrenci_gonder(p_uygulama_id bigint, p_cevaplar text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ogr bigint;
  v_acik boolean;
  v_soru_sayisi int;
  v_sonuc bigint;
begin
  select b.ogrenci_id, (u.ogrenci_girisi and u.son_tarih > now()), d.soru_sayisi
  into v_ogr, v_acik, v_soru_sayisi
  from private.aktif_ogrencilerim() b(ogrenci_id)
  join public.ogrenciler o on o.id = b.ogrenci_id
  join public.uygulamalar u on u.sinif_id = o.sinif_id
  join public.denemeler d on d.id = u.deneme_id
  where u.id = p_uygulama_id;
  if v_ogr is null then raise exception 'erisim_yok'; end if;
  if not v_acik then raise exception 'sure_doldu'; end if;
  if coalesce(array_length(p_cevaplar, 1), 0) <> v_soru_sayisi then raise exception 'eksik_cevap'; end if;
  if exists (select 1 from unnest(p_cevaplar) c where c is null or c not in ('A', 'B', 'C', 'D', 'bos')) then
    raise exception 'gecersiz_cevap';
  end if;

  insert into public.ogrenci_gonderimleri (uygulama_id, ogrenci_id, kullanici_id, cevaplar)
  values (p_uygulama_id, v_ogr, v_uid, p_cevaplar)
  on conflict (uygulama_id, ogrenci_id) do nothing;
  if not found then raise exception 'zaten_gonderildi'; end if;

  -- Öğretmen bu öğrenciyi daha önce girdiyse (optik/elle) onun girişi geçerli kalır.
  insert into public.sonuclar (uygulama_id, ogrenci_id, giris_yolu, onaylandi)
  values (p_uygulama_id, v_ogr, 'ogrenci', true)
  on conflict (uygulama_id, ogrenci_id) do nothing
  returning id into v_sonuc;
  if v_sonuc is not null then
    insert into public.cevaplar (sonuc_id, sira, isaretlenen)
    select v_sonuc, i, p_cevaplar[i] from generate_subscripts(p_cevaplar, 1) as i;
  end if;

  return public.ogrenci_deneme(p_uygulama_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler: fonksiyonlar yalnızca giriş yapmış kullanıcıya açık
-- ---------------------------------------------------------------------------
revoke execute on function public.ogretmen_basvur(text, text) from public, anon;
revoke execute on function public.basvuru_karar(uuid, boolean) from public, anon;
revoke execute on function public.rolum() from public, anon;
revoke execute on function public.ogrenci_eslestir(text, text) from public, anon;
revoke execute on function public.ogrenci_ozeti() from public, anon;
revoke execute on function public.ogrenci_deneme(bigint) from public, anon;
revoke execute on function public.ogrenci_gonder(bigint, text[]) from public, anon;
grant execute on function public.ogretmen_basvur(text, text) to authenticated;
grant execute on function public.basvuru_karar(uuid, boolean) to authenticated;
grant execute on function public.rolum() to authenticated;
grant execute on function public.ogrenci_eslestir(text, text) to authenticated;
grant execute on function public.ogrenci_ozeti() to authenticated;
grant execute on function public.ogrenci_deneme(bigint) to authenticated;
grant execute on function public.ogrenci_gonder(bigint, text[]) to authenticated;
