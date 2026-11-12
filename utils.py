import cv2, itertools, colorsys
import numpy as np
from scipy.stats import entropy
from skimage.feature import hog
from skimage.color import rgb2lab
from sklearn.cluster import KMeans
from sklearn.naive_bayes import MultinomialNB
from sklearn.preprocessing import OneHotEncoder

# ---------- Fashion-MNIST labels ----------
CLASSES = ["T-shirt", "Trouser", "Pullover", "Dress", "Coat",
           "Sandal", "Shirt", "Sneaker", "Bag", "Ankle boot"]
ZONE_CLASSES = {
    "top":    ["T-shirt", "Pullover", "Coat", "Shirt"],   # Dress hata diya
    "bottom": ["Trouser"],
    "shoes":  ["Sandal", "Sneaker", "Ankle boot"],
}

# ---------- Preprocessing ----------
def split_zones(img):
    h = img.shape[0]
    return {"top":    img[int(.12*h):int(.50*h), :],
            "bottom": img[int(.50*h):int(.85*h), :],
            "shoes":  img[int(.85*h):, :]}

def to_fmnist(crop):
    """Convert a real photo crop to Fashion-MNIST style 28x28 (white object on black)."""
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    g = cv2.GaussianBlur(g, (5, 5), 0)
    _, m = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    border = np.concatenate([m[0], m[-1], m[:, 0], m[:, -1]])
    if border.mean() > 127:          # background should be black
        m = 255 - m
    ys, xs = np.where(m > 0)
    if len(ys) < 20:
        return np.zeros((28, 28), np.uint8)
    m = m[ys.min():ys.max()+1, xs.min():xs.max()+1]
    s = max(m.shape)
    pad = np.zeros((s, s), np.uint8)
    y0, x0 = (s-m.shape[0])//2, (s-m.shape[1])//2
    pad[y0:y0+m.shape[0], x0:x0+m.shape[1]] = m
    return cv2.GaussianBlur(cv2.resize(pad, (28, 28)), (3, 3), 0)

def extract(img28):
    return hog(img28, orientations=9, pixels_per_cell=(7, 7), cells_per_block=(2, 2))

# ---------- Colour ----------
NAMED = {
    "White": (245,245,245), "Black": (20,20,20), "Grey": (128,128,128),
    "Beige": (222,205,175), "Navy": (25,40,95), "Denim": (70,100,155),
    "Blue": (40,90,220), "Red": (195,40,40), "Maroon": (110,25,40),
    "Green": (40,140,70), "Olive": (110,115,50), "Yellow": (235,210,60),
    "Orange": (235,130,40), "Pink": (235,150,180), "Purple": (120,60,150),
    "Brown": (115,75,40),
}
NEUTRALS = {"White", "Black", "Grey", "Beige", "Navy", "Denim"}
_LAB = {n: rgb2lab(np.array(c, float).reshape(1,1,3)/255)[0,0] for n, c in NAMED.items()}

def color_name(rgb):
    lab = rgb2lab(np.array(rgb, float).reshape(1,1,3)/255)[0,0]
    return min(_LAB, key=lambda n: np.linalg.norm(_LAB[n]-lab))

def dominant(crop, k=3):
    h, w = crop.shape[:2]
    c = crop[int(.2*h):int(.8*h), int(.3*w):int(.7*w)]          # centre -> less background
    c = cv2.cvtColor(cv2.resize(c, (60, 60)), cv2.COLOR_BGR2RGB).reshape(-1, 3)
    km = KMeans(n_clusters=k, n_init=5, random_state=0).fit(c)
    cnt = np.bincount(km.labels_, minlength=k)
    order = np.argsort(-cnt)
    return [(tuple(km.cluster_centers_[i].astype(int)), cnt[i]/cnt.sum()) for i in order]

