# v2.14 — GitHub auto-updates & branded installer

Automatic, signed updates are implemented (background download, restart prompt) and a black/white NSIS installer is branded with custom artwork. **GitHub release setup is required before real updates will run.** Follow [`GITHUB_UPDATES.md`](GITHUB_UPDATES.md). The first v2.14 installation must be done manually; later version bumps use GitHub Releases. Development (`npm run desktop`) intentionally skips automatic updating.

# Maq's Passion v2.13 — Premium / Focused Edition

A refined, uncluttered competitive platform with the original 3D aim-training engine.

### What changed in v2.13

- **Navigation:** five primary tabs; less-used utilities live inside **More tools**. Members is a compact slide-over and is hidden by default.
- **Item Shop:** now reads public item names from cosmetic/bundle fields, rather than internal development IDs, handles additional Fortnite-API display-asset image formats, automatically attempts alternate images, skips unnamed virtual offers, caches the last valid shop, and shows 36 offers per batch. Actual remote CDN availability cannot be guaranteed.
- **PASSION AIM 2.0:** unchanged mouse/physics core with quieter monochrome arena, compact quick-start presets, collapsed setup and history, coaching notes after each run and personal-best feedback. Keeps existing local history and sensitivity preferences.
- **Profiles:** Discord-inspired banner, overlapping avatar, status, bio, membership date, security and password controls. Uses the **existing Supabase public `avatars` bucket** for both banner and avatar uploads: PNG/JPEG/WebP up to **2 MB each**; banners use `banner_url` in auth user metadata. Existing `supabase/setup.sql` already creates the bucket and per-user upload policy. No new SQL migration required if the bucket is already configured.
- **Settings:** motion, compact density, fullscreen at startup, Home news and Members-on-startup. Saved on this device (`mp:preferences:v213`). The Home news feed is opt-in to keep Home lean.
- **Appearance:** neutral black, graphite and white; tighter spacing and quieter cards.

### Running

1. Extract this complete project folder.
2. Copy your **existing `.env`** (Supabase URL and anon key) into its root. Do not publish that file.
3. If you used downloaded pro photos, transfer `public/players/`.
4. Run `npm install` then `npm run desktop` from the project root.

The project uses the same npm packages and Tauri commands as v2.12. User accounts live in Supabase, aim scores and app UI preferences are stored locally. A full Windows build / live shop CDN playback test was **not performed** in the packaging environment.

---

# MAQ'S PASSION — v2.13

Coal-black Fortnite competitive desktop app (Tauri 2 + React + TypeScript).

## v2.13 — Home refresh, integrated community and measured FPS

- **Home is a proper dashboard:** the free PASSION AIM 3D trainer is the featured action, with a single-click launch, plus quick links to Masterclasses, Pro Setups, Sensitivity, Drop Calculator and Tweaks.
- **Featured Masterclasses:** five real videos already in the curated library, YouTube thumbnails, online title/creator resolution with graceful offline placeholders. Clicking a card opens *that specific video* in the existing in-app Masterclasses player, not a generic page. The library remains curated in source only.
- **News:** the official Fortnite-API in-game news feed remains on Home, but is visually secondary with an on-demand expand control and manual refresh.
- **Members:** smaller, quieter panel matching the charcoal workspace. The existing Members sidebar item toggles the dock. On narrower screens it starts closed and docks as an overlay when summoned. Supabase presence, member roles and role editing are unchanged.
- **Interactions:** subtle animated hover/focus states, staggered cards, a live pulse on the free Aim Trainer feature and refined navigation. Reduced-motion system preferences are respected.
- **Measured render FPS:** the aim engine measures timestamps **after each actual WebGL render submission** and reports a rolling 750ms sample, with an average frame-time estimate in ms. FPS is no longer a preset/target-value display. Rendering is driven by `requestAnimationFrame`, so observed FPS can be limited by your monitor refresh rate, Windows WebView2 and GPU scheduling. GPU-present FPS cannot be measured reliably from browser JavaScript; this is the submitted-render-frame rate.

Use `npm install` and `npm run desktop` from the extracted `maqs-passion` folder. Preserve your `.env` and private Supabase credentials locally; the ZIP does not contain your `.env` or a full photo library. No new Rust commands, SQL migrations, or dependencies were added in this update.

## v2.11 — PASSION AIM 3D (NEW)

The left sidebar has **3D Aim Trainer** (separate from Reaction Time). Its arena uses a custom, offline **WebGL2 3D renderer** and does **not** need a new NPM dependency or Tauri/Rust command.

