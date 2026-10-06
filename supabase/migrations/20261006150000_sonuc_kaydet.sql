-- Bir öğrencinin bir uygulamadaki cevaplarını tek işlemde (transaction) kaydeder.
-- Optik okuma bunu kullanır; elle giriş de kullanabilir.
--   * security invoker: RLS geçerli. Öğretmen yalnızca kendi sınıfının uygulamasına ve
--     o sınıftaki öğrenciye yazabilir (sonuclar politikası öğrenci–uygulama sınıf eşleşmesini de denetler).
--   * Kayıt zaten varsa ve p_uzerine_yaz false ise 'zaten_kayitli' hatası verir; hiçbir şey yazmaz.
--   * Cevap sayısı denemenin soru sayısına eşit olmalı.
create function public.sonuc_kaydet(
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
  v_adet int := coalesce(array_length(p_cevaplar, 1), 0);
begin
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

  select id into v_id from public.sonuclar
  where uygulama_id = p_uygulama_id and ogrenci_id = p_ogrenci_id
  for update;
  if v_id is not null and not p_uzerine_yaz then
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

revoke execute on function public.sonuc_kaydet(bigint, bigint, text[], text, boolean) from anon, public;
grant execute on function public.sonuc_kaydet(bigint, bigint, text[], text, boolean) to authenticated;