def harmony(c1, c2):
    n1, n2 = color_name(c1), color_name(c2)
    if n1 in NEUTRALS or n2 in NEUTRALS:
        return 0.9 if n1 != n2 or n1 in {"White","Black"} else 0.7
    h = lambda c: colorsys.rgb_to_hsv(*[x/255 for x in c])[0]*360
    d = abs(h(c1)-h(c2)); d = min(d, 360-d)
    if d < 30:        return 0.80     # analogous
    if 150 < d < 210: return 0.85     # complementary
    if 100 < d < 140: return 0.70     # triadic
    return 0.45                       # clash

def harmony_label(s):
    return "Good" if s >= .75 else "Average" if s >= .55 else "Clashing"

# ---------- Style classifier (Naive Bayes) ----------
_ROWS = [
 ("tee","jeans","sneaker","neutral","Minimal"),("tee","jeans","sneaker","bright","Casual"),
 ("tee","jeans","sneaker","mixed","Casual"),("shirt","jeans","sneaker","neutral","Casual"),
 ("shirt","jeans","sneaker","mixed","Casual"),("shirt","trouser","boot","neutral","Formal"),
 ("shirt","trouser","boot","mixed","Smart Casual"),("shirt","trouser","sneaker","neutral","Smart Casual"),
 ("shirt","trouser","sandal","neutral","Smart Casual"),("coat","trouser","boot","neutral","Formal"),
 ("coat","jeans","boot","neutral","Streetwear"),("coat","jeans","sneaker","mixed","Streetwear"),
 ("coat","trouser","sneaker","neutral","Minimal"),("sweater","jeans","sneaker","neutral","Minimal"),
 ("sweater","jeans","sneaker","mixed","Casual"),("sweater","jeans","boot","neutral","Casual"),
 ("sweater","trouser","boot","neutral","Smart Casual"),("tee","trouser","sneaker","bright","Sporty"),
 ("tee","trouser","sneaker","mixed","Sporty"),("tee","jeans","sandal","bright","Casual"),
 ("tee","jeans","sandal","neutral","Minimal"),("tee","trouser","sandal","mixed","Casual"),
 ("tee","jeans","boot","bright","Streetwear"),("tee","jeans","boot","mixed","Streetwear"),
 ("dress","none","sandal","bright","Party"),("dress","none","sandal","neutral","Minimal"),
 ("dress","none","boot","neutral","Streetwear"),("dress","none","sneaker","mixed","Casual"),
 ("dress","none","sandal","mixed","Party"),("shirt","trouser","boot","bright","Party"),
]
_X = [r[:4] for r in _ROWS]; _y = [r[4] for r in _ROWS]
_enc = OneHotEncoder(handle_unknown="ignore").fit(_X)
STYLE_NB = MultinomialNB(alpha=1.0).fit(_enc.transform(_X), _y)

TOP_GROUP = {"T-shirt":"tee","Shirt":"shirt","Pullover":"sweater","Coat":"coat","Dress":"dress"}
SHOE_GROUP = {"Sneaker":"sneaker","Sandal":"sandal","Ankle boot":"boot"}
OCCASIONS = {
 "Casual": ["College","Café","Casual outing"], "Minimal": ["College","Brunch","Café"],
 "Formal": ["Interview","Office","Events"], "Smart Casual": ["Office","Dinner","Meetups"],
 "Sporty": ["Gym","Park","Sports"], "Streetwear": ["Hangout","Concert","City walk"],
 "Party": ["Party","Date night","Dinner"],
}

# ---------- Uncertainty ----------
def interpret(probs, zone):
    names = ZONE_CLASSES[zone]
    idx = [CLASSES.index(n) for n in names]
    sub = probs[idx]; mass = float(sub.sum())          # evidence that crop belongs to this zone
    p = sub/(mass+1e-9); j = int(np.argmax(p))
    conf = float(p[j]*min(1.0, mass*2))                # penalise if model thinks it's another class
    ent = float(entropy(probs)/np.log(len(probs)))     # normalised Shannon entropy (0-1)
    return dict(label=names[j], conf=conf, entropy=ent,
                status="Confident" if conf >= .5 else "Uncertain",
                dist=dict(zip(names, p.round(3))))

