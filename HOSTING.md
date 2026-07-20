# Hosting & Deployment Guide

This guide covers how to run the **Behavior Prediction** project locally and how to host it in a production environment (like Render, Heroku, or AWS).

---

## 1. Local Development (How to Run)

To run the full stack locally on your machine, you need to start three separate servers.

### Prerequisites
- **Node.js** (v20+)
- **Python** (v3.11+)
- **MongoDB** (Local instance or MongoDB Atlas URI)

### Step 1: Start the ML Service
The ML service must be running first because the backend relies on it for predictions.

```bash
cd ML

# Install python dependencies
pip install -r requirements.txt

# Pre-train the model (creates model.pkl)
python train.py

# Start the FastAPI server on port 8000
uvicorn main:app --reload --port 8000
```
*The ML service will now be available at `http://localhost:8000`.*

### Step 2: Start the Backend (Node.js)

Open a new terminal window:

```bash
cd Backend

# Install node dependencies
npm install

# Create a .env file based on the provided template
# Make sure to set MONGO_URI, JWT_SECRET, GMAIL_USER, and GMAIL_PASS
# ML_SERVICE_URL should be http://localhost:8000

# Start the backend server in dev mode
npm run dev
```
*The Backend API and WebSocket will now be available at `http://localhost:5050`.*

### Step 3: Start the Frontend (React/Vite)

Open a third terminal window:

```bash
cd Frontend

# Install node dependencies
npm install

# Make sure your .env has: VITE_API_URL=http://localhost:5050

# Start the Vite dev server
npm run dev
```
*The Frontend UI will now be available at `http://localhost:5173`.*

---

## 2. Production Hosting (Render, Heroku, AWS, etc.)

For production, you should deploy the 3 components as separate services. Below is the recommended architecture for free/low-cost hosting (e.g., **Render.com**).

### A. Deploying the ML Service (FastAPI)
Deploy this as a **Web Service**.

1. Connect your GitHub repository to your hosting platform.
2. Select the **ML** directory as the root directory (or use the provided Dockerfile).
3. **Build Command:**
   ```bash
   pip install -r requirements.txt && python train.py
   ```
   *(Running `train.py` during build ensures the `model.pkl` is generated before the server starts).*
4. **Start Command:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. **Alternatively, use the Dockerfile:**
   If your platform supports Docker, simply point it to `ML/Dockerfile`.

### B. Deploying the Backend (Node.js)
Deploy this as a **Web Service**.

1. Select the **Backend** directory as the root directory.
2. **Build Command:**
   ```bash
   npm install && npm run build
   ```
3. **Start Command:**
   ```bash
   node dist/server.js
   ```
4. **Environment Variables required:**
   - `NODE_ENV=production`
   - `MONGO_URI` = your MongoDB Atlas connection string
   - `JWT_SECRET` = a secure random string
   - `ML_SERVICE_URL` = the public URL of your deployed ML service (from Step A)
   - `GMAIL_USER` and `GMAIL_PASS` = for email alerts
5. **Alternatively, use the Dockerfile:**
   Point your deployment platform to `Backend/Dockerfile`.

### C. Deploying the Frontend (React/Vite)
Deploy this as a **Static Site** (Render, Vercel, or Netlify).

1. Select the **Frontend** directory as the root directory.
2. **Build Command:**
   ```bash
   npm install && npm run build
   ```
3. **Publish Directory:**
   ```
   dist
   ```
4. **Environment Variables required:**
   - `VITE_API_URL` = the public URL of your deployed Backend (from Step B). Must be prefixed with `https://`.
5. **Routing (Important):**
   If deploying on Render or Netlify, make sure you configure rewrites so that React Router works correctly. Route `/*` to `/index.html`.

---

## 3. Post-Deployment Steps

1. **Verify Services:** Check the `/health` endpoint of both your Backend and ML Service to ensure they are communicating.
2. **Setup Admin:** Register a user on the live site, then manually go into your MongoDB Atlas database and change their `role` to `"admin"`. You can then use this account to access the Retrain Dashboard.
3. **CORS Configuration:** Ensure that the `cors` settings in your Backend `app.ts` allow requests from your deployed Frontend's domain.
