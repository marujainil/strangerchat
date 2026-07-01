# Deploying StrangerChat — the easy, step-by-step guide

This app has two halves that live in **two different places**:

- **Frontend** (the website people see) → **Netlify**
- **Backend** (the matchmaking server) + **database** + **Redis** → **Render**
  *(Netlify can't run these — they need an always-on server, which is what Render is for.)*

You'll create **3 free accounts**: GitHub, Render, Netlify. Total time ~20–30 min.

> 💡 "Publish on Google" = once this is done you'll have a normal web link
> (like `https://your-site.netlify.app`) that opens in Chrome or any browser.

---

## Part 0 — Get the code onto GitHub

Both Render and Netlify deploy *from a GitHub repository*, so the code has to live there first.

1. Go to **https://github.com** and **sign up** (free) if you don't have an account.
2. Click the **+** (top-right) → **New repository**.
3. Name it `strangerchat`, choose **Private** (or Public), and click **Create repository**.
4. Now upload the project. The easiest no-typing way:
   - Download and open **GitHub Desktop**: https://desktop.github.com
   - Sign in → **File → Clone repository** → pick your `strangerchat` repo → Clone.
   - **Unzip** the `strangerchat.zip` I gave you, and **copy everything inside it**
     into the cloned folder (so `backend/`, `frontend/`, `render.yaml`, etc. sit at the top).
   - Back in GitHub Desktop you'll see all the files. Type a message like "first commit"
     → click **Commit to main** → click **Push origin**.
   - ✅ Your code is now on GitHub.

   *(Prefer the terminal? `cd` into the unzipped folder and run:*
   `git init && git add . && git commit -m "first commit" && git branch -M main && git remote add origin https://github.com/USERNAME/strangerchat.git && git push -u origin main` *)*

---

## Part 1 — Deploy the backend on Render (server + database + Redis)

The repo includes a **`render.yaml`** that sets up all three pieces automatically.

1. Go to **https://render.com** and **sign up** → choose **"Sign in with GitHub"** (easiest).
2. On the dashboard click **New +** (top-right) → **Blueprint**.
3. **Connect your GitHub** and pick the **`strangerchat`** repo.
4. Render reads `render.yaml` and shows it will create:
   - `strangerchat-backend` (the server)
   - `strangerchat-db` (PostgreSQL)
   - `strangerchat-redis` (Redis / Key Value)
5. Click **Apply**. Render now builds and launches everything. The first build takes
   a few minutes (it builds the server, creates the database, and loads starter data
   — plans, countries, interests, and an admin user — automatically).
6. When it's done, click the **`strangerchat-backend`** service. At the top you'll see
   its URL, like:
   ```
   https://strangerchat-backend.onrender.com
   ```
   **Copy this URL** — you'll need it in Part 2.
7. Quick test: open `https://strangerchat-backend.onrender.com/api/health` in your
   browser. You should see `{"ok":true,...}`. 🎉 The backend is live.

> ⚠️ **Free plan note:** the free server **goes to sleep after ~15 min idle**, so the
> first visit after a nap is slow (~1 min) and live video can drop. For a real,
> always-on chat, open the backend service → **Settings → Instance Type → Starter**
> ($7/mo). Also, Render's **free database expires after 30 days** — upgrade it before
> then if you keep the app.

---

## Part 2 — Deploy the frontend on Netlify

1. Go to **https://netlify.com** and **sign up** → **"Sign up with GitHub"**.
2. Click **Add new site** → **Import an existing project** → **GitHub** → pick
   **`strangerchat`**.
3. Netlify reads `netlify.toml` and fills in the build settings for you
   (base folder `frontend`, build command `npm run build`). Leave them as-is.
4. **Before** clicking deploy, open **"Add environment variables"** (or you can do this
   right after the first deploy under **Site settings → Environment variables**) and add
   these **three**:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | your Render URL, e.g. `https://strangerchat-backend.onrender.com` |
   | `NEXT_PUBLIC_SOCKET_URL` | the **same** Render URL |
   | `NEXT_PUBLIC_SITE_URL` | your Netlify URL (Netlify shows it on this screen, e.g. `https://strangerchat-xyz.netlify.app`) |

5. Click **Deploy site**. Wait for the build to finish (a couple of minutes).
6. Netlify shows your live site URL at the top, like `https://strangerchat-xyz.netlify.app`.
   **Copy it** — you need it for Part 3.

> If you added the env vars *after* the first deploy, click **Deploys → Trigger deploy →
> Deploy site** once so the new values are baked in.

---

## Part 3 — Connect the two (one setting)

Right now the backend doesn't yet "trust" your Netlify website. Fix it:

1. Go back to **Render** → open **`strangerchat-backend`** → **Environment** (left menu).
2. Find **`CLIENT_URL`** → click **Edit** → paste your **Netlify URL**
   (e.g. `https://strangerchat-xyz.netlify.app`, no trailing slash) → **Save Changes**.
3. Render automatically redeploys (takes a minute).

✅ **Done.** Open your Netlify URL in Chrome — the site loads, click **Start**, allow
camera/mic, and you're matched with anyone else online. Open it in a second device or
an incognito window to test a real connection between two people.

---

## Part 4 — Optional upgrades (only if you want them)

**A) Reliable video for everyone (TURN server)**
On the free setup, video uses Google's public STUN, which works for *most* people but
fails for some strict office/mobile networks. To cover everyone, add a free TURN server:

