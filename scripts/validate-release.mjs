// Hard-fail GitHub release builds instead of shipping an unsigned or misconfigured updater.
import {readFileSync} from 'node:fs';
const file=(p)=>readFileSync(p,'utf8');
const pkg=JSON.parse(file('package.json'));
const conf=JSON.parse(file('src-tauri/tauri.conf.json'));
const updater=JSON.parse(file('src/update-config.json'));
const cargo=file('src-tauri/Cargo.toml');
const cargoVersion=cargo.match(/\[package\][\s\S]*?\bversion\s*=\s*"([^"]+)"/)?.[1];
const versions=[pkg.version,conf.version,cargoVersion];
if(new Set(versions).size!==1)throw Error(`Version mismatch: package.json=${versions[0]} tauri.conf=${versions[1]} Cargo=${versions[2]}`);
if(process.env.GITHUB_REF_TYPE==='tag' && process.env.GITHUB_REF_NAME !== 'v'+pkg.version)throw Error(`Tag ${process.env.GITHUB_REF_NAME} must equal v${pkg.version}`);
if(!updater.configured||!updater.repository||!conf.plugins?.updater?.pubkey)throw Error('Updater not configured. Run npm run updates:configure locally, commit the resulting public config, and retry.');
if(!conf.plugins.updater.endpoints?.[0]?.endsWith(`/${updater.repository}/releases/latest/download/latest.json`))throw Error('GitHub update endpoint does not match update-config.json repository.');
if(!conf.bundle?.createUpdaterArtifacts)throw Error('bundle.createUpdaterArtifacts must be enabled.');
if(conf.bundle?.windows?.nsis?.installMode!=='currentUser')throw Error('NSIS must use currentUser for passive updates without admin prompts.');
const publicKey=file('src-tauri/updater-public.key').trim();
if(publicKey!==conf.plugins.updater.pubkey.trim())throw Error('Public key mismatch. Re-run updater configuration.');
if(process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY!==updater.repository)throw Error(`Workflow is in ${process.env.GITHUB_REPOSITORY} but updater points to ${updater.repository}; use the same public repo or a workflow that publishes to your separate release repo.`);
console.log(`Release v${pkg.version} -> ${updater.repository}: configuration valid`);
