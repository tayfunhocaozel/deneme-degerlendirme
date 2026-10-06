-- Deneme Değerlendirme Platformu: ilk şema (1. aşama)
-- Proje: deneme-degerlendirme (ihucakamyxyulodwqsmm, eu-central-1)
--
-- İki tür tablo var:
--   * Ortak katalog (denemeler, deneme_sorulari, kazanimlar): yalnızca soru üretim
--     tarafı deneme_aktar() ile service_role olarak yazar; giriş yapmış her öğretmen okur.
--   * Öğretmene ait veri (siniflar, ogrenciler, uygulamalar, sonuclar, cevaplar):
--     her öğretmen yalnızca kendi sınıflarına bağlı satırları görür ve değiştirir.

-- ---------------------------------------------------------------------------
-- Öğretmenler
-- ---------------------------------------------------------------------------
create table public.ogretmenler (
  id          uuid primary key references auth.users (id) on delete cascade,
  ad_soyad    text not null default '',
  created_at  timestamptz not null default now()
);

-- Auth'a yeni kullanıcı eklenince öğretmen satırı otomatik açılır.
create function public.yeni_ogretmen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ogretmenler (id, ad_soyad)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'ad_soyad', ''));
  return new;
end;
$$;

create trigger auth_kullanici_eklendi
  after insert on auth.users
  for each row execute function public.yeni_ogretmen();

