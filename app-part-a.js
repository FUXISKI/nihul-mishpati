const STORAGE_KEY='familyMgr_v2';
const META_KEY='familyMgr_meta_v2';
let masterPassword=null;
let state=null;
let currentPage='dashboard';
let calendarMonth=new Date().getMonth();
let calendarYear=new Date().getFullYear();
let selectedCalDay=null;
let pendingImportData=null;
let pendingImportEncrypted=null;
let pendingReplaceEncrypted=null;
let mergeDecisions={};

function defaultState(){
  return{
    accounts:[],
    categories:[],
    transactions:[],checks:[],recurring:[],budgets:[],tasks:[],events:[],
    settings:{
      futureWindowDays:30,
      historyDaysOnDash:7,
      autoLockMinutes:15,
      myName:'',
      partnerName:'',
      uiLabels:mergeUiLabelsFromData(null),
      sheetsSyncUrl:'',
      sheetsSyncSecret:'',
      defaultWhatsAppPhone:'',
      supabaseUrl:'',
      supabaseAnonKey:'',
      supabaseAuthEmail:'',
      backupReminderDays:14,
      showInDashboard:{stats:true,recentTx:true,upcoming:true,tasks:true,events:true,alerts:true,accountCards:true,budgets:false,backupReminder:true}
    },
    deviceId:'dev_'+Math.random().toString(36).substring(2,10)
  };
}

async function saveState(){
  if(!masterPassword||!state)return;
  try{
    const json=JSON.stringify(state);
    const enc=await Crypto.encrypt(json,masterPassword);
    localStorage.setItem(STORAGE_KEY,enc);
  }catch(e){console.error(e);toast('שגיאה בשמירה','error')}
}

async function loadState(password){
  const enc=localStorage.getItem(STORAGE_KEY);
  if(!enc)return defaultState();
  const json=await Crypto.decrypt(enc,password);
  const data=JSON.parse(json);
  const def=defaultState();
  const ds=data.settings||{};
  return Object.assign(def,data,{settings:Object.assign(def.settings,ds,{
    showInDashboard:Object.assign(def.settings.showInDashboard,(ds).showInDashboard||{}),
    myName:ds.myName||'',
    partnerName:ds.partnerName||'',
    uiLabels:mergeUiLabelsFromData(ds.uiLabels),
    sheetsSyncUrl:typeof ds.sheetsSyncUrl==='string'?ds.sheetsSyncUrl:'',
    sheetsSyncSecret:typeof ds.sheetsSyncSecret==='string'?ds.sheetsSyncSecret:'',
    defaultWhatsAppPhone:typeof ds.defaultWhatsAppPhone==='string'?ds.defaultWhatsAppPhone:'',
    supabaseUrl:typeof ds.supabaseUrl==='string'?ds.supabaseUrl:(typeof ds.cloudVaultUrl==='string'&&/supabase\.co/i.test(ds.cloudVaultUrl)?ds.cloudVaultUrl:''),
    supabaseAnonKey:typeof ds.supabaseAnonKey==='string'?ds.supabaseAnonKey:'',
    supabaseAuthEmail:typeof ds.supabaseAuthEmail==='string'?ds.supabaseAuthEmail:(typeof ds.cloudVaultEmail==='string'?ds.cloudVaultEmail:'')
  })});
}

function defaultUiLabels(){
  return{
    currency:{ILS:'₪ שקל',USD:'$ דולר'},
    txType:{expense:'הוצאה',income:'הכנסה',transfer:'העברה בין חשבונות'},
    txStatus:{completed:'בוצע',pending:'צפוי / עתידי'},
    paymentMethod:{cash:'מזומן/העברה',credit:'אשראי',bit:'ביט / Pay',check:"צ'ק",other:'אחר'},
    txTag:{variable:'משתנה',fixed:'קבוע'},
    recurringType:{expense:'הוצאה קבועה',income:'הכנסה קבועה'},
    recurringFrequency:{monthly:'חודשי',bimonthly:'דו-חודשי',quarterly:'רבעוני',yearly:'שנתי',weekly:'שבועי'},
    yesNo:{1:'כן',0:'לא'},
    accountType:{checking:'עו״ש',savings:'חיסכון',cash:'מזומן',credit:'כרטיס אשראי',other:'אחר'},
    categoryType:{expense:'הוצאה',income:'הכנסה'},
    checkDirection:{incoming:"צ'ק שקיבלנו",outgoing:"צ'ק שנתנו"},
    checkStatus:{pending:'ממתין לפירעון',cleared:'נפרע',bounced:'חזר'},
    taskPriority:{low:'נמוכה',med:'בינונית',high:'גבוהה'},
    exportRange:{all:'גיבוי מלא',range:'לפי טווח תאריכים',recent:'תקופה אחרונה'},
    exportRecent:{7:'שבוע אחרון',30:'חודש אחרון',90:'3 חודשים',180:'חצי שנה',365:'שנה'}
  };
}

