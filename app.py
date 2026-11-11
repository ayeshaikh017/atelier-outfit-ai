import base64, json, os
import cv2, numpy as np, joblib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import utils as U

app = Flask(__name__)
CORS(app)
clf = joblib.load("model.joblib")

# ---------- wardrobe persistence (simple JSON file) ----------
WFILE = "wardrobe.json"
WARDROBE = json.load(open(WFILE)) if os.path.exists(WFILE) else []
def save_wardrobe(): json.dump(WARDROBE, open(WFILE, "w"))

def clean(o):
    """numpy -> plain python so jsonify works"""
    if isinstance(o, dict):  return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [clean(v) for v in o]
    if isinstance(o, np.generic): return o.item()
    if isinstance(o, np.ndarray): return o.tolist()
    return o

def read_img(f):
    return cv2.imdecode(np.frombuffer(f.read(), np.uint8), cv2.IMREAD_COLOR)

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
                cat=request.form.get("cat", "Top"), rgb=rgb, cname=U.color_name(rgb),
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
    m = json.load(open("metrics.json")) if os.path.exists("metrics.json") else None
    return jsonify(metrics=m)

@app.get("/api/plots/<name>")
def plots(name):
    if name not in ("confusion_matrix.png", "reliability.png"): return "", 404
    return send_from_directory(".", name)

if __name__ == "__main__":
    app.run(port=5000, debug=True)