# Maq's Passion — GitHub auto-updates + installer

Version 2.14.0 adds **signed background updates**. The app checks after sign-in and silently downloads new releases; the user clicks **Restart & update** when ready. Tauri's Windows updater exits the running app, runs the installer in **passive mode** (a small Windows progress window), and restarts the updated application. This is the recommended safe behavior — it doesn't terminate a training session without the user clicking.

**Important: GitHub updates will NOT work until you complete the one-time setup below.** The ZIP includes the selected GitHub repository URL but **no signing key**. The updater stays disabled until you add the public key yourself. The development build still works without updater setup. Existing v2.13 installations need to be upgraded manually once to the configured v2.14 installer; updates after that are automatic.

## 1. Create a public GitHub repository

Your public repository is **https://github.com/fwmaq/maqs-passion** (currently a starter README only). The app source, workflow and signing public key must still be pushed there. Release assets and `latest.json` will be publicly downloadable.

## 2. Generate a signing key on YOUR Windows PC (once)

From the project directory, after `npm install`, in PowerShell:

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.tauri\maqs-passion.key"
```

This creates a **private** `.key` file and a **public** `.key.pub` file. Choose a strong password and keep both the password and private key securely backed up. Never commit or upload the private key to a public repo, put it in `.env`, or send it in chat. **If you lose the private key, existing users cannot verify your future updates under that key.**

## 3. Configure the repository and public key

```powershell
npm run updates:configure -- --repo fwmaq/maqs-passion --pubkey "$env:USERPROFILE\.tauri\maqs-passion.key.pub"
npm run updates:validate
```

This only commits **public** information: `src-tauri/tauri.conf.json`, `src/update-config.json` and `src-tauri/updater-public.key`. The endpoint is `https://github.com/fwmaq/maqs-passion/releases/latest/download/latest.json`.

## 4. Add GitHub Actions secrets

In GitHub → repository → Settings → Secrets and variables → Actions:

- Secret `TAURI_SIGNING_PRIVATE_KEY`: the **full contents** of your `.key` file (NOT its local Windows path).
- Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the passphrase used when generating the key (if you set one).
- Variable `VITE_SUPABASE_URL`: Supabase project URL for account login.
- Secret `VITE_SUPABASE_ANON_KEY`: public/publishable Supabase key. This is intentionally embedded in the frontend; never use a service-role key.

The automatically provided GitHub `GITHUB_TOKEN` is used to publish Releases. The workflow needs `contents: write` (already in `.github/workflows/release-windows.yml`).

## 5. Publish v2.14.0

**The repository currently contains just a README.** Clone it first and copy the *contents* of the ZIP’s `maqs-passion` folder into the cloned repository folder (not the outer `maqs-passion` folder itself). Do not copy your personal `.env`, a private key, or `node_modules`. Run all following commands inside the Git clone, **after** generating your key and configuring the updater in that clone.

Make sure the workflow, `src-tauri/tauri.conf.json`, `src/update-config.json`, and `src-tauri/updater-public.key` are all staged. Then in PowerShell:

```powershell
git add .
git commit -m "Add Maq's Passion signed updater and branded installer"
git push origin main
git tag v2.14.0
git push origin v2.14.0
```

The `Windows Release — Maq's Passion` GitHub Action compiles the Windows NSIS installer, signs the update bundle, publishes it to a GitHub Release and generates `latest.json`. Watch the Actions tab for errors. Confirm that the Release includes the installer, `.sig`, and `latest.json` **before** sharing the download.

## 6. Future updates

Whenever you change the project:

```powershell
npm run version:set -- 2.14.1
# commit the new app files and all version bumps
git add .
git commit -m "Release v2.14.1"
git push origin main
git tag v2.14.1
git push origin v2.14.1
```

Users who installed the **v2.14 signed installer** automatically check GitHub Releases at launch. The updater verifies downloads against the embedded public key; if the signature is missing or invalid, installation fails safely. The new version must be greater than the installed version.

## Important operational notes

- **Development** with `npm run desktop` skips updates intentionally. Test with an **installed release**.
- **Windows NSIS** is branded with the installer header, sidebar and app icon. The installer is not a custom Discord-style HTML window; it is a polished native Windows setup.
- **First-time Windows SmartScreen** may still warn about an unsigned publisher. Tauri's updater signature authenticates downloaded update artifacts; it is not a Windows Authenticode code-signing certificate. Public distribution may require a trusted code-signing certificate and reputation.
- The installer is per-user (`currentUser`), so future passive updates normally need no admin elevation. Tauri uses a small installer progress window in passive mode.
- Automatic downloads don't forcibly restart an ongoing aim-training session. Update readiness is visible as a small toast and in Settings. Turning off **Download updates automatically** stops new automatic checks (you can always check manually).
- `latest.json` is automatically generated by the official `tauri-apps/tauri-action` GitHub Action when signing is configured. Do not handwrite signatures or use unsigned EXEs.
- If your source must remain **private**, use a separate public releases repo plus a separately authorised publishing workflow. The included workflow intentionally fails if the configured release repository differs from the workflow repository.

## Current workflow compatibility

This repo-specific package uses `tauri-apps/tauri-action@v0` and its supported `includeUpdaterJson: true` input. The generic v2.14 package had `@v1` and `uploadUpdaterJson`, which were not a valid combination for the public `v0` action branch when verified.
