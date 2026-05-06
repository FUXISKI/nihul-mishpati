const SESSION_PWD_KEY='nm_sess_pwd_v1';

function webAuthnErrorHint(e){
  if(typeof window!=='undefined'&&!window.isSecureContext){
    return 'נדרש חיבור מאובטח (HTTPS או localhost). פתיחה מקובץ במחשב או מ־HTTP פשוט ברשת — לא מאפשרים ביומטרי. העלו את האפליקציה לאתר עם HTTPS.';
  }
  const name=e&&e.name||'';
  const msg=String((e&&e.message)||'');
  if(name==='SecurityError'||/public-key credentials|secure context|https origins|valid certificates/i.test(msg)){
    return 'הדפדפן חוסם ביומטרי בכתובת הזו. צריך אתר ב־HTTPS (אישור תקף) או פתיחה מ־http://localhost / 127.0.0.1 בלבד — לא מקובץ ולא מ־HTTP של מחשב אחר ברשת.';
  }
  if(name==='NotAllowedError')return 'הבקשה בוטלה או לא אושרה.';
  if(name==='InvalidStateError')return 'כבר קיימת הרשמה — לחצו «בטל ביומטרי» ונסו שוב.';
  if(name==='NotSupportedError')return 'הדפדפן או המכשיר לא תומכים.';
  if(msg)return 'לא ניתן להשלים ('+name+'). נסו מ־HTTPS או בדקו הרשאות.';
  return 'לא ניתן להשלים. נסו מ־HTTPS.';
}

function applyReopenStash(password){
  const meta=getMeta();
  const mode=meta.reopenMode||'always';
  if(mode==='session'){
    try{sessionStorage.setItem(SESSION_PWD_KEY,password)}catch(err){}
    delete meta.quickUntil;
    delete meta.quickEncPwd;
    setMeta(meta);
    return;
  }
  if(mode==='timed'){
    const minutes=Math.max(15,Math.min(43200,meta.reopenQuietMinutes||480));
    meta.quickUntil=Date.now()+minutes*60000;
    meta.quickEncPwd=btoa(password);
    setMeta(meta);
    try{sessionStorage.removeItem(SESSION_PWD_KEY)}catch(err){}
    return;
  }
  try{sessionStorage.removeItem(SESSION_PWD_KEY)}catch(err){}
  delete meta.quickUntil;
  delete meta.quickEncPwd;
  setMeta(meta);
}

async function attemptAutoUnlock(){
  const meta=getMeta();
  if(!meta.passwordHash)return false;
  const mode=meta.reopenMode||'always';
  let password=null;
  if(mode==='session'){
    try{password=sessionStorage.getItem(SESSION_PWD_KEY)||null}catch(err){password=null}
  }else if(mode==='timed'){
    if(meta.quickUntil&&meta.quickEncPwd&&Date.now()<meta.quickUntil){
      try{password=atob(meta.quickEncPwd)}catch(e){password=null}
    }else if(meta.quickUntil&&Date.now()>=meta.quickUntil){
      delete meta.quickUntil;
      delete meta.quickEncPwd;
      setMeta(meta);
    }
  }
  if(!password)return false;
  try{
    const ok=await Crypto.verifyPassword(password,meta.passwordHash);
    if(!ok){
      try{sessionStorage.removeItem(SESSION_PWD_KEY)}catch(err){}
      delete meta.quickUntil;
      delete meta.quickEncPwd;
      setMeta(getMeta());
      return false;
    }
    state=await loadState(password);
    masterPassword=password;
    meta.failedAttempts=0;
    setMeta(meta);
    document.getElementById('lockScreen').style.display='none';
    document.getElementById('mainApp').style.display='flex';
    render();
    if(typeof cloudSyncRefreshSessionMeta==='function'){
      cloudSyncRefreshSessionMeta().then(async function(){
        if(typeof teamInitAfterUnlock==='function'){try{await teamInitAfterUnlock()}catch(e){console.error(e)}}
        render();
      }).catch(function(){render()});
    }else if(typeof teamInitAfterUnlock==='function'){
      teamInitAfterUnlock().then(function(){render()}).catch(function(){render()});
    }
    handleUrlAction();
    resetInactivityTimer();
    return true;
  }catch(e){
    try{sessionStorage.removeItem(SESSION_PWD_KEY)}catch(err){}
    const m=getMeta();
    delete m.quickUntil;
    delete m.quickEncPwd;
    setMeta(m);
    return false;
  }
}

