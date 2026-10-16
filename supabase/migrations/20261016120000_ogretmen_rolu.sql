-- Öğretmen rolü: yalnızca davetle eklenen hesaplar öğretmen olur.
--
-- Neden: Google ile giriş açıldı ve kayıt (sign up) öğrenciler için açık kalmak zorunda.
-- Önceden auth.users'a eklenen her hesap otomatik öğretmen satırı alıyordu ve
-- katalog (cevap anahtarları dahil) giriş yapmış herkese açıktı.
--
-- Bundan sonra:
--   * Öğretmen = public.ogretmenler'de satırı olan hesap. Satır yalnızca hesap
--     panelden davet edildiğinde (auth.users.invited_at dolu) açılır. Var olan
--     öğretmen satırlarına dokunulmaz.
--   * Diğer hesaplar (Google ya da e-postayla kendi açanlar) hiçbir tabloyu göremez.
--     Öğrenci erişimi, öğrenci girişi yapılırken ayrıca tanımlanacak.
--   * Daha önce kendi açılmış bir hesabı öğretmen yapmak için SQL Editor'da:
--       insert into public.ogretmenler (id, ad_soyad)
--       select id, '' from auth.users where email = '...';

-- ---------------------------------------------------------------------------
-- Tetikleyici: yalnızca davetli hesaba öğretmen satırı
-- ---------------------------------------------------------------------------
drop trigger auth_kullanici_eklendi on auth.users;
drop function public.yeni_ogretmen();

create function private.davetliyi_ogretmen_yap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ogretmenler (id, ad_soyad)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'ad_soyad',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Davet, kullanıcıyı ekledikten sonra invited_at'i ayrıca yazabilir; iki durumu da yakala.
create trigger davetli_eklendi
  after insert on auth.users
  for each row when (new.invited_at is not null)
  execute function private.davetliyi_ogretmen_yap();

create trigger davetli_guncellendi
  after update of invited_at on auth.users
  for each row when (new.invited_at is not null and old.invited_at is distinct from new.invited_at)
  execute function private.davetliyi_ogretmen_yap();

-- ---------------------------------------------------------------------------
-- Rol denetimi
-- ---------------------------------------------------------------------------
create function private.ogretmen_mi()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ogretmenler where id = (select auth.uid()));
$$;

revoke execute on function private.ogretmen_mi() from public, anon;
grant execute on function private.ogretmen_mi() to authenticated;

-- ---------------------------------------------------------------------------
-- Katalog yalnızca öğretmene açık (cevap anahtarı deneme_sorulari.cevap'ta)
-- ---------------------------------------------------------------------------
drop policy "katalog okunur" on public.kazanimlar;
drop policy "katalog okunur" on public.denemeler;
drop policy "katalog okunur" on public.deneme_sorulari;

create policy "katalog ogretmene acik" on public.kazanimlar
  for select to authenticated using ((select private.ogretmen_mi()));
create policy "katalog ogretmene acik" on public.denemeler
  for select to authenticated using ((select private.ogretmen_mi()));
create policy "katalog ogretmene acik" on public.deneme_sorulari
  for select to authenticated using ((select private.ogretmen_mi()));

-- ---------------------------------------------------------------------------
-- Sınıf açmak yalnızca öğretmene (yabancı anahtar zaten engelliyordu; açıkça yazılır)
-- ---------------------------------------------------------------------------
drop policy "kendi siniflari" on public.siniflar;

create policy "kendi siniflari" on public.siniflar
  for all to authenticated
  using (ogretmen_id = (select auth.uid()))
  with check (ogretmen_id = (select auth.uid()) and (select private.ogretmen_mi()));

-- ogrenciler, uygulamalar, sonuclar, cevaplar: sinif_benim() üzerinden sınıfa bağlı;
-- sınıfı olmayan hesap hiçbir satır göremez, değişiklik gerekmez.
