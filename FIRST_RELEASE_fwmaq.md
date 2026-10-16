# First signed Windows release for fwmaq/maqs-passion

**Status:** This project ZIP is prepared for GitHub, but no GitHub files or secrets have been uploaded, and no executable has been built or published.

GitHub repo: https://github.com/fwmaq/maqs-passion
Update feed (exists after successful first release): https://github.com/fwmaq/maqs-passion/releases/latest/download/latest.json
GitHub Actions: https://github.com/fwmaq/maqs-passion/actions
GitHub Actions secrets: https://github.com/fwmaq/maqs-passion/settings/secrets/actions

## Do these steps in order

1. Clone your existing public repo with `git clone https://github.com/fwmaq/maqs-passion.git`. Copy all the **contents** of this ZIP's `maqs-passion` folder into the cloned repo, replacing the placeholder README. Keep `.git` intact. Do **not** add your private `.env` or key files.
2. In that cloned repo, run `npm install`.
3. Generate a private + public signing key **on your PC only** (PowerShell):
   ```powershell
   npx tauri signer generate -w "$env:USERPROFILE\.tauri\maqs-passion.key"
   ```
   Remember the password. Never publish or share the private `.key` or its password. Back it up securely.
4. Configure the updater with your *public* key:
   ```powershell
   npm run updates:configure -- --repo fwmaq/maqs-passion --pubkey "$env:USERPROFILE\.tauri\maqs-passion.key.pub"
   npm run updates:validate
   ```
5. On GitHub > **Settings > Secrets and variables > Actions**, add:
   - Secret `TAURI_SIGNING_PRIVATE_KEY`: the complete contents of your **private** `.key` file (not its filename).
   - Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the key password (if one was specified).
   - Variable `VITE_SUPABASE_URL`: the normal Supabase project URL.
   - Secret `VITE_SUPABASE_ANON_KEY`: the Supabase **public/anon** key, **never** a service-role key.
6. From inside the cloned repo:
   ```powershell
   git add .
   git commit -m "Publish Maq's Passion v2.14 source and signed updater"
   git push origin main
   git tag v2.14.0
   git push origin v2.14.0
   ```
7. Watch the Actions page. Only share the installer after the workflow succeeds and the GitHub Release contains a Windows `*-setup.exe`, its signature, and `latest.json`.

Future releases: bump version in the app (`npm run version:set -- 2.14.1`), commit/push, then push tag `v2.14.1`.

**Important:** The first installed version must be installed manually. Automatic update checks only work in the installed, signed Tauri build—not `npm run desktop`. Tauri's update signature is **not** a Microsoft Authenticode certificate; Windows SmartScreen might still warn initially. If GitHub is unavailable, the built-in update check cannot fetch its feed.

More detail: `GITHUB_UPDATES.md`.