async function tryUnlock(){
  const password=document.getElementById('lockInput').value;
  const errorEl=document.getElementById('lockError');
  errorEl.textContent='';
  if(!password){errorEl.textContent='הזן סיסמה';return}
  const meta=getMeta();
  if((meta.failedAttempts||0)>=10){
    errorEl.textContent='יותר מדי ניסיונות. הנתונים נמחקים...';
    setTimeout(()=>{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(META_KEY);location.reload()},1500);
    return;
  }
  try{
    const ok=await Crypto.verifyPassword(password,meta.passwordHash);
    if(!ok)throw new Error('wrong');
    state=await loadState(password);
    masterPassword=password;
    meta.failedAttempts=0;
    setMeta(meta);
    applyReopenStash(password);
    document.getElementById('lockScreen').style.display='none';
    document.getElementById('mainApp').style.display='flex';
    render();
    if(typeof cloudSyncRefreshSessionMeta==='function'){
      cloudSyncRefreshSessionMeta().then(async function(){
        if(typeof teamInitAfterUnlock==='function'){try{await teamInitAfterUnlock()}catch(e){console.error(e)}}
        render();
      }).catch(function(){render()});
    }else if(typeof teamInitAfterUnlock==='function'){
      teamInitAfterUnlock().then(function(){render()}).catch(function(){render()});
    }
    handleUrlAction();
    resetInactivityTimer();
  }catch(e){
    meta.failedAttempts=(meta.failedAttempts||0)+1;
    setMeta(meta);
    const remaining=10-meta.failedAttempts;
    errorEl.textContent='סיסמה שגויה';
    document.getElementById('lockAttempts').textContent=remaining>0?`נותרו ${remaining} ניסיונות לפני מחיקת הנתונים`:'';
    document.getElementById('lockInput').value='';
    if(meta.failedAttempts>=10){
      errorEl.textContent='יותר מדי ניסיונות. הנתונים נמחקים...';
      setTimeout(()=>{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(META_KEY);location.reload()},1500);
    }
  }
}

async function tryBiometric(){
  const meta=getMeta();
  if(!meta.biometricCredId){toast('זיהוי ביומטרי לא מוגדר','error');return}
  try{
    const challenge=crypto.getRandomValues(new Uint8Array(32));
    if(!window.isSecureContext){toast(webAuthnErrorHint(),'error');return}
    const credIdBytes=Uint8Array.from(atob(meta.biometricCredId),c=>c.charCodeAt(0));
    const assertion=await navigator.credentials.get({publicKey:{challenge:challenge,allowCredentials:[{type:'public-key',id:credIdBytes}],userVerification:'required',timeout:60000}});
    if(assertion){
      const password=atob(meta.biometricEncPwd);
      document.getElementById('lockInput').value=password;
      tryUnlock();
    }
  }catch(e){
    const hint=webAuthnErrorHint(e);
    toast(hint?'זיהוי ביומטרי נכשל: '+hint:'זיהוי ביומטרי נכשל','error');
  }
}