# ---------- Suggestions (rule-based NLP templates) ----------
def suggest(style, h, palette, shoes_label):
    tips = []
    if h < .55: tips.append("The colours clash a little. Swap one piece for a neutral like white, black or beige.")
    if palette == "bright": tips.append("Keep one bright piece and make the rest neutral so the outfit does not feel loud.")
    if style in ("Casual", "Minimal"): tips.append("Add a minimal watch or a simple chain to lift the look.")
    if style == "Formal": tips.append("Match your belt with your shoes and keep the fit crisp.")
    if style == "Smart Casual": tips.append("Roll the sleeves once and add a leather strap watch.")
    if style == "Sporty": tips.append("A cap and a crossbody bag will complete the athleisure look.")
    if style == "Streetwear": tips.append("Layer with a chain or a beanie and keep the sneakers clean.")
    if style == "Party": tips.append("Add a statement accessory and keep the footwear polished.")
    return " ".join(tips) or "Great outfit as it is."

# ---------- Full pipeline ----------
def analyze(img_bgr, clf):
    img = cv2.resize(img_bgr, (400, int(img_bgr.shape[0]*400/img_bgr.shape[1])))
    out = {}
    for z, crop in split_zones(img).items():
        probs = clf.predict_proba([extract(to_fmnist(crop))])[0]
        r = interpret(probs, z)
        r["colors"] = dominant(crop)
        r["rgb"] = r["colors"][0][0]; r["cname"] = color_name(r["rgb"])
        out[z] = r

    t, b, s = out["top"], out["bottom"], out["shoes"]
    is_dress = t["label"] == "Dress"
    b["name"] = "Jeans" if b["cname"] in ("Denim","Blue","Navy") else f'{b["cname"]} Trousers'
    t["name"] = f'{t["cname"]} {t["label"]}'
    s["name"] = f'{s["cname"]} {s["label"]}' + ("s" if s["label"] != "Ankle boot" else "")
    bgroup = "none" if is_dress else ("jeans" if b["name"] == "Jeans" else "trouser")

    items = [t, s] if is_dress else [t, b, s]
    n_bright = sum(i["cname"] not in NEUTRALS for i in items)
    palette = "neutral" if n_bright == 0 else "mixed" if n_bright == 1 else "bright"

    feats = _enc.transform([(TOP_GROUP[t["label"]], bgroup, SHOE_GROUP[s["label"]], palette)])
    sp = STYLE_NB.predict_proba(feats)[0]
    order = np.argsort(-sp)
    style, style_conf = STYLE_NB.classes_[order[0]], float(sp[order[0]])
    style2 = STYLE_NB.classes_[order[1]]

    pairs = list(itertools.combinations(items, 2))
    h = float(np.mean([harmony(a["rgb"], c["rgb"]) for a, c in pairs]))
    cat_conf = float(np.mean([i["conf"] for i in items]))
    score = round(min(10, 10*(0.55*h + 0.2*min(1, style_conf*1.6) + 0.25*(0.5+0.5*cat_conf))), 1)

    return dict(zones=out, style=style, style2=style2, style_conf=style_conf,
                style_dist=dict(zip(STYLE_NB.classes_, sp.round(3))),
                harmony=h, harmony_label=harmony_label(h), palette=palette,
                occasions=OCCASIONS[style], score=score,
                suggestion=suggest(style, h, palette, s["name"]),
                avg_entropy=float(np.mean([i["entropy"] for i in items])), is_dress=is_dress)

# ---------- Virtual wardrobe ----------
def recommend(items, occasion, n=3):
    tops = [i for i in items if i["cat"] == "Top"]
    bots = [i for i in items if i["cat"] == "Bottom"]
    shoes = [i for i in items if i["cat"] == "Shoes"] or [None]
    res = []
    for t, b, s in itertools.product(tops, bots, shoes):
        combo = [x for x in (t, b, s) if x]
        h = np.mean([harmony(a["rgb"], c["rgb"]) for a, c in itertools.combinations(combo, 2)])
        m = np.mean([occasion in x["occ"] for x in combo])
        res.append((0.6*h + 0.4*m, h, m, combo))
    return sorted(res, key=lambda r: -r[0])[:n]