- **Seven original drills:** Tile Frenzy, Sixshot Precision, Micro Corrections, Smooth Tracking, Strafe Reactive, Target Switch and Airborne Targets.
- **Three difficulty settings:** Standard, Competitive and Elite; plus adjustable target size (50–150%) and movement speed (50–250%).
- **Configurable rounds:** 30, 60, 90 or 120 seconds. Click targets in flick scenarios; hold left mouse over moving targets in tracking scenarios.
- **Fortnite-style sensitivity entry:** mouse DPI, horizontal X percentage, vertical Y percentage, horizontal FOV (65–120°) and estimated cm/360. Settings persist locally. Sensitivity is based on the commonly used Fortnite yaw factor of 0.555 scaled by percentage; WebView2's pointer motion may be scaled and isn't certified raw mouse counts. For a physical 1:1 match, **compare measured cm/360 on your device to Fortnite and adjust**. Never assume the on-screen number proves exact parity.
- **Performance settings:** FPS cap (unlimited, 60, 120, 144, 165, 180, 240, 360), render resolution scale, competitive/balanced/high geometry presets, antialiasing, crosshair and optional hit sound. The FPS readout is actual measured presentation-loop FPS and is affected by display refresh rate, WebView2, GPU and Windows. No frame rate is guaranteed.
- **Controls:** Click **Start Training** to request pointer lock, move the mouse to look and **left-click** to shoot (hold for tracking). **Esc** releases the mouse and pauses the round. **Resume Session** captures it again. The range has its own optional fullscreen button. Switching to other tabs unmounts the renderer and frees resources.
- **Scoring:** round score, accuracy/hit time, confirmed hits, FPS, local personal bests and up to 60 locally saved results. User results are not uploaded to Supabase.

This is an **original competitive aim trainer**, not a replica or implementation of KovaaK's scenarios, source code, artwork or physics. It does not claim verified mouse-input equivalence with Fortnite, KovaaK's or Unreal Engine.

**Troubleshooting:** If the arena reports that WebGL2 is unavailable, ensure Microsoft Edge WebView2 is updated and Windows GPU acceleration is enabled. If mouse capture is blocked, click the **Start / Resume** control within the desktop app; fallback from unadjusted mouse movement to ordinary pointer lock is automatic. On laptops, select **Competitive / Performance**, **50–75% resolution** and AA off first. The engine has no Rust commands, so you do not need to rebuild Tauri specifically for the aim logic; `npm run desktop` runs your current project normally.

## v2.10 — Cleaned edition

- Removed the Movies page, all Stremio integrations and their supporting video-player dependency.
- All Fortnite tools, Masterclasses, Supabase accounts, roles and Members panel remain.
- No configuration for Stremio, AIOMetadata or AIOStreams is needed.
- If updating an existing working project, preserve your own `.env` and locally downloaded `public/players` portraits.

## Earlier changes

- The experimental Replay Viewer and .NET decoder have been removed completely.
- Masterclasses uses a featured-video hero, Netflix-style horizontal category rails, YouTube thumbnails, search, and embedded playback. The catalogue remains curated in source code, not editable in the app.
- Supabase email/password accounts, display names, profile photos, profile screen, password updates, and sign-out replace the old shared `alphabet123` password screen.
- The original splash, Home, Pro Setups, Item Shop, Sensitivity Calculator, Keybind Visualiser, Reaction Time, 15-second Speed Test, Tweaks, and Drop Calculator are retained.

## Required Supabase setup (one time)

You **must connect Supabase** before sign-up or login can work. No credentials are included in the ZIP.

1. Create a Supabase project at https://supabase.com/dashboard .
2. Under **Authentication > Providers > Email**, enable email/password sign-ins. For a safer configuration, leave email confirmation **on**. Users must confirm their email before logging in. Check **Authentication > URL Configuration** to set a working site URL so the confirmation link doesn't redirect to an unused localhost address; you can return to Maq's Passion and log in after confirmation. For private development, you can temporarily turn off email confirmation if you understand the trade-offs.
3. Open **SQL Editor** and run `supabase/setup.sql`. This creates a public-read `avatars` Storage bucket and restricts uploads to the signed-in user's own folder. Account names are stored in Supabase Auth user metadata, so a separate `profiles` table is not needed for this version.
4. Copy `.env.example` to `.env` in the project root and fill in your project **URL** and **publishable/anon key** from **Settings > API Keys**. Use only the *public* key; never put a service role or secret key into a desktop application.
5. Restart `npm run desktop`. Changes to `.env` require restarting Vite.

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

