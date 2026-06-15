# Card Ladder Trending Dashboard

A local dashboard that pulls trending up and trending down cards from [Card Ladder's Ladder](https://www.cardladder.com/ladder).

## Requirements

- **Python 3.9 or newer** (3.10 or 3.11 recommended)
- A web browser
- Internet access (calls Card Ladder's API)

Works on **Windows, macOS, and Linux**.

## Quick Start (macOS / Linux)

```bash
cd cardladder
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5050**

## Quick Start (Windows)

**Option A — double-click**

1. Install Python 3.10+ from [python.org](https://www.python.org/downloads/) (check "Add Python to PATH")
2. Double-click `start.bat`

**Option B — Command Prompt**

```cmd
cd cardladder
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5050**

## Deployment

### Option 1 — Railway (Recommended)

Railway runs the app as a persistent process — no timeouts, fastest option.

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select the repo; Railway auto-detects Python and installs dependencies
4. Set the **PORT** environment variable (Railway sets `$PORT` automatically — no action needed)
5. Your app is live at the Railway-provided URL

The `Procfile` at the root handles the startup command.

---

### Option 2 — Vercel

> **Note:** Vercel uses serverless functions with a **10-second timeout** on the free tier. Requests that hit the Card Ladder API may be close to this limit on first load.

1. Install the Vercel CLI: `npm i -g vercel`
2. From the project root:

```bash
vercel
```

3. Follow the prompts (link to a project, accept defaults)
4. For subsequent deploys: `vercel --prod`

The `vercel.json` at the root handles routing and static file serving.

---

### Option 3 — Render

Similar to Railway, free tier available (app sleeps after 15 min idle).

1. Push to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Set **Start Command** to: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60`
5. Set **Environment** to `Python 3`

---

## Features

- Trending up / trending down card tables with lazy loading
- Charts: top gainers, top losers, % distribution, category breakdown
- Searchable category filter (Baseball, Pokemon, Football, etc.)
- Date ranges: 1 Day, 1 Week, 1 Month, 3 Months
- Card name search (server-side via Card Ladder API)
- Min/max % change filters

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard UI |
| `GET /api/meta` | Categories and date ranges |
| `GET /api/trending/page` | Paginated trending cards |
| `POST /api/graphs` | Chart data |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5050` | Server port |
| `CARDLADDER_SEARCH_API` | Card Ladder search URL | Override API base |
| `CARDLADDER_API_TOKEN` | Frontend token | Override auth token |

## Disclaimer

Not affiliated with Card Ladder. Uses publicly accessible endpoints from their website.