1. Sign up at **https://www.metered.ca/tools/openrelay/** (free TURN tier) and get your
   TURN **URL**, **username**, and **credential**.
2. In **Render → backend → Environment**, set `TURN_URL`, `TURN_USERNAME`,
   `TURN_CREDENTIAL` → Save. Done.

**B) Google sign-in**
1. Create an OAuth Client ID at **https://console.cloud.google.com** (APIs & Services →
   Credentials → Create OAuth client ID → Web application). Add your Netlify URL to the
   authorized origins.
2. Put the client ID into **both**:
   - Render → backend → `GOOGLE_CLIENT_ID`
   - Netlify → env vars → `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → redeploy the Netlify site.

**C) Real payments (Razorpay)**
1. Get your keys from the Razorpay Dashboard (Settings → API Keys), and a webhook secret
   (Settings → Webhooks; point the webhook to
   `https://strangerchat-backend.onrender.com/api/payments/webhook`).
2. Render → backend: set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`.
3. Netlify: set `NEXT_PUBLIC_RAZORPAY_KEY_ID` → redeploy.
   *(Without keys, the app shows the UPI-QR payment option instead.)*

**D) Real emails (sign-up codes / OTP)**
Until you add SMTP, login codes are printed in the backend logs (Render → Logs).
To send real emails, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` on Render.

**E) Your own domain**
In Netlify → **Domain settings** → add your custom domain and follow the DNS steps.
Then update `NEXT_PUBLIC_SITE_URL` (Netlify) and `CLIENT_URL` (Render) to that domain.

---

## Troubleshooting

- **Site loads but "Start" never connects / no online count** → `CLIENT_URL` on Render
  doesn't exactly match your Netlify URL (check for `https://`, no trailing slash).
  Fix it and let Render redeploy.
- **First load is very slow, then works** → the free Render server was asleep. Upgrade
  to Starter for always-on.
- **Camera/mic doesn't start** → the browser needs permission *and* an HTTPS site
  (Netlify is HTTPS, so this is fine) — click "Allow" when prompted.
- **Video connects for you but not on a phone/office Wi-Fi** → add a TURN server (4A).
- **Login code never arrives** → SMTP isn't set; read the code from Render → Logs, or
  add SMTP (4D).
- **`/api/health` doesn't return `{"ok":true}`** → open Render → backend → **Logs** to
  see the error (usually a still-building service; wait for "Live").

---

That's everything. The README has the deeper technical details if you ever want them.
