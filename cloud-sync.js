/**
 * סנכרון E2E דרך Supabase: בטבלה נשמר רק ciphertext. RLS מגביל ל-user_id.
 * דורש: תג סקריפט @supabase/supabase-js לפני הקובץ (index.html / build).
 * דורש: Crypto, getMeta, setMeta, state, masterPassword, defaultState, mergeUiLabelsFromData, saveState, render, toast, recordFullBackupExported
 */
let _cloudSb = null;
let _cloudSbCacheKey = '';

function resetCloudSupabaseClient(){
  _cloudSb = null;
  _cloudSbCacheKey = '';
}

function cloudSupabaseUrl(){
  return (state && state.settings && state.settings.supabaseUrl || '').trim().replace(/\/$/, '');
}

function cloudSupabaseAnon(){
  return (state && state.settings && state.settings.supabaseAnonKey || '').trim();
}

function cloudSupabaseEmailVal(){
  return (state && state.settings && state.settings.supabaseAuthEmail || '').trim().toLowerCase();
}

function cloudVaultPasswordInput(){
  const el = document.getElementById('settingCloudVaultPass');
  return el ? (el.value || '') : '';
}

function getCloudSupabase(){
  const url = cloudSupabaseUrl();
  const key = cloudSupabaseAnon();
  if (!url || !key) return null;
  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    return null;
  }
  const cacheKey = url + '|' + key;
  if (_cloudSb && _cloudSbCacheKey === cacheKey) return _cloudSb;
  _cloudSb = supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  _cloudSbCacheKey = cacheKey;
  return _cloudSb;
}

async function cloudSyncRefreshSessionMeta(){
  if (!state) return;
  const url = cloudSupabaseUrl();
  const key = cloudSupabaseAnon();
  const m = getMeta();
  if (!url || !key) {
    m.supabaseHasSession = false;
    setMeta(m);
    return;
  }
  const sb = getCloudSupabase();
  if (!sb) {
    m.supabaseHasSession = false;
    setMeta(m);
    return;
  }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      m.supabaseHasSession = true;
      if (session.user.email) state.settings.supabaseAuthEmail = session.user.email;
    } else {
      m.supabaseHasSession = false;
    }
  } catch (e) {
    console.error(e);
    m.supabaseHasSession = false;
  }
  setMeta(m);
}

function cloudVaultAuthed(){
  return !!(getMeta().supabaseHasSession && cloudSupabaseUrl() && cloudSupabaseAnon());
}

async function cloudVaultSaveUrls(){
  if (!state) return;
  embeddedSupabaseDefaults(state.settings);
  const uEl=document.getElementById('settingSupabaseUrl');
  const kEl=document.getElementById('settingSupabaseAnonKey');
  const eEl=document.getElementById('settingSupabaseAuthEmail');
  if(uEl){
    const v=(uEl.value||'').trim().replace(/\/$/,'');
    if(v)state.settings.supabaseUrl=v;
  }
  if(kEl){
    const v=(kEl.value||'').trim();
    if(v)state.settings.supabaseAnonKey=v;
  }
  if(eEl){
    const v=(eEl.value||'').trim().toLowerCase();
    if(v)state.settings.supabaseAuthEmail=v;
  }
  resetCloudSupabaseClient();
  const mm = getMeta();
  mm.supabaseHasSession = false;
  setMeta(mm);
  await saveState();
  await cloudSyncRefreshSessionMeta();
  toast('חיבור סופבייס נשמר', 'success');
  render();
}

async function cloudVaultRegister(){
  if (!state) { toast('פתחו את האפליקציה', 'error'); return; }
  const url = cloudSupabaseUrl();
  const key = cloudSupabaseAnon();
  const email = (document.getElementById('settingSupabaseAuthEmail').value || '').trim().toLowerCase();
  const pass = cloudVaultPasswordInput();
  if (!url || !key) { toast('מלאו כתובת סופבייס ומפתח anon', 'error'); return; }
  if (!email.includes('@')) { toast('אימייל לא תקין', 'error'); return; }
  if (pass.length < 6) { toast('סיסמת סופבייס: לפחות 6 תווים', 'error'); return; }
  const sb = getCloudSupabase();
  if (!sb) { toast('ספריית Supabase לא נטענה — רענון קשיח לדף', 'error'); return; }
  try {
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) {
      toast('הרשמה: ' + (error.message || 'שגיאה'), 'error');
      return;
    }
    if (data.session) {
      state.settings.supabaseAuthEmail = email;
      const m = getMeta();
      m.supabaseHasSession = true;
      setMeta(m);
      await saveState();
      toast('נרשמתם ומחוברים', 'success');
      if (typeof teamInitAfterUnlock === 'function') { try { await teamInitAfterUnlock(); } catch (e) { console.error(e); } }
      render();
      return;
    }
    const { error: e2 } = await sb.auth.signInWithPassword({ email, password: pass });
    if (e2) {
      toast('נרשמתם — אשרו מייל או כבו «Confirm email» בלוח הסופבייס (Authentication)', '');
      return;
    }
    state.settings.supabaseAuthEmail = email;
    const m = getMeta();
    m.supabaseHasSession = true;
    setMeta(m);
    await saveState();
    toast('מחוברים', 'success');
    if (typeof teamInitAfterUnlock === 'function') { try { await teamInitAfterUnlock(); } catch (e) { console.error(e); } }
    render();
  } catch (e) {
    console.error(e);
    toast('שגיאת רשת', 'error');
  }
}

