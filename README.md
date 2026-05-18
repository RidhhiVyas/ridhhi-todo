# Ridhhi's To-Do App

A personal task tracker with office/personal categories, due-time reminders, and cross-device sync.

## What you need

- A free [GitHub](https://github.com) account
- A free [Supabase](https://supabase.com) account (for the database)
- A free [Vercel](https://vercel.com) account (for hosting)

Total setup time: ~20 minutes. Total cost: $0.

---

## Step 1 — Set up Supabase (the database)

1. Go to [supabase.com](https://supabase.com) and sign in (use your GitHub account, it's faster).
2. Click **New project**. Name it `ridhhi-todo`, set a strong database password (save it somewhere — you won't need it often but don't lose it), pick a region close to you (Mumbai/Singapore for India), and create.
3. Wait ~2 minutes for it to provision.
4. In the left sidebar, click **SQL Editor** → **New query**.
5. Open `supabase-setup.sql` from this project, copy everything, paste into the SQL editor, and click **Run**. You should see "Success. No rows returned."
6. In the left sidebar, click **Project Settings** (gear icon) → **API**.
7. Copy two values and keep them in a notepad:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)

That's the database done.

---

## Step 2 — Put the code on GitHub

1. Go to [github.com/new](https://github.com/new), create a new repo called `ridhhi-todo`. Keep it **Public** (private works too but Vercel's free tier is simpler with public repos). Don't add a README — we already have one.
2. On the next screen, click **uploading an existing file**.
3. Drag every file and folder from this project (`package.json`, `vite.config.js`, `index.html`, the entire `src/` folder, `.gitignore`, `.env.example`, `supabase-setup.sql`, `README.md`) into the browser.
4. Click **Commit changes**.

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com), sign in **with GitHub**.
2. Click **Add New** → **Project**.
3. Find `ridhhi-todo` in the list and click **Import**.
4. Vercel will auto-detect it as Vite. Don't change the build settings.
5. Expand **Environment Variables** and add two:
   - Key: `VITE_SUPABASE_URL`, Value: the Project URL you saved earlier
   - Key: `VITE_SUPABASE_ANON_KEY`, Value: the anon public key you saved earlier
6. Click **Deploy**. Wait ~1 minute.
7. You'll get a live URL like `ridhhi-todo.vercel.app`. Open it.

---

## Step 4 — Tell Supabase about your live URL

So the magic-link emails redirect to your live site instead of localhost:

1. Back in Supabase, go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g. `https://ridhhi-todo.vercel.app`).
3. Under **Redirect URLs**, add the same URL.
4. Save.

---

## How to use it

1. Open your Vercel URL on any device.
2. Enter your email → check inbox → click the magic link → you're in.
3. Add tasks, set priority, set a due time, click "Alerts" to enable browser notifications.
4. Tasks sync in real time across every device you sign in on.

## Optional polish

- **Custom domain:** In Vercel, go to your project → Settings → Domains. Add `tasks.yourdomain.com` if you own a domain.
- **Update the app:** Edit any file on GitHub, commit, and Vercel auto-redeploys within a minute.

## Troubleshooting

- **Magic link goes to localhost:** You skipped Step 4. Go back and set the Site URL in Supabase.
- **"Missing Supabase env vars" in browser console:** Env vars weren't set in Vercel. Project Settings → Environment Variables → add them, then redeploy.
- **Tasks not syncing across devices:** Make sure you ran the `alter publication supabase_realtime add table tasks;` line at the end of the SQL setup.

## Local development (optional)

If you want to run it on your laptop before deploying:
```
npm install
cp .env.example .env
# edit .env with your Supabase values
npm run dev
```
