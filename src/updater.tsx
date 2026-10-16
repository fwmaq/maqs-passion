import { useCallback, useEffect, useRef, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { isTauri } from '@tauri-apps/api/core';
import { ArrowDownToLine, CheckCircle2, CloudDownload, Download, ExternalLink, LoaderCircle, RefreshCw, X } from 'lucide-react';
import updateConfig from './update-config.json';
import './updater.css';

type UpdateResource = NonNullable<Awaited<ReturnType<typeof check>>>;
type Phase = 'unconfigured' | 'unsupported' | 'idle' | 'checking' | 'current' | 'downloading' | 'ready' | 'installing' | 'error';
export type UpdaterControls = {
  phase: Phase; version: string; percent: number | null; bytes: number; total: number | null;
  error: string; dismissed: boolean; setDismissed: (next: boolean) => void;
  checkNow: () => Promise<void>; apply: () => Promise<void>;
};

const describeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (/404|not found/i.test(message)) return 'No published latest.json update feed was found in your GitHub Releases.';
  if (/network|fetch|dns|timeout|connection/i.test(message)) return 'GitHub could not be reached. Check your connection and try again.';
  return message.slice(0, 200);
};

export function useAppUpdater(enabled: boolean, automatic: boolean): UpdaterControls {
  const [phase, setPhase] = useState<Phase>(() => !updateConfig.configured ? 'unconfigured' : 'idle');
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');
  const [bytes, setBytes] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const updateRef = useRef<UpdateResource | null>(null);
  const busyRef = useRef(false);
  const autoStarted = useRef(false);

  const checkNow = useCallback(async () => {
    if (busyRef.current || updateRef.current) return;
    if (!updateConfig.configured) { setPhase('unconfigured'); return; }
    if (!isTauri() || import.meta.env.DEV) { setPhase('unsupported'); return; }
    busyRef.current = true;
    setError(''); setDismissed(false); setPhase('checking');
    try {
      const update = await check();
      if (!update) { setPhase('current'); return; }
      updateRef.current = update;
      setVersion(update.version);
      setBytes(0); setTotal(null);
      setPhase('downloading');
      let downloaded = 0;
      let contentLength: number | null = null;
      await update.download(event => {
        if (event.event === 'Started') {
          downloaded = 0;
          contentLength = event.data.contentLength ?? null;
          setTotal(contentLength);
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          setBytes(downloaded);
        } else if (event.event === 'Finished') {
          setBytes(contentLength ?? downloaded);
        }
      });
      setPhase('ready');
    } catch (cause) {
      updateRef.current = null;
      setError(describeError(cause));
      setPhase('error');
    } finally { busyRef.current = false; }
  }, []);

  const apply = useCallback(async () => {
    if (busyRef.current || !updateRef.current) return;
    busyRef.current = true;
    setPhase('installing');
    try {
      // Tauri updater's Windows installer exits this process then installs in
      // passive mode; it launches the updated app after installation.
      await updateRef.current.install();
    } catch (cause) {
      setError(describeError(cause));
      setPhase('error');
      updateRef.current = null;
    } finally { busyRef.current = false; }
  }, []);

  useEffect(() => {
    if (!enabled || !automatic || autoStarted.current || !updateConfig.configured || !isTauri() || import.meta.env.DEV) return;
    autoStarted.current = true;
    void checkNow();
  }, [enabled, automatic, checkNow]);

  const percent = total && total > 0 ? Math.max(0, Math.min(100, bytes / total * 100)) : null;
  return { phase, version, percent, bytes, total, error, dismissed, setDismissed, checkNow, apply };
}

function UpdateStatus({ updater }: { updater: UpdaterControls }) {
  if (updater.phase === 'checking') return <><LoaderCircle className="mp-spin" size={17}/> Checking GitHub Releases…</>;
  if (updater.phase === 'downloading') return <><CloudDownload size={17}/> Downloading v{updater.version} {updater.percent !== null ? `· ${updater.percent.toFixed(0)}%` : '…'}</>;
  if (updater.phase === 'ready') return <><CheckCircle2 size={17}/> Version {updater.version} is ready to install.</>;
  if (updater.phase === 'installing') return <><LoaderCircle className="mp-spin" size={17}/> Installing securely. Maq's Passion will reopen.</>;
  if (updater.phase === 'error') return <>Update check failed: {updater.error}</>;
  if (updater.phase === 'current') return <>You're running the newest published version.</>;
  if (updater.phase === 'unconfigured') return <>Connect your GitHub Releases repository to enable updates.</>;
  if (updater.phase === 'unsupported') return <>Update checks run inside installed Windows builds, not dev mode.</>;
  return <>Checks GitHub Releases for signed Windows updates.</>;
}

export function UpdateSettings({updater}:{updater:UpdaterControls}) {
  return <section className="mp-update-settings">
    <div className="mp-update-title"><div className="mp-update-icon"><ArrowDownToLine size={18}/></div><div><h2>App updates</h2><p>Secure background downloads. No reinstalling every version.</p></div></div>
    <div className="mp-update-status"><UpdateStatus updater={updater}/></div>
    {updater.phase === 'downloading' && <div className="mp-update-bar"><span style={{width: `${updater.percent ?? 8}%`}}/></div>}
    <div className="mp-update-actions">
      {updater.phase === 'ready'
        ? <button className="mp-update-primary" type="button" onClick={()=>void updater.apply()}><RefreshCw size={15}/> Restart & update</button>
        : <button className="mp-update-secondary" type="button" disabled={updater.phase === 'checking'||updater.phase==='downloading'||updater.phase==='installing'||updater.phase==='unconfigured'} onClick={()=>void updater.checkNow()}><Download size={15}/> Check for updates</button>}
      {updateConfig.releaseUrl && <a href={updateConfig.releaseUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Release notes</a>}
    </div>
    {updater.phase==='unconfigured'&&<p className="mp-update-help">From the project folder, run <code>npm run updates:configure -- --repo OWNER/REPO --pubkey PATH_TO_PUBLIC_KEY</code>, then build an installer.</p>}
  </section>;
}

export function UpdateToast({updater}:{updater:UpdaterControls}) {
  const visible = updater.phase === 'ready' && !updater.dismissed;
  if (!visible) return null;
  return <aside className="mp-update-toast" role="status" aria-live="polite">
    <div className="mp-update-toast-icon"><CloudDownload size={19}/></div>
    <div className="mp-update-toast-copy"><strong>Update downloaded</strong><span>Version {updater.version} is ready. Restart to install.</span></div>
    <button type="button" className="mp-update-toast-action" onClick={()=>void updater.apply()}>Restart & update</button>
    <button type="button" aria-label="Remind me later" className="mp-update-toast-close" onClick={()=>updater.setDismissed(true)}><X size={16}/></button>
  </aside>;
}