**Account workflow:** sign up with display name, email, and password; confirm email if required; log in; open **My Profile** in the left sidebar to set your picture, update display name, or change password. Profile pictures must be PNG/JPEG/WebP, up to 2 MB. Uploads are stored in Supabase Storage. Supabase public avatar URLs are publicly accessible to anyone with the URL, so avoid sensitive photographs.

The app automatically restores sessions. The old common password no longer works; each account has its own password. The login is genuinely backed by Supabase Auth, not a pretend offline credential check.

> If you enable password-recovery email links, configure an appropriate recovery redirect flow separately. This version supports changing your password while signed in, but does not implement a custom password-recovery deep link.

## Running

Install Node.js LTS, Rust, and the Visual C++ Windows build tools required by Tauri.

```powershell
npm install
npm run desktop
```

The development app starts with its splash screen and opens its own fullscreen desktop window. No installer build is necessary.

Other commands:

- `npm run build` — checks TypeScript and builds frontend
- `npm run test:drop` — runs drop-physics checks
- `npm run photos` — optional pro-photo importer if you don't already have locally saved portraits

Keep `public/players` when updating projects; remote pro photos aren't included in this archive.

## Masterclasses

20 supplied YouTube videos plus the supplied playlist are part of the read-only library in `src/masterclasses-library.ts`. Every existing category has at least two video assignments. Categories are editorial assignments, not guaranteed YouTube-derived classifications; if a title doesn't belong in its row, change the data file in a future update. Video titles and channel names are fetched from public metadata when available; YouTube may block some embeds, in which case use the direct source link in the player. No fabricated publication dates are shown.

## Security

The Supabase publishable/anon key is intended to be shipped in the client. Access control comes from Supabase Auth and Storage policies. Never add a service role key or database password to the client project. This app is private-use software; the auth backend is still reachable online. Old local settings from earlier versions remain stored on the device rather than synchronised to accounts.

## Status

Project files and syntax were checked in the authoring environment. npm dependencies and a full Windows Tauri build could not be completed there; run `npm install` and `npm run desktop` locally to validate the Windows build and Supabase connectivity.

## v2.6 — Discord-style Members panel

The **Members** panel is on the **right-hand side** after login. It shows live-online users with green indicators, Supabase display names and avatars, plus role badges. You can search users and expand the offline group. Click a member to view their role and, if your account is an Owner/Admin, change their role using a dropdown. The left navigation can hide or show this panel.

### One-time setup

1. Supabase Authentication and `.env` setup from v2.5 must already be working. Ensure `supabase/setup.sql` has been run for avatar images.
2. In **Supabase Dashboard → SQL Editor**, run **`supabase/members.sql`**. The script creates the member directory, synchronises Auth display names/avatar URLs, adds secure role-assignment logic and sets Realtime presence permissions. Run it after your project’s Postgres connection issue is fixed.
3. **Sign up/log in to your own account first**. In SQL Editor, replace the email in this statement with YOUR account email and run it:

```sql
update public.member_profiles
set role = 'owner'
where id = (select id from auth.users where lower(email) = lower('you@example.com') limit 1);
```

4. In **Supabase Realtime Settings**, disable **Allow public access** to require the private-channel RLS policies. Supabase private channel authorization uses policies on `realtime.messages` (included in the script).
5. Run `npm install` and `npm run desktop`. Open Maq's Passion signed into two different accounts to check presence. Browser/WebView tabs must remain connected to appear online; presence is not a permanent `is_online` field.

### Roles and permissions

- **Owner** — can assign Admin, Moderator, VIP, or Member to other non-owner users.
- **Admin** — can manage Moderator/VIP/Member but not Owner/Admin accounts.
- **Moderator / VIP / Member** — visible role badges, no role-management permissions.
- A user **cannot** promote themselves or assign Owner from the client; Owner bootstrapping requires SQL Editor access. Only the `set_member_role` SQL function may change roles. Roles are **not** read from client-editable user metadata.
- The online panel is presence-based and **approximate**: a client can disconnect without a clean exit and Supabase will expire it. Names/avatars come from the authenticated database directory. Being a Moderator or VIP is currently a display role, not a feature-level permission grant elsewhere in Maq's Passion.

### Troubleshooting

- **Members unavailable / relation does not exist:** run `supabase/members.sql` after the database is healthy.
- **Connecting to live presence:** check the two policies on `realtime.messages`, your JWT auth session, and Realtime dashboard settings.
- **Can't assign roles:** you are probably still a Member; run the one-time SQL Owner bootstrap using the same email you log in with.
- **Profile pictures are blank:** run the earlier `supabase/setup.sql` for the `avatars` bucket and set a picture on My Profile.
