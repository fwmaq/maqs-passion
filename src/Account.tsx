import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Camera, CheckCircle2, Eye, EyeOff, LogOut, ShieldCheck, ArrowLeft, ImagePlus, Pencil, Trash2, Shield } from 'lucide-react';
import { supabase } from './supabase';
import './account.css';
import './profile-v213.css';

export const displayName = (user: User | null) =>
  (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()) ||
  user?.email?.split('@')[0] || 'Player';

export function Avatar({ user, size = 'sm' }: { user: User | null; size?: 'sm' | 'lg' }) {
  const uri = typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '';
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <span className={`account-avatar ${size === 'lg' ? 'account-avatar-large' : ''}`}>
    {uri && !failed ? <img src={uri} alt="Your profile picture" onError={() => setFailed(true)} />
      : <span aria-label="Default profile picture">{displayName(user).slice(0, 1).toUpperCase()}</span>}
  </span>;
}

export function AuthGate() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const configured = Boolean(supabase);

  function switchMode(next: typeof mode) {
    setMode(next); setError(''); setNotice(''); setPassword('');
    requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus());
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'signup') {
        const cleaned = name.trim();
        if (cleaned.length < 2 || cleaned.length > 28) throw new Error('Display name must be 2–28 characters.');
        if (password.length < 8) throw new Error('Password must contain at least 8 characters.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: cleaned } }
        });
        if (error) throw error;
        setPassword('');
        if (!data.session) setNotice('Account requested. Check your email to confirm it, then log in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please retry.');
    } finally { setBusy(false); }
  }

  return <div className="auth-screen">
    <div className="auth-aura" />
    <div className="auth-top-brand">MAQ'S PASSION<span>.</span><small>BUILT FOR THE GRIND</small></div>
    <div className="auth-panel" key={mode}>
      <div className="auth-kicker"><ShieldCheck size={15} /> COMPETITIVE PLATFORM</div>
      <h1>{mode === 'login' ? 'WELCOME BACK.' : 'JOIN THE GRIND.'}</h1>
      <p className="auth-lede">{mode === 'login' ? 'Sign in to your Maq’s Passion account.' : 'Your setup. Your progression. Your account.'}</p>
      {!configured ? <div className="auth-setup" role="alert"><strong>CONNECT SUPABASE</strong><p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in a <code>.env</code> file, then restart the app. See README.md for setup and avatar storage policies.</p></div>
      : <form onSubmit={submit} ref={formRef} className="auth-form">
          {mode === 'signup' && <label>DISPLAY NAME<input minLength={2} maxLength={28} required autoComplete="nickname" value={name} onChange={e=>setName(e.target.value)} placeholder="Your competitive name" /></label>}
          <label>EMAIL ADDRESS<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>PASSWORD<div className="auth-password"><input minLength={mode === 'signup' ? 8 : undefined} required type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} /><button aria-label={showPassword ? 'Hide password' : 'Show password'} type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="auth-notice" role="status"><CheckCircle2 size={16}/>{notice}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'PLEASE WAIT…' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'} <ArrowRight size={19}/></button>
        </form>}
      <div className="auth-links">
        {mode === 'login' ? <button onClick={()=>switchMode('signup')}>New here? <strong>Create account</strong></button>
        : <button onClick={()=>switchMode('login')}><ArrowLeft size={15}/> Back to login</button>}
      </div>
    </div>
    <footer className="auth-footer">MADE BY MAQ <span>© 2026 · BE THE BIGGEST BEG</span></footer>
  </div>;
}

