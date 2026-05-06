/**
 * סנכרון צוות: טבלת fm_documents ב-Supabase + Realtime.
 * תלוי: cloud-sync.js (getCloudSupabase, cloudVaultAuthed), app-part-a (state, saveState, defaultState, mergeUiLabelsFromData, embeddedSupabaseDefaults)
 */
const TEAM_COLLECTIONS = ['accounts', 'categories', 'transactions', 'checks', 'recurring', 'budgets', 'tasks', 'events'];

let _teamSyncTimer = null;
let _teamChannel = null;
let _teamPulling = false;

function getTeamWorkspaceId(){
  return (state && state.settings && state.settings.teamWorkspaceId) || null;
}

function setTeamWorkspaceId(id){
  if(!state || !state.settings) return;
  const s = id == null ? '' : String(id).trim();
  state.settings.teamWorkspaceId = s || null;
}

function teamSyncActive(){
  return !!(cloudVaultAuthed() && getTeamWorkspaceId() && getCloudSupabase());
}

function settingsDocForCloud(){
  const s = state && state.settings ? state.settings : {};
  const o = JSON.parse(JSON.stringify(s));
  delete o.supabaseUrl;
  delete o.supabaseAnonKey;
  delete o.supabaseAuthEmail;
  delete o.teamWorkspaceId;
  return o;
}

function mergeCloudSettingsIntoState(doc){
  if(!doc || typeof doc !== 'object') return;
  const clean = Object.assign({}, doc);
  delete clean.id;
  const localUrl = state.settings.supabaseUrl;
  const localKey = state.settings.supabaseAnonKey;
  const localEmail = state.settings.supabaseAuthEmail;
  const localTeam = state.settings.teamWorkspaceId;
  Object.assign(state.settings, clean);
  state.settings.supabaseUrl = localUrl;
  state.settings.supabaseAnonKey = localKey;
  state.settings.supabaseAuthEmail = localEmail;
  state.settings.teamWorkspaceId = localTeam;
  state.settings.uiLabels = mergeUiLabelsFromData(state.settings.uiLabels);
  embeddedSupabaseDefaults(state.settings);
}

function normalizeDoc(row){
  const d = row.doc && typeof row.doc === 'object' ? Object.assign({}, row.doc) : {};
  if (!d.id) d.id = row.id;
  return d;
}

function applyTeamPullRows(rows){
  if(!state || !Array.isArray(rows)) return;
  const dev = state.deviceId;
  const byCol = {};
  rows.forEach(r => {
    const c = r.collection;
    if (!byCol[c]) byCol[c] = [];
    byCol[c].push(normalizeDoc(r));
  });
  TEAM_COLLECTIONS.forEach(c => {
    state[c] = byCol[c] ? byCol[c] : [];
  });
  if (byCol.settings && byCol.settings.length){
    const appRow = byCol.settings.find(x => x.id === 'app') || byCol.settings[0];
    if (appRow) mergeCloudSettingsIntoState(appRow);
  }
  state.deviceId = dev;
}

async function teamSyncPullFull(){
  if (!teamSyncActive()) return false;
  const sb = getCloudSupabase();
  const wid = getTeamWorkspaceId();
  _teamPulling = true;
  try{
    const { data, error } = await sb.from('fm_documents').select('collection,id,doc,updated_at').eq('workspace_id', wid);
    if (error){
      toast('משיכת צוות נכשלה: ' + (error.message || ''), 'error');
      return false;
    }
    applyTeamPullRows(data || []);
    await saveState();
    return true;
  }catch(e){
    console.error(e);
    toast('שגיאת סנכרון צוות', 'error');
    return false;
  }finally{
    _teamPulling = false;
  }
}

async function teamSyncPushFull(){
  if (!teamSyncActive() || !masterPassword){ toast('סנכרון צוות דורש פתיחת אפליקציה והתחברות לסופבייס', 'error'); return false; }
  const sb = getCloudSupabase();
  const wid = getTeamWorkspaceId();
  const rows = [];
  TEAM_COLLECTIONS.forEach(c => {
    (state[c] || []).forEach(item => {
      if (!item || !item.id) return;
      const doc = JSON.parse(JSON.stringify(item));
      rows.push({
        workspace_id: wid,
        collection: c,
        id: String(doc.id),
        doc,
        updated_at: new Date().toISOString(),
      });
    });
  });
  rows.push({
    workspace_id: wid,
    collection: 'settings',
    id: 'app',
    doc: settingsDocForCloud(),
    updated_at: new Date().toISOString(),
  });
  const chunk = 300;
  try{
    for (let i = 0; i < rows.length; i += chunk){
      const part = rows.slice(i, i + chunk);
      const { error } = await sb.from('fm_documents').upsert(part, { onConflict: 'workspace_id,collection,id' });
      if (error){
        toast('דחיפת צוות נכשלה: ' + (error.message || ''), 'error');
        return false;
      }
    }
    toast('סנכרון צוות הועלה (' + rows.length + ' מסמכים)', 'success');
    return true;
  }catch(e){
    console.error(e);
    toast('שגיאת דחיפת צוות', 'error');
    return false;
  }
}

