import base64, json, os
import cv2, numpy as np, joblib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import utils as U

BASE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(BASE, *a)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024   # 12 MB upload cap
CORS(app)
clf = joblib.load(P("model.joblib"))

# ---------- wardrobe persistence (simple JSON file) ----------
WFILE = P("wardrobe.json")
try: WARDROBE = json.load(open(WFILE, encoding="utf-8")) if os.path.exists(WFILE) else []
except (ValueError, OSError): WARDROBE = []
def save_wardrobe():
    tmp = WFILE + ".tmp"
    json.dump(WARDROBE, open(tmp, "w", encoding="utf-8")); os.replace(tmp, WFILE)   # atomic: no corrupt file

@app.errorhandler(413)
def too_big(e): return jsonify(error="Image too large (max 12 MB)"), 413
@app.errorhandler(Exception)
def boom(e):
    if hasattr(e, "code") and isinstance(e.code, int): return jsonify(error=getattr(e, "description", "Error")), e.code
    app.logger.exception(e); return jsonify(error="Server error while processing the image"), 500

@app.get("/api/health")
def health(): return jsonify(ok=True, wardrobe=len(WARDROBE))

def clean(o):
    """numpy -> plain python so jsonify works"""
    if isinstance(o, dict):  return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [clean(v) for v in o]
    if isinstance(o, np.generic): return o.item()
    if isinstance(o, np.ndarray): return o.tolist()
    return o

def read_img(f):
    try: return cv2.imdecode(np.frombuffer(f.read(), np.uint8), cv2.IMREAD_COLOR)
    except cv2.error: return None

def thumb(img, w=260):
    h = int(img.shape[0] * w / img.shape[1])
    ok, buf = cv2.imencode(".jpg", cv2.resize(img, (w, h)))
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()

@app.post("/api/analyze")
def analyze():
    f = request.files.get("image")
    if not f: return jsonify(error="No image uploaded"), 400
    img = read_img(f)
    if img is None: return jsonify(error="Invalid image file"), 400
    if img.shape[0] < 100 or img.shape[1] < 50: return jsonify(error="Image too small, use a full-body photo"), 400
    return jsonify(clean(U.analyze(img, clf)))

@app.get("/api/wardrobe")
def get_wardrobe():
    return jsonify(WARDROBE)

@app.post("/api/wardrobe")
def add_item():
    f = request.files.get("image")
    if not f: return jsonify(error="No image uploaded"), 400
    img = read_img(f)
    if img is None: return jsonify(error="Invalid image file"), 400
    rgb = [int(v) for v in U.dominant(img, 2)[0][0]]
    item = dict(id=max([w["id"] for w in WARDROBE], default=0) + 1,
                cat=request.form.get("cat", "Top") if request.form.get("cat") in ("Top", "Bottom", "Shoes") else "Top", rgb=rgb, cname=U.color_name(rgb),
                occ=[o for o in request.form.get("occ", "").split(",") if o],
                img=thumb(img))
    WARDROBE.append(item); save_wardrobe()
    return jsonify(item)

@app.delete("/api/wardrobe/<int:iid>")
def del_item(iid):
    global WARDROBE
    WARDROBE[:] = [w for w in WARDROBE if w["id"] != iid]; save_wardrobe()
    return jsonify(ok=True)

@app.post("/api/recommend")
def recommend():
    occ = (request.get_json() or {}).get("occasion", "College")
    if not any(i["cat"] == "Top" for i in WARDROBE) or not any(i["cat"] == "Bottom" for i in WARDROBE):
        return jsonify(error="Add at least one top and one bottom first"), 400
    out = [dict(score=float(s), harmony=float(h), harmony_label=U.harmony_label(h),
                occasion_match=float(m), items=combo)
           for s, h, m, combo in U.recommend(WARDROBE, occ)]
    return jsonify(clean(out))

@app.get("/api/insights")
def insights():
    m = json.load(open(P("metrics.json"))) if os.path.exists(P("metrics.json")) else None
    return jsonify(metrics=m)

@app.get("/api/plots/<name>")
def plots(name):
    if name not in ("confusion_matrix.png", "reliability.png"): return "", 404
    return send_from_directory(BASE, name)

@app.get("/api/catalog")
def catalog():
    return jsonify(json.load(open(P("catalog.json"), encoding="utf-8")))

@app.get("/api/garments/<name>")
def garment(name):
    return send_from_directory(P("static", "garments"), name)

if __name__ == "__main__":
    app.run(port=5000, debug=True, use_reloader=False)