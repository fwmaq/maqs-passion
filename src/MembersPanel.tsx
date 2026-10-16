import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ChevronDown, ChevronRight, CircleAlert, Crown, RefreshCw, Search, Shield, Users, X } from 'lucide-react';
import { supabase } from './supabase';
import './members.css';

type Role = 'owner' | 'admin' | 'moderator' | 'vip' | 'member';
type MemberProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
};
const roleOrder: Role[] = ['owner', 'admin', 'moderator', 'vip', 'member'];
const roleNames: Record<Role, string> = { owner: 'Owner', admin: 'Admin', moderator: 'Moderator', vip: 'VIP', member: 'Member' };
const byRole = (a: MemberProfile, b: MemberProfile) =>
  roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.display_name.localeCompare(b.display_name);

function MemberAvatar({ member, online }: { member: MemberProfile; online: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [member.avatar_url]);
  return <span className="member-avatar">
    {member.avatar_url && !failed ? <img src={member.avatar_url} alt="" onError={() => setFailed(true)} />
      : <span>{(member.display_name || '?').slice(0, 1).toUpperCase()}</span>}
    <i className={`member-dot ${online ? 'member-dot-online' : ''}`} aria-hidden="true" />
  </span>;
}

function MemberCard({ member, online, role, myId, onSetRole, busy }: {
  member: MemberProfile;
  online: boolean;
  role: Role;
  myId: string;
  onSetRole: (id: string, next: Role) => Promise<void>;
  busy: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const canEdit = member.id !== myId && member.role !== 'owner' &&
    (role === 'owner' || (role === 'admin' && member.role !== 'admin'));
  const choices: Role[] = role === 'owner' ? ['admin', 'moderator', 'vip', 'member'] : ['moderator', 'vip', 'member'];

  return <div className={`member-row ${expanded ? 'member-row-expanded' : ''}`}>
    <button type="button" className="member-identity" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
      <MemberAvatar member={member} online={online} />
      <span className="member-details">
        <strong title={member.display_name}>{member.display_name}{member.id === myId ? ' (You)' : ''}</strong>
        <small className={`member-role member-role-${member.role}`}>
          {member.role === 'owner' ? <Crown size={11} /> : member.role === 'admin' || member.role === 'moderator' ? <Shield size={11} /> : null}
          {roleNames[member.role]}
        </small>
      </span>
      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
    </button>
    {expanded && <div className="member-expanded">
      <span className="member-expanded-presence">{online ? '● Online in Maq’s Passion' : 'Offline'}</span>
      {canEdit ? <label className="member-role-editor">ASSIGN ROLE
        <select value={member.role} disabled={busy === member.id} onChange={event => void onSetRole(member.id, event.target.value as Role)}>
          {choices.map(option => <option key={option} value={option}>{roleNames[option]}</option>)}
        </select>
      </label> : <span className="member-muted">{member.id === myId ? 'Your own role cannot be changed here.' : 'Role managed by staff.'}</span>}
    </div>}
  </div>;
}

export function MembersPanel({ user, onClose }: { user: User; onClose: () => void }) {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [showOffline, setShowOffline] = useState(false);
  const [connection, setConnection] = useState('CONNECTING');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error: loadError } = await supabase.from('member_profiles')
      .select('id,display_name,avatar_url,role').order('display_name').limit(500);
    if (loadError) { setError(`Members unavailable: ${loadError.message}. Run supabase/members.sql first.`); return; }
    setMembers((data || []) as MemberProfile[]);
    setError('');
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    void refresh();
    const channel = client.channel('maq-members-online', {
      config: { private: true, presence: { key: user.id } },
    });
    channel.on('presence', { event: 'sync' }, () => {
      if (cancelled) return;
      const presence = channel.presenceState();
      setOnlineIds(new Set(Object.entries(presence).filter(([, entries]) => entries.length > 0).map(([id]) => id)));
      void refresh();
    });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'member_profiles' }, () => {
      if (!cancelled) void refresh();
    });
    void client.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled || !session) return;
      await client.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel.subscribe(async status => {
        if (cancelled) return;
        setConnection(status);
        if (status === 'SUBSCRIBED') {
          const result = await channel.track({ online_at: new Date().toISOString() });
          if (result !== 'ok') setError('Could not publish your online status. Check Realtime policies.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Realtime presence is unavailable. Check Supabase Realtime policies and connectivity.');
        }
      });
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not connect to presence.'); });
    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [user.id, refresh]);

  const myRole: Role = members.find(m => m.id === user.id)?.role ?? 'member';
  const filtered = useMemo(() => members.filter(m =>
    m.display_name.toLowerCase().includes(query.trim().toLowerCase())), [members, query]);
  const online = filtered.filter(m => onlineIds.has(m.id)).sort(byRole);
  const offline = filtered.filter(m => !onlineIds.has(m.id)).sort(byRole);

  async function assignRole(id: string, next: Role) {
    if (!supabase || busy) return;
    setBusy(id); setError(''); setNotice('');
    const { error: changeError } = await supabase.rpc('set_member_role', { target_user_id: id, new_role: next });
    if (changeError) setError(`Role change rejected: ${changeError.message}`);
    else { setNotice(`Role updated to ${roleNames[next]}.`); await refresh(); }
    setBusy(null);
  }

  return <aside className="members-panel" aria-label="Community members">
    <header className="members-header">
      <div className="members-heading-small">MAQ'S PASSION / COMMUNITY</div>
      <div className="members-heading-row"><h2>MEMBERS<span>.</span></h2><button type="button" aria-label="Close members panel" title="Hide members" onClick={onClose}><X size={18}/></button></div>
      <div className="members-count"><span className="members-status-pip" /> <strong>{onlineIds.size}</strong> ONLINE <span className="members-count-dot">·</span> {members.length} MEMBERS</div>
      <label className="members-search"><Search size={15}/><input aria-label="Search members" value={query} placeholder="Find a member..." onChange={e => setQuery(e.target.value)}/></label>
    </header>
    <div className="members-scroll">
      {error && <div className="members-alert" role="alert"><CircleAlert size={14}/>{error}</div>}
      {notice && <div className="members-notice" role="status">{notice}</div>}
      <div className="members-group-heading"><span>ONLINE — {online.length}</span><button type="button" onClick={() => void refresh()} title="Refresh members" aria-label="Refresh members"><RefreshCw size={14}/></button></div>
      {connection !== 'SUBSCRIBED' && <p className="members-help">Connecting to live presence…</p>}
      {online.map(member => <MemberCard key={member.id} member={member} online role={myRole} myId={user.id} onSetRole={assignRole} busy={busy}/>)}
      {!online.length && connection === 'SUBSCRIBED' && <p className="members-empty">Nobody is showing online yet.</p>}
      <button type="button" className="members-offline-toggle" onClick={() => setShowOffline(v => !v)} aria-expanded={showOffline}>
        {showOffline ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
        OFFLINE — {offline.length}
      </button>
      {showOffline && offline.map(member => <MemberCard key={member.id} member={member} online={false} role={myRole} myId={user.id} onSetRole={assignRole} busy={busy}/>)}
      {showOffline && !offline.length && <p className="members-empty">No offline members matched.</p>}
    </div>
    <footer className="members-footer"><Users size={14}/><span>{myRole === 'owner' || myRole === 'admin' ? 'SELECT A MEMBER TO MANAGE ROLES' : 'LIVE COMMUNITY PRESENCE'}</span></footer>
  </aside>;
}