function mergeUiLabelsFromData(raw){
  const def=defaultUiLabels();
  const cur=raw&&typeof raw==='object'?raw:{};
  const out={};
  Object.keys(def).forEach(sec=>{
    out[sec]=Object.assign({},def[sec],cur[sec]&&typeof cur[sec]==='object'?cur[sec]:{});
  });
  return out;
}

function uiLabel(section,key){
  if(key===undefined||key===null)return'';
  const k=String(key);
  const def=defaultUiLabels()[section];
  if(!def)return k;
  const c=state&&state.settings&&state.settings.uiLabels&&state.settings.uiLabels[section];
  return (c&&Object.prototype.hasOwnProperty.call(c,k)&&c[k]!=='')?c[k]:(def[k]||k);
}

function getMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch(e){return{}}}
function setMeta(m){localStorage.setItem(META_KEY,JSON.stringify(m))}
function uid(){return'id_'+Date.now().toString(36)+'_'+Math.random().toString(36).substring(2,8)}

function fmtMoney(amount,currency){
  const sym=currency==='USD'?'$':'₪';
  const n=Math.abs(amount).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
  return(amount<0?'-':'')+sym+n;
}
function fmtDate(d){if(!d)return'';return(typeof d==='string'?new Date(d):d).toLocaleDateString('he-IL',{day:'numeric',month:'numeric',year:'numeric'})}
function fmtDateShort(d){if(!d)return'';return(typeof d==='string'?new Date(d):d).toLocaleDateString('he-IL',{day:'numeric',month:'short'})}
function todayISO(){return localISO(new Date())}
function localISO(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return`${y}-${m}-${d}`}
function hebrewHeaderParts(date){
  const d=date instanceof Date?date:new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(date))?date+'T12:00:00':date);
  const full=HebrewDate.format(d).trim();
  const parts=full.split(/\s+/).filter(Boolean);
  if(parts.length<2)return{day:'',month:'',year:''};
  if(parts.length===2)return{day:parts[0],month:'',year:parts[1]};
  return{day:parts[0],month:parts[1],year:parts.slice(2).join(' ')};
}
function hebrewMonthRangeLabel(calYear,calMonth){
  const f=new Date(calYear,calMonth,1,12,0,0);
  const l=new Date(calYear,calMonth+1,0,12,0,0);
  const a=hebrewHeaderParts(f);
  const b=hebrewHeaderParts(l);
  if(!a.month||!b.month)return HebrewDate.format(f);
  if(a.month===b.month&&a.year===b.year)return a.month+' '+a.year;
  if(a.year===b.year)return a.month+' – '+b.month+' '+a.year;
  return a.month+' '+a.year+' – '+b.month+' '+b.year;
}
function eventTimeDisplay(e){
  if(!e)return'—';
  if(e.allDay)return'כל היום';
  const s=e.time||'';
  const en=e.endTime||'';
  if(s&&en)return s+'–'+en;
  if(s)return s;
  return'—';
}
function compareEventsBySchedule(a,b){
  if(!!a.allDay!==!!b.allDay)return a.allDay?-1:1;
  return (a.time||'').localeCompare(b.time||'');
}
function linkedTopicsForEventHtml(eventId){
  if(!state||!eventId)return'';
  const rows=[];
  state.tasks.forEach(t=>{
    if(t.linkedEventId===eventId)rows.push({taskId:t.id,text:t.title||'משימה',kind:'משימה'});
    (t.subtasks||[]).forEach(s=>{
      if(s.linkedEventId===eventId)rows.push({taskId:t.id,text:(t.title?t.title+' → ':'')+(s.title||''),kind:'נקודה'});
    });
  });
  if(!rows.length)return'';
  return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft)"><div style="font-size:10px;font-weight:700;color:var(--ink-mute);margin-bottom:4px">נושאים מקושרים (משימות)</div><ul style="margin:0;padding:0 14px 0 0;font-size:12px;line-height:1.45;list-style:disc">${rows.map(r=>`<li style="margin-bottom:3px"><a href="#" onclick="event.preventDefault();event.stopPropagation();openTaskModal('${r.taskId}');return false" style="color:var(--accent);text-decoration:none">${escapeHtml(r.kind)}: ${escapeHtml(r.text)}</a></li>`).join('')}</ul></div>`;
}
function myDisplayName(){if(!state||!state.settings)return'משתמש';const n=(state.settings.myName||'').trim();return n||'משתמש'}
function partnerDisplayName(){if(!state||!state.settings)return'בן/בת הזוג';const n=(state.settings.partnerName||'').trim();return n||'בן/בת הזוג'}
function ownerLabel(o){if(o==='me')return myDisplayName();if(o==='spouse')return partnerDisplayName();if(o==='both')return'שנינו';return''}
function ownerBadge(o){if(o==='me')return`<span class="badge-user badge-me">${escapeHtml(myDisplayName())}</span>`;if(o==='spouse')return`<span class="badge-user badge-spouse">${escapeHtml(partnerDisplayName())}</span>`;if(o==='both')return'<span class="badge-user badge-both">שנינו</span>';return''}
function escapeHtml(str){if(str==null)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function toast(msg,type){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show '+(type||'');setTimeout(()=>el.className='toast',2500)}

function calcLoanPayment(principal,annualRate,months){
  if(!annualRate||annualRate<=0)return principal/months;
  const r=annualRate/100/12;
  return principal*(r*Math.pow(1+r,months))/(Math.pow(1+r,months)-1);
}
function generateInstallmentDates(firstDate,count){
  const dates=[];const first=new Date(firstDate);const day=first.getDate();
  for(let i=0;i<count;i++){
    const d=new Date(first.getFullYear(),first.getMonth()+i,1);
    const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(day,lastDay));
    dates.push(localISO(d));
  }
  return dates;
}

function amortInstallmentAmounts(principal,annualRate,n){
  if(!principal||n<1)return[];
  if(!annualRate||annualRate<=0){
    const each=Math.round((principal/n)*100)/100;
    const out=[];let s=0;
    for(let i=0;i<n-1;i++){out.push(each);s+=each}
    out.push(Math.round((principal-s)*100)/100);
    return out;
  }
  const pay=calcLoanPayment(principal,annualRate,n);
  const r=annualRate/100/12;
  let bal=principal;
  const out=[];
  for(let i=0;i<n;i++){
    const isLast=i===n-1;
    const interest=Math.round(bal*r*100)/100;
    let princ=isLast?bal:Math.round((pay-interest)*100)/100;
    if(princ>bal)princ=bal;
    const pmt=Math.round((princ+interest)*100)/100;
    out.push(pmt);
    bal=Math.round((bal-princ)*100)/100;
  }
  return out;
}

function generateRecurringOccurrences(rec,fromDate,toDate){
  const isActive=rec.active===1||rec.active==='1'||rec.active===true;
  if(!isActive)return[];
  const occurrences=[];
  const start=new Date(rec.startDate||fromDate);
  const recEnd=rec.endDate?new Date(rec.endDate):null;
  const wEnd=new Date(toDate);
  const windowEnd=recEnd&&recEnd<wEnd?recEnd:wEnd;
  const windowStart=new Date(fromDate);
  if(rec.frequency==='weekly'){
    let cur=new Date(start);
    while(cur<=windowEnd){
      if(cur>=windowStart)occurrences.push(localISO(cur));
      cur.setDate(cur.getDate()+7);
    }
  }else{
    const monthStep={monthly:1,bimonthly:2,quarterly:3,yearly:12}[rec.frequency]||1;
    const dayOfMonth=parseInt(rec.dayOfMonth)||start.getDate();
    let year=start.getFullYear(),month=start.getMonth();
    for(let i=0;i<500;i++){
      const lastDay=new Date(year,month+1,0).getDate();
      const day=Math.min(dayOfMonth,lastDay);
      const occ=new Date(year,month,day);
      if(occ>windowEnd)break;
      if(occ>=windowStart&&occ>=start)occurrences.push(localISO(occ));
      month+=monthStep;
      while(month>11){month-=12;year++}
    }
  }
  return occurrences;
}

function getAccountBalance(accountId,includeMode){
  const acct=state.accounts.find(a=>a.id===accountId);
  if(!acct)return 0;
  let balance=parseFloat(acct.openingBalance)||0;
  state.transactions.forEach(tx=>{
    if(tx.status==='cancelled')return;
    if(includeMode!=='projected'&&tx.status!=='completed')return;
    if(tx.type==='income'&&tx.accountId===accountId)balance+=parseFloat(tx.amount);
    if(tx.type==='expense'&&tx.accountId===accountId)balance-=parseFloat(tx.amount);
    if(tx.type==='transfer'){
      if(tx.accountId===accountId)balance-=parseFloat(tx.amount);
      if(tx.toAccountId===accountId)balance+=parseFloat(tx.amount);
    }
  });
  state.checks.forEach(c=>{
    if(c.accountId!==accountId)return;
    if(c.status==='cleared'){
      if(c.direction==='incoming')balance+=parseFloat(c.amount);
      else balance-=parseFloat(c.amount);
    }else if(c.status==='pending'&&includeMode==='projected'){
      if(c.direction==='incoming')balance+=parseFloat(c.amount);
      else balance-=parseFloat(c.amount);
    }
  });
  if(includeMode==='projected'){
    const today=new Date();today.setHours(0,0,0,0);
    const future=new Date(today);
    future.setDate(future.getDate()+(state.settings.futureWindowDays||30));
    state.recurring.forEach(rec=>{
      if(rec.accountId!==accountId)return;
      const occs=generateRecurringOccurrences(rec,localISO(today),localISO(future));
      const sign=rec.type==='income'?1:-1;
      occs.forEach(()=>{balance+=sign*parseFloat(rec.amount)});
    });
  }
  return balance;
}

function getAccountBalanceAsOf(accountId,asOfDate){
  const acct=state.accounts.find(a=>a.id===accountId);
  if(!acct)return 0;
  let balance=parseFloat(acct.openingBalance)||0;
  const cutoff=asOfDate;
  state.transactions.forEach(tx=>{
    if(tx.status==='cancelled'||tx.status==='pending')return;
    if(tx.date>cutoff)return;
    if(tx.type==='income'&&tx.accountId===accountId)balance+=parseFloat(tx.amount);
    if(tx.type==='expense'&&tx.accountId===accountId)balance-=parseFloat(tx.amount);
    if(tx.type==='transfer'){
      if(tx.accountId===accountId)balance-=parseFloat(tx.amount);
      if(tx.toAccountId===accountId)balance+=parseFloat(tx.amount);
    }
  });
  state.checks.forEach(c=>{
    if(c.accountId!==accountId||c.status!=='cleared')return;
    if(c.dueDate>cutoff)return;
    if(c.direction==='incoming')balance+=parseFloat(c.amount);
    else balance-=parseFloat(c.amount);
  });
  return balance;
}

function getTotalByCurrency(currency,mode){
  let total=0;
  state.accounts.forEach(a=>{if(a.currency===currency)total+=getAccountBalance(a.id,mode)});
  return total;
}

function generateCashflowAlerts(){
  const alerts=[];
  const today=todayISO();
  state.accounts.forEach(a=>{
    const current=getAccountBalance(a.id);
    const projected=getAccountBalance(a.id,'projected');
    const min=parseFloat(a.minBalance||0);
    let inflow=0,outflow=0;
    const todayD=new Date();todayD.setHours(0,0,0,0);
    const future=new Date(todayD);
    future.setDate(future.getDate()+(state.settings.futureWindowDays||30));
    state.transactions.forEach(tx=>{
      if(tx.status!=='pending')return;
      const d=new Date(tx.date);
      if(d<todayD||d>future)return;
      if(tx.type==='income'&&tx.accountId===a.id)inflow+=+tx.amount;
      if(tx.type==='expense'&&tx.accountId===a.id)outflow+=+tx.amount;
      if(tx.type==='transfer'){
        if(tx.accountId===a.id)outflow+=+tx.amount;
        if(tx.toAccountId===a.id)inflow+=+tx.amount;
      }
    });
    state.checks.forEach(c=>{
      if(c.status!=='pending'||c.accountId!==a.id)return;
      const d=new Date(c.dueDate);
      if(d<todayD||d>future)return;
      if(c.direction==='incoming')inflow+=+c.amount;
      else outflow+=+c.amount;
    });
    state.recurring.forEach(rec=>{
      if(rec.accountId!==a.id)return;
      const isActive=rec.active===1||rec.active==='1'||rec.active===true;
      if(!isActive)return;
      const occs=generateRecurringOccurrences(rec,localISO(todayD),localISO(future));
      occs.forEach(()=>{if(rec.type==='income')inflow+=+rec.amount;else outflow+=+rec.amount});
    });
    if(projected<min&&min>0){
      const needed=min-projected;
      alerts.push({type:'danger',title:`יתרה צפויה נמוכה: ${a.name}`,message:`יתרה נוכחית ${fmtMoney(current,a.currency)}. צפויות הוצאות ${fmtMoney(outflow,a.currency)} מול הכנסות ${fmtMoney(inflow,a.currency)}. יתרה צפויה: ${fmtMoney(projected,a.currency)}. <strong>חסרים ${fmtMoney(needed,a.currency)}</strong> כדי לכסות.`});
    }else if(projected<0){
      alerts.push({type:'danger',title:`חריגה צפויה: ${a.name}`,message:`הוצאות עתידיות ${fmtMoney(outflow,a.currency)} מול הכנסות ${fmtMoney(inflow,a.currency)}. חריגה צפויה: ${fmtMoney(Math.abs(projected),a.currency)}.`});
    }else if(current<min&&min>0&&projected>=min){
      alerts.push({type:'info',title:`${a.name} - מתחת ליתרה הרצויה`,message:`יתרה נוכחית ${fmtMoney(current,a.currency)} (רצוי: ${fmtMoney(min,a.currency)}). ההכנסות הצפויות יחזירו לתקין.`});
    }
  });
  const overdueTasks=state.tasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<today);
  if(overdueTasks.length>0)alerts.push({type:'warn',title:`${overdueTasks.length} משימות באיחור`,message:'יש משימות שתאריך היעד שלהן עבר. <a href="#" onclick="navigate(\'tasks\');return false">למשימות ←</a>'});
  const overdueTx=state.transactions.filter(t=>t.status==='pending'&&t.date<today);
  if(overdueTx.length>0)alerts.push({type:'warn',title:`${overdueTx.length} תנועות עתידיות עברו את התאריך`,message:'בדוק האם בוצעו. <a href="#" onclick="navigate(\'future\');return false">לתזרים ←</a>'});
  const overdueChecks=state.checks.filter(c=>c.status==='pending'&&c.dueDate<today);
  if(overdueChecks.length>0)alerts.push({type:'warn',title:`${overdueChecks.length} צ'קים שתאריך פירעונם עבר`,message:'בדוק האם נפרעו. <a href="#" onclick="navigate(\'checks\');return false">לצ\'קים ←</a>'});
  const today2=new Date();const m=today2.getMonth(),y=today2.getFullYear();
  state.budgets.forEach(b=>{
    let spent=0;
    state.transactions.forEach(tx=>{
      if(tx.status!=='completed'||tx.type!=='expense'||tx.categoryId!==b.categoryId||tx.currency!==b.currency)return;
      const d=new Date(tx.date);
      if(d.getMonth()===m&&d.getFullYear()===y)spent+=+tx.amount;
    });
    const cat=state.categories.find(c=>c.id===b.categoryId);
    if(!cat)return;
    if(spent>b.amount)alerts.push({type:'warn',title:`חריגה בתקציב: ${cat.name}`,message:`הוצאת ${fmtMoney(spent,b.currency)} מתוך תקציב ${fmtMoney(b.amount,b.currency)}. חריגה ${fmtMoney(spent-b.amount,b.currency)}.`});
    else if(spent>b.amount*0.85)alerts.push({type:'info',title:`מתקרב לתקציב: ${cat.name}`,message:`${fmtMoney(spent,b.currency)} / ${fmtMoney(b.amount,b.currency)} (${Math.round(spent/b.amount*100)}%).`});
  });
  return alerts;
}