async function setupBiometric(){
  if(!window.PublicKeyCredential){toast('המכשיר לא תומך בזיהוי ביומטרי','error');return false}
  if(!window.isSecureContext){toast(webAuthnErrorHint(),'error');return false}
  if(!masterPassword){toast('פתח קודם את האפליקציה','error');return false}
  try{
    const challenge=crypto.getRandomValues(new Uint8Array(32));
    const userId=crypto.getRandomValues(new Uint8Array(16));
    const rp={name:'מערכת פנימית'};
    if(location.hostname)rp.id=location.hostname;
    const cred=await navigator.credentials.create({publicKey:{challenge:challenge,rp:rp,user:{id:userId,name:'family@local',displayName:'משתמש'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000}});
    const credIdBase64=btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    const meta=getMeta();
    meta.biometricEnabled=true;
    meta.biometricCredId=credIdBase64;
    meta.biometricEncPwd=btoa(masterPassword);
    setMeta(meta);
    toast('זיהוי ביומטרי הוגדר','success');
    return true;
  }catch(e){
    const hint=webAuthnErrorHint(e);
    toast(hint?'הגדרת ביומטרי נכשלה: '+hint:'הגדרת ביומטרי נכשלה','error');
    return false;
  }
}

function disableBiometric(){
  const meta=getMeta();
  delete meta.biometricEnabled;
  delete meta.biometricCredId;
  delete meta.biometricEncPwd;
  setMeta(meta);
  toast('זיהוי ביומטרי בוטל','success');
  render();
}

async function completeSetup(){
  const myName=(document.getElementById('setupMyName').value||'').trim();
  const partnerName=(document.getElementById('setupPartnerName').value||'').trim();
  const p1=document.getElementById('setupInput1').value;
  const p2=document.getElementById('setupInput2').value;
  const errorEl=document.getElementById('setupError');
  errorEl.textContent='';
  if(!myName){errorEl.textContent='הזן את השם שלך';return}
  if(!p1||p1.length<4){errorEl.textContent='סיסמה חייבת להיות לפחות 4 תווים';return}
  if(p1!==p2){errorEl.textContent='הסיסמאות לא תואמות';return}
  const hash=await Crypto.hashPassword(p1);
  setMeta({passwordHash:hash,failedAttempts:0,createdAt:Date.now()});
  masterPassword=p1;
  state=defaultState();
  state.settings.myName=myName;
  state.settings.partnerName=partnerName;
  await saveState();
  applyReopenStash(p1);
  document.getElementById('setupScreen').style.display='none';
  document.getElementById('mainApp').style.display='flex';
  render();
  if(typeof cloudSyncRefreshSessionMeta==='function'){
    cloudSyncRefreshSessionMeta().then(function(){render()}).catch(function(){});
  }
  toast('ברוך הבא!','success');
  resetInactivityTimer();
}

function lockNow(){
  if(typeof teamSyncStopRealtime==='function')try{teamSyncStopRealtime()}catch(e){}
  masterPassword=null;
  state=null;
  clearOperatorSession();
  try{sessionStorage.removeItem(SESSION_PWD_KEY)}catch(err){}
  const lm=getMeta();
  delete lm.quickUntil;
  delete lm.quickEncPwd;
  setMeta(lm);
  document.getElementById('mainApp').style.display='none';
  document.getElementById('lockScreen').style.display='flex';
  document.getElementById('lockInput').value='';
  document.getElementById('lockError').textContent='';
  document.getElementById('lockAttempts').textContent='';
  const meta=getMeta();
  document.getElementById('lockBioBtn').style.display=meta.biometricEnabled?'':'none';
  setTimeout(()=>document.getElementById('lockInput').focus(),100);
}

function handleUrlAction(){
  const params=new URLSearchParams(window.location.search);
  const action=params.get('action');
  if(isOperatorSession()&&action&&action!=='new_tx'&&action!=='new_income'){
    if(action==='new_task')toast('במצב מפעיל אין גישה למשימות','error');
    else toast('פעולה לא זמינה במצב מפעיל','error');
    if(action)history.replaceState({},'',location.pathname);
    return;
  }
  if(action==='new_tx')setTimeout(()=>openTxModal(null,{type:'expense'}),300);
  else if(action==='new_income')setTimeout(()=>openTxModal(null,{type:'income'}),300);
  else if(action==='new_task')setTimeout(()=>openTaskModal(),300);
  if(action)history.replaceState({},'',location.pathname);
}

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}

function navigate(page){
  if(isOperatorSession()&&!operatorAllowedPages().includes(page)){
    toast('במצב מפעיל אין גישה לעמוד זה','error');
    page='transactions';
  }
  currentPage=page;
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  if(window.innerWidth<=768){
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
  }
  window.scrollTo(0,0);
  render();
}

function pageTitle(p){
  return{dashboard:'לוח בקרה',transactions:'תנועות',recurring:'הוצאות והכנסות קבועות',installments:'תשלומים והלוואות',future:'תזרים עתידי',checks:'צ׳קים דחויים',accounts:'חשבונות',budgets:'תקציבים',categories:'קטגוריות',calendar:'יומן',tasks:'משימות',settings:'הגדרות'}[p]||'';
}

