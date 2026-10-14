# Kullanım: python -I test/optik_v2_uret.py <300dpi gri sayfa.png> <optik_sablon_v2.json> test/goruntu
# Sayfa görüntüsü Deneme_05_M8121_Optik.pdf'ten PyMuPDF ile 300 dpi gri alınır. Çıktı: v2_*.jpg ve gercek_v2.json
# (gercek.json ile birleştirilir; test/goruntu/ git dışıdır).
# Deneme 5 (şablon v2) optik PDF'inden doldurulmuş, bozulmuş test fotoğrafları üretir.
import json, sys
import cv2, numpy as np

SAYFA = sys.argv[1]   # 300 dpi gri sayfa görüntüsü
SABLON = sys.argv[2]  # optik_sablon_v2.json
CIKTI = sys.argv[3]   # test/goruntu klasörü

rng = np.random.default_rng(7)
s = json.load(open(SABLON, encoding="utf-8"))
sayfa = cv2.imread(SAYFA, cv2.IMREAD_GRAYSCALE)
PXMM = 300 / 25.4
FG, FY = s["form_boyutu"]
R = s["baloncuk_yaricap"]


def form_koken(c, r):
    return (5 + c * FG, 5 + r * FY)


def doldur(img, c, r, no, cevaplar, hayalet=None):
    ox, oy = form_koken(c, r)
    def nokta(x, y, gri, oran=0.8):
        cx, cy = int(round((ox + x) * PXMM)), int(round((oy + y) * PXMM))
        rr = int(R * oran * PXMM)
        cv2.circle(img, (cx + int(rng.integers(-2, 3)), cy + int(rng.integers(-2, 3))), rr, int(gri), -1, cv2.LINE_AA)
    for i, ch in enumerate(no):
        if ch != " ":
            x, y = s["ogrenci_no"]["baloncuklar"][i][int(ch)]
            nokta(x, y, rng.integers(40, 90))
    for i, ch in enumerate(cevaplar):
        if ch in "ABCD":
            x, y = s["cevaplar"]["baloncuklar"][i]["ABCD".index(ch)]
            nokta(x, y, rng.integers(40, 90))
        elif ch == "*":  # iki şık
            for k in (0, 2):
                x, y = s["cevaplar"]["baloncuklar"][i][k]
                nokta(x, y, 60)
    if hayalet:  # silinmiş silik iz
        i, k = hayalet
        x, y = s["cevaplar"]["baloncuklar"][i][k]
        nokta(x, y, 215, 0.75)


def rastgele_cevap(bos=0):
    c = list(rng.choice(list("ABCD"), 20))
    for i in rng.choice(20, bos, replace=False):
        c[i] = "-"
    return "".join(c)


def fotograf(img, bolge_mm, hedef_px, egim=0.0, aci=0.0, zemin=90, golge=False, bulanik=0, jpeg=85):
    """bolge_mm: (x0, y0, x1, y1) sayfada kırpılacak alan. Kâğıdı koyu zemine perspektifle oturtur."""
    x0, y0, x1, y1 = [int(v * PXMM) for v in bolge_mm]
    kag = img[y0:y1, x0:x1]
    h, w = kag.shape
    olcek = hedef_px / w
    W, H = int(w * olcek * 1.35), int(h * olcek * 1.35)
    cx, cy = W / 2, H / 2
    kw, kh = w * olcek / 2, h * olcek / 2
    hedef = np.float32([[-kw, -kh], [kw, -kh], [kw, kh], [-kw, kh]])
    a = np.deg2rad(aci)
    rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
    hedef = hedef @ rot.T
    hedef[:2, 0] *= 1 - egim  # üst kenar kısalır (perspektif)
    hedef += [cx, cy]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), np.float32(hedef))
    zem = np.clip(rng.normal(zemin, 12, (H, W)), 0, 255).astype(np.uint8)
    foto = cv2.warpPerspective(kag, M, (W, H), borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    maske = cv2.warpPerspective(np.full_like(kag, 255), M, (W, H))
    foto = np.where(maske > 127, foto, zem).astype(np.float32)
    if golge:
        gx = np.linspace(0.55, 1.0, W)[None, :]
        foto *= gx
    foto += rng.normal(0, 4, foto.shape)
    foto = np.clip(foto, 0, 255).astype(np.uint8)
    if bulanik:
        foto = cv2.GaussianBlur(foto, (0, 0), bulanik)
    return foto


gercek = {}
ornekler = [
    # ad, form (c, r), no, bos sayısı, foto ayarları, hayalet
    ("v2_01_duz", (0, 0), "00012", 0, dict(hedef_px=1400), None),
    ("v2_02_egik", (1, 0), "12345", 1, dict(hedef_px=1300, egim=0.12, aci=6), None),
    ("v2_03_ters_egik", (0, 1), "  512", 1, dict(hedef_px=1300, egim=0.08, aci=-8), None),
    ("v2_04_golge", (1, 1), "07070", 0, dict(hedef_px=1400, golge=True), None),
    ("v2_05_bulanik", (0, 2), "40404", 2, dict(hedef_px=1400, bulanik=1.6), None),
    ("v2_06_dusuk_cozunurluk", (1, 2), "99999", 0, dict(hedef_px=760), None),
    ("v2_07_silinti_izi", (0, 0), "31415", 0, dict(hedef_px=1400, aci=3), "hayalet"),
]
for ad, (c, r), no, bos, ayar, hay in ornekler:
    img = sayfa.copy()
    cev = rastgele_cevap(bos)
    hayalet = None
    if hay:
        i = 17  # 18. soru: asıl işaretin yanında silik iz
        k = ("ABCD".index(cev[i]) + 1) % 4
        hayalet = (i, k)
    doldur(img, c, r, no, cev, hayalet)
    ox, oy = form_koken(c, r)
    foto = fotograf(img, (ox, oy, ox + FG, oy + FY), **ayar)
    open(f"{CIKTI}/{ad}.jpg", "wb").write(cv2.imencode(".jpg", foto, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes())
    gercek[ad] = {"form": [c, r], "no": no, "cevaplar": cev}

# Tüm sayfa: altı form birlikte, hafif eğik (komşu formlar karışmamalı)
img = sayfa.copy()
cevaplar = {}
for r in range(3):
    for c in range(2):
        cevaplar[(c, r)] = (f"{c}{r}{c}{r}1", rastgele_cevap(1))
        doldur(img, c, r, *cevaplar[(c, r)])
c, r = 1, 1
ox, oy = form_koken(c, r)
foto = fotograf(img, (ox - 5, oy - 30, ox + FG + 5, oy + FY + 30), hedef_px=2000, egim=0.06, aci=2)
open(f"{CIKTI}/v2_08_sayfa_komsular.jpg", "wb").write(cv2.imencode(".jpg", foto, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes())
gercek["v2_08_sayfa_komsular"] = {"form": [c, r], "no": cevaplar[(c, r)][0], "cevaplar": cevaplar[(c, r)][1]}

json.dump(gercek, open(f"{CIKTI}/gercek_v2.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(gercek, ensure_ascii=False))
