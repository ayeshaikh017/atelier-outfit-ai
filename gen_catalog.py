"""Generates the demo brand catalog (catalog.json) + garment SVGs (static/garments/).
Run:  python gen_catalog.py      (already run once; re-run only if you edit the list)"""
import json, os

BRAND = "Urban Loom"   # <- assumed brand name, change here
OUT = os.path.join("static", "garments"); os.makedirs(OUT, exist_ok=True)

SHAPES = {
 "tee":    "M60 20 L20 55 L45 80 L62 68 L62 220 L138 220 L138 68 L155 80 L180 55 L140 20 Q100 48 60 20 Z",
 "long":   "M60 20 L10 70 L10 200 L35 200 L45 100 L62 90 L62 220 L138 220 L138 90 L155 100 L165 200 L190 200 L190 70 L140 20 Q100 48 60 20 Z",
 "hoodie": "M55 28 L10 70 L10 205 L38 205 L45 105 L58 95 L58 225 L142 225 L142 95 L155 105 L162 205 L190 205 L190 70 L145 28 Q100 5 55 28 Z",
 "jacket": "M58 22 L8 70 L8 205 L36 205 L46 105 L60 95 L60 225 L97 225 L97 40 L103 40 L103 225 L140 225 L140 95 L154 105 L164 205 L192 205 L192 70 L142 22 Q100 50 58 22 Z",
 "jeans":  "M55 10 H145 L158 235 H108 L100 95 L92 235 H42 Z",
 "chino":  "M58 10 H142 L152 235 H106 L100 95 L94 235 H48 Z",
 "shorts": "M55 10 H145 L158 120 H108 L100 70 L92 120 H42 Z",
 "skirt":  "M62 10 H138 L180 170 H20 Z",
 "dress":  "M72 10 L86 10 Q100 38 114 10 L128 10 L138 75 L185 235 H15 L62 75 Z",
}
# id, name, cat, shape, colour, price(INR), style, occasions
ITEMS = [
 ("UL-T01","Classic Crew Tee","Top","tee","#F2F2F2",799,"Casual","College,Casual"),
 ("UL-T02","Sage Boxy Tee","Top","tee","#7FA38F",899,"Streetwear","Casual,Party"),
 ("UL-T03","Navy Long Sleeve","Top","long","#22304F",1199,"Smart Casual","Office,College"),
 ("UL-T04","Blush Long Sleeve","Top","long","#F0A99B",1199,"Casual","Casual,Party"),
 ("UL-T05","Charcoal Hoodie","Top","hoodie","#3A3F44",1799,"Streetwear","College,Casual"),
 ("UL-T06","Mustard Hoodie","Top","hoodie","#D9A441",1799,"Streetwear","Casual,Party"),
 ("UL-B01","Indigo Slim Jeans","Bottom","jeans","#2F4A75",1999,"Casual","College,Casual,Party"),
 ("UL-B02","Black Straight Jeans","Bottom","jeans","#1E1E22",2099,"Casual","Party,Casual"),
 ("UL-B03","Khaki Chinos","Bottom","chino","#B59F7A",1799,"Smart Casual","Office,College"),
 ("UL-B04","Olive Chinos","Bottom","chino","#6B7348",1799,"Smart Casual","Office,Casual"),
 ("UL-B05","Denim Shorts","Bottom","shorts","#5E82B3",1299,"Casual","Casual,College"),
 ("UL-B06","Plum Mini Skirt","Bottom","skirt","#7A3E5C",1399,"Party","Party,Casual"),
 ("UL-D01","Rose Midi Dress","Dress","dress","#E58E9B",2799,"Party","Party,Wedding"),
 ("UL-D02","Midnight Dress","Dress","dress","#1D2A4A",2999,"Formal","Party,Office"),
 ("UL-D03","Emerald Dress","Dress","dress","#2E7D5B",2899,"Party","Party,Wedding"),
 ("UL-J01","Black Bomber Jacket","Jacket","jacket","#25262B",3499,"Streetwear","Casual,Party"),
 ("UL-J02","Tan Overshirt Jacket","Jacket","jacket","#C19A6B",3299,"Smart Casual","Office,Casual"),
 ("UL-J03","Denim Jacket","Jacket","jacket","#4F6D9A",2999,"Casual","College,Casual"),
]
def darker(h, f=.72):
    r,g,b = (int(h[i:i+2],16) for i in (1,3,5)); return "#%02x%02x%02x" % (int(r*f),int(g*f),int(b*f))

cat = []
for iid,name,c,shape,col,price,style,occ in ITEMS:
    d, dk = SHAPES[shape], darker(col)
    extra = ""
    if shape in ("tee","long"):   extra = f'<path d="M80 22 Q100 52 120 22" fill="none" stroke="{dk}" stroke-width="5"/>'
    if shape == "hoodie":         extra = f'<path d="M80 30 Q100 70 120 30" fill="none" stroke="{dk}" stroke-width="6"/><path d="M90 60 V100 M110 60 V100" stroke="{dk}" stroke-width="3"/>'
    if shape == "jacket":         extra = f'<path d="M100 40 V225" stroke="{dk}" stroke-width="3"/>'
    if shape in ("jeans","chino","shorts","skirt"): extra = f'<rect x="{55 if shape!="skirt" else 62}" y="10" width="{90 if shape!="skirt" else 76}" height="12" fill="{dk}" opacity=".6"/>'
    if shape == "dress":          extra = f'<path d="M62 75 H138" stroke="{dk}" stroke-width="5"/>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">'
           f'<path d="{d}" fill="{col}" stroke="{dk}" stroke-width="3" stroke-linejoin="round"/>{extra}</svg>')
    fn = f"{iid}.svg"; open(os.path.join(OUT, fn), "w").write(svg)
    cat.append(dict(id=iid, brand=BRAND, name=name, cat=c, color=col, price=price,
                    style=style, occ=occ.split(","), sizes=["S","M","L","XL"], image=fn))
json.dump(dict(brand=BRAND, items=cat), open("catalog.json","w"), indent=2)
print("OK:", len(cat), "items")
