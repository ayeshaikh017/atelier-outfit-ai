import json
import numpy as np, pandas as pd, joblib, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.svm import SVC
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay
from utils import extract, CLASSES

print("Loading Fashion-MNIST CSV...")
df = pd.read_csv("fashion-mnist_train.csv", nrows=10000, dtype=np.uint8)
y = df["label"].values.astype(int)
X = df.drop("label", axis=1).values
idx = np.random.RandomState(0).permutation(len(X))[:8000]
X, y = X[idx], y[idx]

print("Extracting HOG features...")
F = np.array([extract(x.reshape(28, 28).astype(np.uint8)) for x in X])
Xtr, Xte, ytr, yte = train_test_split(F, y, test_size=0.2, random_state=0, stratify=y)

print("Training calibrated SVM (2-4 min)...")
clf = CalibratedClassifierCV(SVC(kernel="rbf", C=5, gamma="scale"), cv=3, method="sigmoid")
clf.fit(Xtr, ytr)

pred = clf.predict(Xte)
print(classification_report(yte, pred, target_names=CLASSES))
rep = classification_report(yte, pred, target_names=CLASSES, output_dict=True)
json.dump(rep, open("metrics.json", "w"))

fig, ax = plt.subplots(figsize=(8, 8))
ConfusionMatrixDisplay(confusion_matrix(yte, pred), display_labels=CLASSES).plot(ax=ax, xticks_rotation=45, colorbar=False)
plt.tight_layout()
plt.savefig("confusion_matrix.png", dpi=150)

proba = clf.predict_proba(Xte)
conf = proba.max(1)
correct = (pred == yte).astype(int)
fp, mp = calibration_curve(correct, conf, n_bins=8)
plt.figure(figsize=(5, 5))
plt.plot(mp, fp, "o-", label="Model")
plt.plot([0, 1], [0, 1], "--", label="Perfect")
plt.xlabel("Mean confidence")
plt.ylabel("Actual accuracy")
plt.title("Reliability diagram")
plt.legend()
plt.savefig("reliability.png", dpi=150)

joblib.dump(clf, "model.joblib")
print("Saved model.joblib, metrics.json, confusion_matrix.png, reliability.png")