export function ProfilePage({ user }: {user: User}) {
  const metadata = user.user_metadata ?? {};
  const [name,setName] = useState(displayName(user));
  const [bio,setBio] = useState(typeof metadata.bio === 'string' ? metadata.bio : '');
  const [customStatus,setCustomStatus] = useState(typeof metadata.custom_status === 'string' ? metadata.custom_status : '');
  const [password,setPassword] = useState('');
  const [status,setStatus] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [bannerFailed,setBannerFailed] = useState(false);
  const avatarPicker = useRef<HTMLInputElement>(null);
  const bannerPicker = useRef<HTMLInputElement>(null);
  const banner = typeof metadata.banner_url === 'string' ? metadata.banner_url : '';
  const joined = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB',{month:'long',year:'numeric'}) : '—';
  useEffect(()=>{
    setName(displayName(user));setBio(typeof user.user_metadata?.bio === 'string' ? user.user_metadata.bio : '');
    setCustomStatus(typeof user.user_metadata?.custom_status === 'string' ? user.user_metadata.custom_status : '');
  },[user]);
  useEffect(()=>setBannerFailed(false),[banner]);
  const saveFields = async(e:FormEvent)=>{
    e.preventDefault();if(!supabase||busy)return;
    setBusy(true);setError('');setStatus('');
    try{
      if(name.trim().length<2||name.trim().length>28)throw new Error('Display name must be between 2 and 28 characters.');
      const {error:problem}=await supabase.auth.updateUser({data:{display_name:name.trim(),bio:bio.trim().slice(0,160),custom_status:customStatus.trim().slice(0,42)}});
      if(problem)throw problem;
      setStatus('Profile saved.');
    }catch(err){setError(err instanceof Error?err.message:'Unable to save profile.');}
    finally{setBusy(false);}
  };
  async function uploadImage(e:ChangeEvent<HTMLInputElement>,type:'avatar'|'banner'){
    const file=e.target.files?.[0];if(!file||!supabase||busy)return;
    e.target.value='';setError('');setStatus('');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Choose a PNG, JPEG or WebP file.');return;}
    if(file.size>2*1024*1024){setError('Images must be 2 MB or smaller (Supabase avatars bucket limit).');return;}
    setBusy(true);
    try{
      const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
      const path=`${user.id}/${type}-${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await supabase.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const url=supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const {error:profileError}=await supabase.auth.updateUser({data:{[type==='avatar'?'avatar_url':'banner_url']:url}});
      if(profileError)throw profileError;
      setStatus(type==='banner'?'Banner updated.':'Profile picture updated.');
    }catch(err){setError(err instanceof Error?err.message:'Image upload failed. Check Supabase storage configuration.');}
    finally{setBusy(false);}
  }
  async function removeBanner(){
    if(!supabase||busy)return;setBusy(true);setError('');setStatus('');
    try{const {error:problem}=await supabase.auth.updateUser({data:{banner_url:null}});if(problem)throw problem;setStatus('Banner removed.');}
    catch(err){setError(err instanceof Error?err.message:'Could not remove banner.');}
    finally{setBusy(false);}
  }
  async function changePassword(e:FormEvent){
    e.preventDefault();if(!supabase||busy)return;setBusy(true);setError('');setStatus('');
    try{if(password.length<8)throw new Error('Use a password with at least 8 characters.');
      const {error:problem}=await supabase.auth.updateUser({password});if(problem)throw problem;
      setPassword('');setStatus('Password updated.');
    }catch(err){setError(err instanceof Error?err.message:'Unable to change password.');}
    finally{setBusy(false);}
  }
  return <section className="profile-v3-page">
    <header className="profile-v3-heading"><div><span>PLAYER IDENTITY</span><h1>My profile<span>.</span></h1><p>Personalise your presence on Maq's Passion.</p></div></header>
    <div className="profile-v3-card">
      <div className="profile-v3-banner">
        {banner&&!bannerFailed&&<img src={banner} alt="Your profile banner" onError={()=>setBannerFailed(true)}/>}
        <div className="profile-v3-banner-actions"><input ref={bannerPicker} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadImage(e,'banner')}/>
          <button type="button" disabled={busy} onClick={()=>bannerPicker.current?.click()}><ImagePlus size={15}/> {banner?'Change banner':'Add banner'}</button>
          {banner&&<button type="button" disabled={busy} onClick={()=>void removeBanner()} aria-label="Remove banner"><Trash2 size={15}/></button>}
        </div>
      </div>
      <div className="profile-v3-identity"><div className="profile-v3-avatar"><Avatar user={user} size="lg"/><span className="profile-v3-status-dot"/></div>
        <div className="profile-v3-title"><h2>{displayName(user)}</h2><p>{customStatus||'Ready to grind.'}</p></div>
        <input ref={avatarPicker} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadImage(e,'avatar')}/>
        <button type="button" className="profile-v3-change-avatar" disabled={busy} onClick={()=>avatarPicker.current?.click()}><Camera size={15}/> Edit avatar</button>
      </div>
      <div className="profile-v3-about"><div><small>ABOUT ME</small><p>{bio||'Add a short bio to tell other players about yourself.'}</p></div><div><small>MEMBER SINCE</small><p>{joined}</p></div></div>
    </div>
    <div className="profile-v3-sections">
      <form className="profile-v3-form" onSubmit={saveFields}><header><Pencil size={17}/><h3>Edit profile</h3></header>
        <label>Display name<input required minLength={2} maxLength={28} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>Status <small>{customStatus.length}/42</small><input maxLength={42} placeholder="Grinding mechanics…" value={customStatus} onChange={e=>setCustomStatus(e.target.value)}/></label>
        <label>About me <small>{bio.length}/160</small><textarea rows={3} maxLength={160} placeholder="Your playstyle, goals, favourite mode…" value={bio} onChange={e=>setBio(e.target.value)}/></label>
        <button type="submit" disabled={busy}>{busy?'Saving…':'Save profile'}</button>
      </form>
      <div className="profile-v3-account"><header><Shield size={17}/><h3>Account & privacy</h3></header>
        <div className="profile-v3-account-email"><small>SIGNED IN AS</small><strong>{user.email}</strong></div>
        <details><summary>Change password</summary><form onSubmit={changePassword}><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="New password (8+ characters)" required/><button disabled={busy}>Update password</button></form></details>
        <p>Images are uploaded to your public Supabase avatars bucket. Avoid putting private information in your banner or bio.</p>
        <button type="button" className="profile-v3-signout" onClick={()=>void supabase?.auth.signOut()}><LogOut size={15}/> Sign out</button>
      </div>
    </div>
    {status&&<div className="auth-notice" role="status"><CheckCircle2 size={16}/>{status}</div>}
    {error&&<div className="auth-error" role="alert">{error}</div>}
  </section>;
}
