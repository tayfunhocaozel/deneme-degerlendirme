-- Güvenlik denetimi uyarısı: sinif_benim() public şemada olduğu için
-- /rest/v1/rpc/sinif_benim adresinden çağrılabiliyor. Yalnızca RLS politikalarında
-- kullanıldığı için API'ye açık olmayan private şemasına taşınır.
-- Politikalar fonksiyona adıyla değil kimliğiyle bağlı olduğu için çalışmaya devam eder.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.sinif_benim(bigint) set schema private;
