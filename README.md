# PeakWatch Delhi · Deployment Guide

**See tomorrow's peak today.** An AI-powered electricity demand intelligence and early-warning platform for Delhi DISCOM / SLDC operations.

---

## Deployment Architecture

The application is architected into two cooperating services:
1. **Frontend (React + Vite + Tailwind + Recharts)**: Deployed to **Vercel** as a high-performance static SPA.
2. **Backend (FastAPI + scikit-learn + pandas)**: Deployed to **Render** (free tier) as a persistent Python web service.

---

## 🚀 1. Deploy Frontend on Vercel (Step-by-Step)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New Project"** -> **"Import"** this GitHub repository (`delhi-demand-forecast`).
2. On the **Configure Project** screen:
   - Next to **Root Directory**, click **Edit**.
   - Select or type: `delhi-demand-forecast/frontend` and click **Continue**.
   - Vercel will automatically detect the Framework Preset as **Vite**, the build command as `npm run build`, and the output directory as `dist`.
3. Open the **Environment Variables** section and add:
   - **Name**: `VITE_API_BASE`
   - **Value**: `https://<your-backend-service-url>` (e.g. `https://peakwatch-api.onrender.com` or your backend URL).
     *(Note: If you haven't deployed the backend yet, you can leave this empty for now and add it later under Project Settings -> Environment Variables).*
4. Click **Deploy**.
5. Once deployed, note your live Vercel URL (e.g., `https://delhi-demand-forecast.vercel.app`).

---

## 🐍 2. Deploy Backend on Render (Free Tier)

1. Push this repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) -> **New +** -> **Blueprint**.
3. Select your repository `tanmaytiwari37/delhi-demand-forecast`. Render will automatically read `render.yaml` from the root.
4. When prompted for environment variables:
   - Set `PEAKWATCH_FRONTEND_ORIGIN` to your live Vercel frontend URL (e.g., `https://delhi-demand-forecast.vercel.app`) to enable secure CORS requests.
5. Click **Apply**.
6. Render builds the environment (`pip install -r backend/requirements.txt`) and starts the service (`python -m backend.main`).
7. Verify the API is up by opening: `https://<your-render-url>/api/health`.

---

## 💻 Local Development

```powershell
# 1. Backend (from delhi-demand-forecast directory)
cd delhi-demand-forecast
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000

# 2. Frontend
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to explore the dashboard.