function scheduleTeamSyncFlush(){
  if (!teamSyncActive() || _teamPulling) return;
  if (_teamSyncTimer) clearTimeout(_teamSyncTimer);
  _teamSyncTimer = setTimeout(() => {
    _teamSyncTimer = null;
    teamSyncPushFull().catch(() => {});
  }, 1200);
}

function teamSyncStopRealtime(){
  const sb = getCloudSupabase();
  if (_teamChannel && sb){
    try{ sb.removeChannel(_teamChannel); }catch(e){}
  }
  _teamChannel = null;
}

let _teamRemoteDebounce = null;
function teamSyncStartRealtime(){
  teamSyncStopRealtime();
  if (!teamSyncActive()) return;
  const sb = getCloudSupabase();
  const wid = getTeamWorkspaceId();
  if (!sb || !wid) return;
  _teamChannel = sb.channel('fm_realtime_' + String(wid).slice(0, 8))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fm_documents', filter: 'workspace_id=eq.' + wid },
      () => {
        if (_teamRemoteDebounce) clearTimeout(_teamRemoteDebounce);
        _teamRemoteDebounce = setTimeout(async () => {
          _teamRemoteDebounce = null;
          const ok = await teamSyncPullFull();
          if (ok && typeof render === 'function') render();
        }, 400);
      }
    )
    .subscribe();
}

async function teamEnsureWorkspace(){
  const sb = getCloudSupabase();
  if (!sb || !cloudVaultAuthed()){
    toast('התחברו לסופבייס קודם', 'error');
    return;
  }
  try{
    const { data, error } = await sb.rpc('ensure_my_workspace', { p_name: (state.settings.myName || 'המשפחה').trim() || 'המשפחה' });
    if (error){
      toast('יצירת workspace: ' + (error.message || ''), 'error');
      return;
    }
    const wid = data;
    if (!wid){
      toast('לא התקבל מזהה workspace', 'error');
      return;
    }
    setTeamWorkspaceId(wid);
    await saveState();
    await teamSyncPushFull();
    teamSyncStartRealtime();
    toast('סנכרון צוות הופעל', 'success');
    if (typeof render === 'function') render();
  }catch(e){
    console.error(e);
    toast('שגיאת workspace', 'error');
  }
}

async function teamJoinByToken(tokenRaw){
  const sb = getCloudSupabase();
  if (!sb || !cloudVaultAuthed()){
    toast('התחברו לסופבייס קודם', 'error');
    return;
  }
  const token = (tokenRaw || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)){
    toast('הדביקו UUID תקין של הזמנה', 'error');
    return;
  }
  try{
    const { data, error } = await sb.rpc('join_workspace_by_token', { p_token: token });
    if (error){
      toast('הצטרפות נכשלה: ' + (error.message || ''), 'error');
      return;
    }
    setTeamWorkspaceId(data);
    await saveState();
    await teamSyncPullFull();
    teamSyncStartRealtime();
    toast('הצטרפתם לצוות', 'success');
    if (typeof render === 'function') render();
  }catch(e){
    console.error(e);
    toast('שגיאת הצטרפות', 'error');
  }
}

async function teamLoadInviteInfo(){
  if (!teamSyncActive()) return null;
  const sb = getCloudSupabase();
  const wid = getTeamWorkspaceId();
  try{
    const { data, error } = await sb.from('workspaces').select('invite_token, open_invites, name').eq('id', wid).maybeSingle();
    if (error || !data) return null;
    return data;
  }catch(e){
    return null;
  }
}

async function teamInitAfterUnlock(){
  if (!teamSyncActive()) return;
  await teamSyncPullFull();
  teamSyncStartRealtime();
}

async function teamShowInviteToken(){
  const inv = await teamLoadInviteInfo();
  if (!inv || !inv.invite_token){
    toast('לא ניתן לטעון קוד הזמנה (ודאו שמקושרים ל-workspace)', 'error');
    return;
  }
  window.prompt('העתיקו והעבירו לחבר הצוות — קוד ההזמנה (UUID):', String(inv.invite_token));
}

async function teamClearWorkspaceLocal(){
  if (!state) return;
  if (!confirm('לנתק מסנכרון צוות במכשיר זה? הנתונים המקומיים נשארים; לא יבוצעו דחיפות אוטומטיות לענן עד שתקשרו מחדש.')) return;
  setTeamWorkspaceId('');
  teamSyncStopRealtime();
  await saveState();
  toast('המכשיר נותק מ-workspace', 'success');
  if (typeof render === 'function') render();
}