-- ---------------------------------------------------------------------------
-- Ortak katalog: denemeler (70_Veri/*.json anlık görüntüsü)
-- ---------------------------------------------------------------------------
create table public.kazanimlar (
  kod       text primary key,              -- M.8.1.1.1
  aciklama  text not null
);

create table public.denemeler (
  id              bigint generated always as identity primary key,
  deneme_kodu     text not null,           -- 8-D04
  surum           int  not null default 1,
  sema_surumu     int  not null,
  sinif           int  not null check (sinif between 1 and 12),
  tur             text not null default 'deneme',
  baslik          text not null,
  sure_dk         int,
  soru_sayisi     int  not null check (soru_sayisi > 0),
  uretim_zamani   timestamptz not null,
  aktarim_zamani  timestamptz not null default now(),
  unique (deneme_kodu, surum)
);

create table public.deneme_sorulari (
  deneme_id     bigint not null references public.denemeler (id) on delete cascade,
  sira          int    not null check (sira > 0),
  soru_id       text   not null,           -- 01-064 (banka kimliği, yalnızca bilgi)
  konu_no       text,
  konu          text,
  kazanim       text[] not null default '{}',
  bloom         text,
  pisa          text,
  gucluk        text check (gucluk in ('kolay', 'orta', 'zor')),
  cevap         text   not null check (cevap in ('A', 'B', 'C', 'D')),
  ozet          text,
  secenekler    jsonb  not null default '{}',
  celdiriciler  jsonb  not null default '{}',
  grup          text,
  primary key (deneme_id, sira)
);

-- ---------------------------------------------------------------------------
-- Öğretmene ait veri
-- ---------------------------------------------------------------------------
create table public.siniflar (
  id            bigint generated always as identity primary key,
  ogretmen_id   uuid not null default auth.uid() references public.ogretmenler (id) on delete cascade,
  ad            text not null,             -- 8/A
  sinif_duzeyi  int  not null check (sinif_duzeyi between 1 and 12),
  ogretim_yili  text not null,             -- 2026-2027
  aciklama      text,
  created_at    timestamptz not null default now()
);
create index on public.siniflar (ogretmen_id);

create table public.ogrenciler (
  id          bigint generated always as identity primary key,
  sinif_id    bigint not null references public.siniflar (id) on delete cascade,
  okul_no     text   not null,
  ad_soyad    text   not null,
  aktif       boolean not null default true, -- sınıftan ayrılan öğrenci silinmez, sonuçları kalır
  created_at  timestamptz not null default now(),
  unique (sinif_id, okul_no)
);

-- Bir denemenin bir sınıfta uygulanması. deneme_id belirli bir sürümü gösterir;
-- banka sonradan değişse de sonuçlar bu sürümün cevap anahtarıyla değerlendirilir.
create table public.uygulamalar (
  id          bigint generated always as identity primary key,
  sinif_id    bigint not null references public.siniflar (id) on delete cascade,
  deneme_id   bigint not null references public.denemeler (id) on delete restrict,
  tarih       date   not null default current_date,
  created_at  timestamptz not null default now()
);
create index on public.uygulamalar (sinif_id);

-- Bir öğrencinin bir uygulamadaki cevap kâğıdı (elle girilmiş ya da optikle okunmuş).
create table public.sonuclar (
  id             bigint generated always as identity primary key,
  uygulama_id    bigint not null references public.uygulamalar (id) on delete cascade,
  ogrenci_id     bigint not null references public.ogrenciler (id) on delete cascade,
  giris_yolu     text   not null default 'elle' check (giris_yolu in ('elle', 'optik')),
  onaylandi      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (uygulama_id, ogrenci_id)   -- aynı öğrenci aynı uygulamaya ikinci kez giremez
);

create table public.cevaplar (
  sonuc_id     bigint not null references public.sonuclar (id) on delete cascade,
  sira         int    not null check (sira > 0),
  isaretlenen  text   not null check (isaretlenen in ('A', 'B', 'C', 'D', 'bos', 'gecersiz')),
  primary key (sonuc_id, sira)
);

-- ---------------------------------------------------------------------------
-- Değerlendirme görünümü: doğru/yanlış saklanmaz, anlık görüntüden hesaplanır.
-- ---------------------------------------------------------------------------
create view public.cevap_degerlendirme
with (security_invoker = true) as
select
  s.id            as sonuc_id,
  u.id            as uygulama_id,
  u.sinif_id,
  s.ogrenci_id,
  u.deneme_id,
  c.sira,
  c.isaretlenen,
  ds.cevap        as dogru_cevap,
  case
    when c.isaretlenen in ('bos', 'gecersiz') then null
    else c.isaretlenen = ds.cevap
  end             as dogru_mu,
  case
    when c.isaretlenen in ('A', 'B', 'C', 'D') and c.isaretlenen <> ds.cevap
    then ds.celdiriciler ->> c.isaretlenen
  end             as yanilgi,
  ds.soru_id,
  ds.kazanim,
  ds.bloom,
  ds.pisa,
  ds.gucluk
from public.cevaplar c
join public.sonuclar s         on s.id = c.sonuc_id
join public.uygulamalar u      on u.id = s.uygulama_id
join public.deneme_sorulari ds on ds.deneme_id = u.deneme_id and ds.sira = c.sira;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ogretmenler     enable row level security;
alter table public.kazanimlar      enable row level security;
alter table public.denemeler       enable row level security;
alter table public.deneme_sorulari enable row level security;
alter table public.siniflar        enable row level security;
alter table public.ogrenciler      enable row level security;
alter table public.uygulamalar     enable row level security;
alter table public.sonuclar        enable row level security;
alter table public.cevaplar        enable row level security;

-- Öğretmen yalnızca kendi satırını görür ve adını değiştirir.
create policy "kendi kaydi okunur" on public.ogretmenler
  for select to authenticated using (id = (select auth.uid()));
create policy "kendi kaydi guncellenir" on public.ogretmenler
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Katalog: giriş yapmış herkes okur, kimse yazamaz (yalnızca service_role).
create policy "katalog okunur" on public.kazanimlar
  for select to authenticated using (true);
create policy "katalog okunur" on public.denemeler
  for select to authenticated using (true);
create policy "katalog okunur" on public.deneme_sorulari
  for select to authenticated using (true);

-- Sınıflar: sahibi her şeyi yapar.
create policy "kendi siniflari" on public.siniflar
  for all to authenticated
  using (ogretmen_id = (select auth.uid()))
  with check (ogretmen_id = (select auth.uid()));

-- Alt tablolar: bağlı olduğu sınıf öğretmene aitse.
create function public.sinif_benim(p_sinif_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.siniflar
    where id = p_sinif_id and ogretmen_id = (select auth.uid())
  );
$$;

create policy "kendi ogrencileri" on public.ogrenciler
  for all to authenticated
  using (public.sinif_benim(sinif_id))
  with check (public.sinif_benim(sinif_id));

create policy "kendi uygulamalari" on public.uygulamalar
  for all to authenticated
  using (public.sinif_benim(sinif_id))
  with check (public.sinif_benim(sinif_id));

create policy "kendi sonuclari" on public.sonuclar
  for all to authenticated
  using (exists (
    select 1 from public.uygulamalar u
    where u.id = uygulama_id and public.sinif_benim(u.sinif_id)))
  with check (
    exists (
      select 1 from public.uygulamalar u
      where u.id = uygulama_id and public.sinif_benim(u.sinif_id))
    -- öğrenci ile uygulama aynı sınıftan olmalı
    and exists (
      select 1 from public.uygulamalar u
      join public.ogrenciler o on o.sinif_id = u.sinif_id
      where u.id = uygulama_id and o.id = ogrenci_id));

create policy "kendi cevaplari" on public.cevaplar
  for all to authenticated
  using (exists (
    select 1 from public.sonuclar s
    join public.uygulamalar u on u.id = s.uygulama_id
    where s.id = sonuc_id and public.sinif_benim(u.sinif_id)))
  with check (exists (
    select 1 from public.sonuclar s
    join public.uygulamalar u on u.id = s.uygulama_id
    where s.id = sonuc_id and public.sinif_benim(u.sinif_id)));

-- ---------------------------------------------------------------------------
-- Deneme aktarma: soru üretim tarafı onaylanan denemeyi bu fonksiyonla yazar.
-- Girdi, proje tanımındaki veri dosyası biçimidir (sema_surumu 1).
-- Aynı deneme_kodu + surum tekrar gelirse günceller; ancak o sürüm bir sınıfta
-- uygulanmışsa reddeder (anlık görüntü bozulmasın, sürüm artırılmalı).
-- Yalnızca service_role çağırabilir.
-- ---------------------------------------------------------------------------
create function public.deneme_aktar(veri jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id    bigint;
  v_kod   text := veri ->> 'deneme_kodu';
  v_surum int  := coalesce((veri ->> 'surum')::int, 1);
  v_adet  int;
begin
  if (veri ->> 'sema_surumu')::int is distinct from 1 then
    raise exception 'Bilinmeyen sema_surumu: %', veri ->> 'sema_surumu';
  end if;
  if v_kod is null or jsonb_typeof(veri -> 'sorular') is distinct from 'array' then
    raise exception 'deneme_kodu ve sorular zorunlu';
  end if;

  select id into v_id from public.denemeler
  where deneme_kodu = v_kod and surum = v_surum;

  if v_id is not null then
    if exists (select 1 from public.uygulamalar where deneme_id = v_id) then
      raise exception '% sürüm % bir sınıfta uygulanmış; değişiklik için sürümü artırın', v_kod, v_surum;
    end if;
    update public.denemeler set
      sema_surumu    = (veri ->> 'sema_surumu')::int,
      sinif          = (veri ->> 'sinif')::int,
      tur            = coalesce(veri ->> 'tur', 'deneme'),
      baslik         = veri ->> 'baslik',
      sure_dk        = (veri ->> 'sure_dk')::int,
      soru_sayisi    = (veri ->> 'soru_sayisi')::int,
      uretim_zamani  = (veri ->> 'uretim_zamani')::timestamptz,
      aktarim_zamani = now()
    where id = v_id;
    delete from public.deneme_sorulari where deneme_id = v_id;
  else
    insert into public.denemeler
      (deneme_kodu, surum, sema_surumu, sinif, tur, baslik, sure_dk, soru_sayisi, uretim_zamani)
    values
      (v_kod, v_surum, (veri ->> 'sema_surumu')::int, (veri ->> 'sinif')::int,
       coalesce(veri ->> 'tur', 'deneme'), veri ->> 'baslik', (veri ->> 'sure_dk')::int,
       (veri ->> 'soru_sayisi')::int, (veri ->> 'uretim_zamani')::timestamptz)
    returning id into v_id;
  end if;

  insert into public.deneme_sorulari
    (deneme_id, sira, soru_id, konu_no, konu, kazanim, bloom, pisa, gucluk,
     cevap, ozet, secenekler, celdiriciler, grup)
  select
    v_id,
    (s ->> 'sira')::int,
    s ->> 'soru_id',
    s ->> 'konu_no',
    s ->> 'konu',
    coalesce(array(select jsonb_array_elements_text(s -> 'kazanim')), '{}'),
    s ->> 'bloom',
    s ->> 'pisa',
    s ->> 'gucluk',
    s ->> 'cevap',
    s ->> 'ozet',
    coalesce(s -> 'secenekler', '{}'),
    coalesce(s -> 'celdiriciler', '{}'),
    s ->> 'grup'
  from jsonb_array_elements(veri -> 'sorular') s;

  select count(*) into v_adet from public.deneme_sorulari where deneme_id = v_id;
  if v_adet <> (veri ->> 'soru_sayisi')::int then
    raise exception 'soru_sayisi % ama % soru geldi', veri ->> 'soru_sayisi', v_adet;
  end if;

  insert into public.kazanimlar (kod, aciklama)
  select key, value from jsonb_each_text(coalesce(veri -> 'kazanimlar', '{}'))
  on conflict (kod) do update set aciklama = excluded.aciklama;

  return v_id;
end;
$$;

revoke execute on function public.deneme_aktar(jsonb) from anon, authenticated, public;
grant execute on function public.deneme_aktar(jsonb) to service_role;

-- anon rolü hiçbir tabloya erişemez (politika yok); fonksiyonu da çağıramaz.
revoke execute on function public.sinif_benim(bigint) from anon, public;
grant execute on function public.sinif_benim(bigint) to authenticated;
revoke execute on function public.yeni_ogretmen() from anon, authenticated, public;
