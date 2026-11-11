# Atelier – AI Outfit Intelligence System

Analyses a full-body outfit photo using classical machine learning (HOG + calibrated SVM, K-Means, Naive Bayes) and reports garment type, colours, style, outfit score, suggestions and prediction uncertainty. Includes a Virtual Wardrobe.

## Tech stack
- Backend: Python, Flask
- Frontend: React + Vite
- ML: scikit-learn, OpenCV, scikit-image

## Run locally
```bash
pip install -r requirements.txt
python app.py
```
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Retrain the model (optional)
Download `fashion-mnist_train.csv` from Kaggle (zalando-research/fashionmnist), place it in the project root and run:
```bash
python train.py
```