function render(){
  if(!state)return;
  if(isOperatorSession()&&!operatorAllowedPages().includes(currentPage))currentPage='transactions';
  document.getElementById('mobileTitle').textContent=pageTitle(currentPage);
  const main=document.getElementById('main');
  switch(currentPage){
    case'dashboard':main.innerHTML=renderDashboard();break;
    case'transactions':main.innerHTML=renderTransactions();break;
    case'recurring':main.innerHTML=renderRecurring();break;
    case'installments':main.innerHTML=renderInstallments();break;
    case'future':main.innerHTML=renderFuture();break;
    case'checks':main.innerHTML=renderChecks();break;
    case'accounts':main.innerHTML=renderAccounts();break;
    case'budgets':main.innerHTML=renderBudgets();break;
    case'categories':main.innerHTML=renderCategories();break;
    case'calendar':main.innerHTML=renderCalendar();break;
    case'tasks':main.innerHTML=renderTasks();break;
    case'settings':main.innerHTML=renderSettings();break;
  }
  if(state&&typeof refreshAllFormSelectLabels==='function')try{refreshAllFormSelectLabels()}catch(err){}
  applyOperatorNavChrome();
}

function applyOperatorNavChrome(){
  const op=isOperatorSession();
  const bar=document.getElementById('operatorModeBar');
  const labelEl=document.getElementById('operatorModeLabel');
  if(bar&&labelEl){
    if(op){
      const rec=operatorsList().find(o=>o.id===sessionOperatorId);
      labelEl.textContent=rec&&rec.label?'מצב מפעיל מוגבל: '+rec.label:'מצב מפעיל מוגבל';
      bar.style.display='flex';
    }else{
      bar.style.display='none';
    }
  }
  const allowed=operatorAllowedPages();
  document.querySelectorAll('.nav-section-title').forEach(el=>{el.style.display=op?'none':''});
  document.querySelectorAll('.nav-item').forEach(el=>{
    const p=el.dataset.page;
    el.style.display=!op||allowed.includes(p)?'':'none';
  });
  const fabItems=document.querySelectorAll('#fabMenu .fab-menu-item');
  fabItems.forEach((btn,i)=>{if(op&&i>=2)btn.style.display='none';else btn.style.display=''});
  const syncBtns=document.querySelectorAll('.sync-btn');
  if(syncBtns[0])syncBtns[0].style.display=op?'none':'';
}

async function enterOperatorMode(operatorId){
  if(!state||!masterPassword){toast('פתחו קודם את האפליקציה כמנהל','error');return}
  const ops=operatorsList();
  const op=ops.find(o=>o.id===operatorId&&o.active!==false);
  if(!op){toast('מפעיל לא נמצא','error');return}
  sessionRole='operator';
  sessionOperatorId=operatorId;
  if(typeof txFilter!=='undefined'){
    txFilter.operatorTxStatus='all';
    txFilter.type='all';
    txFilter.account='all';
    txFilter.tag='all';
    txFilter.paymentMethod='all';
    txFilter.from=null;
    txFilter.to=null;
    txFilter.search='';
  }
  navigate('transactions');
  toast('נכנסתם כמפעיל מוגבל','success');
}

async function exitOperatorMode(){
  const p=window.prompt('הזינו סיסמת מנהל (פתיחת האפליקציה) כדי לחזור למצב מלא:');
  if(p==null)return;
  const meta=getMeta();
  if(!meta.passwordHash){clearOperatorSession();navigate('dashboard');toast('חזרתם למצב מנהל','success');return}
  let ok=false;
  try{ok=await Crypto.verifyPassword(p,meta.passwordHash)}catch(e){ok=false}
  if(!ok){toast('סיסמה שגויה','error');return}
  clearOperatorSession();
  navigate('dashboard');
  toast('חזרתם למצב מנהל','success');
}

function toggleFabMenu(){document.getElementById('fabMenu').classList.toggle('open')}
function hideFabMenu(){document.getElementById('fabMenu').classList.remove('open')}

function openModal(id){document.getElementById(id).classList.add('active')}
function closeModal(id){document.getElementById(id).classList.remove('active')}
document.addEventListener('click',e=>{if(e.target.classList&&e.target.classList.contains('modal-bg'))e.target.classList.remove('active')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.modal-bg.active').forEach(m=>m.classList.remove('active'));hideFabMenu()}});

let inactivityTimer=null;
function resetInactivityTimer(){
  if(inactivityTimer)clearTimeout(inactivityTimer);
  if(!state)return;
  const minutes=state.settings.autoLockMinutes||15;
  if(minutes<=0)return;
  inactivityTimer=setTimeout(()=>{if(masterPassword)lockNow()},minutes*60*1000);
}
['click','keydown','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,resetInactivityTimer,{passive:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state){const meta=getMeta();meta.lastHidden=Date.now();setMeta(meta)}});