async function cloudVaultLogin(){
  if (!state) { toast('פתחו את האפליקציה', 'error'); return; }
  const url = cloudSupabaseUrl();
  const key = cloudSupabaseAnon();
  const email = (document.getElementById('settingSupabaseAuthEmail').value || '').trim().toLowerCase();
  const pass = cloudVaultPasswordInput();
  if (!url || !key || !email || pass.length < 6) {
    toast('מלאו כתובת, מפתח, אימייל וסיסמה', 'error');
    return;
  }
  const sb = getCloudSupabase();
  if (!sb) { toast('ספריית Supabase לא נטענה', 'error'); return; }
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) {
      toast('התחברות נכשלה: ' + (error.message || ''), 'error');
      return;
    }
    state.settings.supabaseAuthEmail = email;
    const m = getMeta();
    m.supabaseHasSession = true;
    setMeta(m);
    await saveState();
    toast('מחוברים לסופבייס', 'success');
    if (typeof teamInitAfterUnlock === 'function') { try { await teamInitAfterUnlock(); } catch (e) { console.error(e); } }
    render();
  } catch (e) {
    console.error(e);
    toast('שגיאת רשת', 'error');
  }
}

async function cloudVaultLogout(){
  if (typeof teamSyncStopRealtime === 'function') try { teamSyncStopRealtime(); } catch (e) {}
  const sb = getCloudSupabase();
  if (sb) {
    try { await sb.auth.signOut(); } catch (e) { console.error(e); }
  }
  resetCloudSupabaseClient();
  const m = getMeta();
  m.supabaseHasSession = false;
  setMeta(m);
  const el = document.getElementById('settingCloudVaultPass');
  if (el) el.value = '';
  toast('נותקתם מסופבייס', 'success');
  render();
}

async function cloudVaultPush(){
  if (!state || !masterPassword) { toast('לא זמין', 'error'); return; }
  const sb = getCloudSupabase();
  if (!sb) { toast('מלאו והגדירו סופבייס', 'error'); return; }
  try {
    const { data: { user }, error: uerr } = await sb.auth.getUser();
    if (uerr || !user) {
      toast('התחברו מחדש לסופבייס', 'error');
      return;
    }
    const json = JSON.stringify(state);
    const ciphertext = await Crypto.encrypt(json, masterPassword);
    const { data: row } = await sb.from('user_vaults').select('version').eq('user_id', user.id).maybeSingle();
    const nextVer = (row && typeof row.version === 'number' ? row.version : 0) + 1;
    const { error } = await sb.from('user_vaults').upsert(
      {
        user_id: user.id,
        ciphertext,
        updated_at: new Date().toISOString(),
        version: nextVer,
        device_id: state.deviceId,
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      toast('העלאה נכשלה: ' + (error.message || 'RLS'), 'error');
      return;
    }
    if (typeof recordFullBackupExported === 'function') recordFullBackupExported();
    toast('הנתונים הועלו (מוצפנים). גרסה ' + nextVer, 'success');
  } catch (e) {
    console.error(e);
    toast('שגיאה בהעלאה', 'error');
  }
}

async function cloudVaultPull(){
  if (!state || !masterPassword) { toast('לא זמין', 'error'); return; }
  const sb = getCloudSupabase();
  if (!sb) { toast('הגדירו סופבייס', 'error'); return; }
  try {
    const { data: { user }, error: uerr } = await sb.auth.getUser();
    if (uerr || !user) {
      toast('התחברו מחדש לסופבייס', 'error');
      return;
    }
    const { data, error } = await sb.from('user_vaults').select('ciphertext').eq('user_id', user.id).maybeSingle();
    if (error) {
      toast('שגיאה: ' + (error.message || ''), 'error');
      return;
    }
    if (!data || !data.ciphertext) {
      toast('אין עדיין גיבוי בענן — העלו פעם ראשונה ממכשיר אחר', '');
      return;
    }
    if (!confirm('להחליף את כל הנתונים במכשיר בגרסה מהענן?\nכל השינויים המקומיים שלא הועלו יימחקו.')) return;
    let parsed;
    try {
      const raw = await Crypto.decrypt(data.ciphertext, masterPassword);
      parsed = JSON.parse(raw);
    } catch (err) {
      toast('לא ניתן לפענח — ודאו שסיסמת האפליקציה זהה למכשיר שהעלה', 'error');
      return;
    }
    const oldDeviceId = state.deviceId;
    const keep = {
      supabaseUrl: state.settings.supabaseUrl,
      supabaseAnonKey: state.settings.supabaseAnonKey,
      supabaseAuthEmail: state.settings.supabaseAuthEmail,
    };
    const def = defaultState();
    const ds = parsed.settings || {};
    state = Object.assign(def, parsed, {
      deviceId: oldDeviceId,
      settings: Object.assign(def.settings, ds, {
        showInDashboard: Object.assign(def.settings.showInDashboard, (ds).showInDashboard || {}),
        myName: ds.myName || '',
        partnerName: ds.partnerName || '',
        uiLabels: mergeUiLabelsFromData(ds.uiLabels),
        sheetsSyncUrl: typeof ds.sheetsSyncUrl === 'string' ? ds.sheetsSyncUrl : '',
        sheetsSyncSecret: typeof ds.sheetsSyncSecret === 'string' ? ds.sheetsSyncSecret : '',
        defaultWhatsAppPhone: typeof ds.defaultWhatsAppPhone === 'string' ? ds.defaultWhatsAppPhone : '',
        supabaseUrl: keep.supabaseUrl,
        supabaseAnonKey: keep.supabaseAnonKey,
        supabaseAuthEmail: keep.supabaseAuthEmail,
        backupReminderDays: typeof ds.backupReminderDays === 'number' ? ds.backupReminderDays : def.settings.backupReminderDays,
      }),
    });
    await saveState();
    await cloudSyncRefreshSessionMeta();
    render();
    toast('המכשיר עודכן מהענן', 'success');
  } catch (e) {
    console.error(e);
    toast('שגיאה במשיכה', 'error');
  }
}
