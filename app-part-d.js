function renderFuture(){
  const today=todayISO();
  const days=state.settings.futureWindowDays||30;
  const todayD=new Date();todayD.setHours(0,0,0,0);
  const futureD=new Date(todayD);futureD.setDate(futureD.getDate()+days);
  const future=[...state.transactions].filter(t=>t.status==='pending').sort((a,b)=>new Date(a.date)-new Date(b.date));
  const upcomingChecks=[...state.checks].filter(c=>c.status==='pending').sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const recurringOccs=[];
  state.recurring.forEach(rec=>{
    const isActive=rec.active===1||rec.active==='1'||rec.active===true;
    if(!isActive)return;
    const occs=generateRecurringOccurrences(rec,localISO(todayD),localISO(futureD));
    occs.forEach(date=>{recurringOccs.push({recurring:true,recurringId:rec.id,date,type:rec.type,amount:rec.amount,currency:rec.currency,accountId:rec.accountId,name:rec.name})});
  });
  recurringOccs.sort((a,b)=>a.date.localeCompare(b.date));
  let projIls=getTotalByCurrency('ILS'),projUsd=getTotalByCurrency('USD');
  future.forEach(t=>{if(new Date(t.date)>futureD)return;const a=+t.amount,s=t.type==='income'?1:t.type==='expense'?-1:0;if(t.currency==='ILS')projIls+=s*a;else if(t.currency==='USD')projUsd+=s*a});
  upcomingChecks.forEach(c=>{if(new Date(c.dueDate)>futureD)return;const a=+c.amount,s=c.direction==='incoming'?1:-1;if(c.currency==='ILS')projIls+=s*a;else if(c.currency==='USD')projUsd+=s*a});
  recurringOccs.forEach(o=>{const s=o.type==='income'?1:-1;if(o.currency==='ILS')projIls+=s*o.amount;else if(o.currency==='USD')projUsd+=s*o.amount});
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">תזרים עתידי</h1>
        <div class="page-sub">${days} ימים קדימה · ${future.length+upcomingChecks.length+recurringOccs.length} פריטים</div>
      </div>
      <button class="btn btn-primary" onclick="openTxModal(null,{status:'pending'})">+ תנועה עתידית</button>
    </div>
    <div class="two-col" style="margin-bottom:16px">
      <div class="stat" style="cursor:default"><div class="stat-label">יתרה צפויה ₪</div><div class="stat-value ${projIls>=0?'pos':'neg'}">${fmtMoney(projIls,'ILS')}</div></div>
      <div class="stat" style="cursor:default"><div class="stat-label">יתרה צפויה $</div><div class="stat-value ${projUsd>=0?'pos':'neg'}">${fmtMoney(projUsd,'USD')}</div></div>
    </div>
    <div class="card">
      <div class="card-title">לוח זמנים צפוי</div>
      ${future.length===0&&upcomingChecks.length===0&&recurringOccs.length===0?'<div class="empty"><div class="empty-icon">◷</div><div class="empty-title">אין תנועות עתידיות בטווח</div></div>':`<div class="table-wrap"><table>
        <thead><tr><th>תאריך</th><th>תיאור</th><th>סוג</th><th>חשבון</th><th>סכום</th><th></th></tr></thead><tbody>
        ${[...future.map(t=>({sortDate:t.date,kind:'tx',data:t})),...upcomingChecks.map(c=>({sortDate:c.dueDate,kind:'check',data:c})),...recurringOccs.map(o=>({sortDate:o.date,kind:'rec',data:o}))].sort((a,b)=>a.sortDate.localeCompare(b.sortDate)).map(item=>{
          if(item.kind==='tx'){const tx=item.data;const acct=state.accounts.find(a=>a.id===tx.accountId);const sign=tx.type==='income'?'+':'-';const cls=tx.type==='income'?'pos':'neg';const isPast=tx.date<today;const isInst=tx.installmentParentId?`<span class="recurring-badge">${tx.installmentNum}/${tx.installmentTotal}</span> `:'';
            return `<tr style="cursor:pointer" onclick="openTxModal('${tx.id}')"><td><div style="font-weight:500;${isPast?'color:var(--red)':''}">${fmtDate(tx.date)}</div>${isPast?'<div style="font-size:10px;color:var(--red)">באיחור</div>':''}</td><td>${isInst}${escapeHtml(tx.description||'')}</td><td><span class="pill ${tx.type==='income'?'pill-green':'pill-red'}">${tx.type==='income'?'הכנסה':'הוצאה'}</span></td><td>${acct?escapeHtml(acct.name):''}</td><td class="amount ${cls}">${sign}${fmtMoney(tx.amount,tx.currency).replace('-','')}</td><td><button class="btn btn-success btn-sm" onclick="event.stopPropagation();confirmTx('${tx.id}')">בוצע</button></td></tr>`;
          }else if(item.kind==='check'){const c=item.data;const acct=state.accounts.find(a=>a.id===c.accountId);const sign=c.direction==='incoming'?'+':'-';const cls=c.direction==='incoming'?'pos':'neg';const isPast=c.dueDate<today;
            return `<tr style="cursor:pointer" onclick="openCheckModal('${c.id}')"><td><div style="font-weight:500;${isPast?'color:var(--red)':''}">${fmtDate(c.dueDate)}</div>${isPast?'<div style="font-size:10px;color:var(--red)">באיחור</div>':''}</td><td>צ׳ק: ${escapeHtml(c.party||'')}</td><td><span class="pill pill-gold">צ׳ק ${c.direction==='incoming'?'נכנס':'יוצא'}</span></td><td>${acct?escapeHtml(acct.name):''}</td><td class="amount ${cls}">${sign}${fmtMoney(c.amount,c.currency).replace('-','')}</td><td><button class="btn btn-success btn-sm" onclick="event.stopPropagation();clearCheck('${c.id}')">נפרע</button></td></tr>`;
          }else{const o=item.data;const acct=state.accounts.find(a=>a.id===o.accountId);const sign=o.type==='income'?'+':'-';const cls=o.type==='income'?'pos':'neg';
            return `<tr style="cursor:pointer" onclick="openRecurringModal('${o.recurringId}')"><td><div style="font-weight:500">${fmtDate(o.date)}</div></td><td><span class="recurring-badge">קבוע</span> ${escapeHtml(o.name)}</td><td><span class="pill pill-purple">${o.type==='income'?'קבוע נכנס':'קבוע יוצא'}</span></td><td>${acct?escapeHtml(acct.name):''}</td><td class="amount ${cls}">${sign}${fmtMoney(o.amount,o.currency).replace('-','')}</td><td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();materializeRecurring('${o.recurringId}','${o.date}')">בצע</button></td></tr>`;
          }
        }).join('')}</tbody></table></div>`}
    </div>`;
}

async function materializeRecurring(recurringId,date){
  const rec=state.recurring.find(r=>r.id===recurringId);
  if(!rec)return;
  const tx={id:uid(),type:rec.type,date,amount:rec.amount,currency:rec.currency,accountId:rec.accountId,categoryId:rec.categoryId,description:rec.name,paymentMethod:'cash',owner:'me',status:'completed',tag:'fixed',notes:rec.notes||'',fromRecurringId:recurringId,createdAt:Date.now(),updatedAt:Date.now()};
  state.transactions.push(tx);
  await saveState();
  toast('בוצע','success');
  render();
}

let checkFilter='pending';

function renderChecks(){
  let checks=[...state.checks];
  if(checkFilter!=='all')checks=checks.filter(c=>c.status===checkFilter);
  checks.sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const totIls=state.checks.filter(c=>c.status==='pending'&&c.currency==='ILS').reduce((s,c)=>s+(c.direction==='incoming'?+c.amount:-c.amount),0);
  const totUsd=state.checks.filter(c=>c.status==='pending'&&c.currency==='USD').reduce((s,c)=>s+(c.direction==='incoming'?+c.amount:-c.amount),0);
  return `
    <div class="page-header">
      <div><h1 class="page-title">צ׳קים דחויים</h1><div class="page-sub">${checks.length} צ׳קים</div></div>
      <button class="btn btn-primary" onclick="openCheckModal()">+ צ׳ק חדש</button>
    </div>
    <div class="two-col" style="margin-bottom:14px">
      <div class="stat" style="cursor:default"><div class="stat-label">פתוחים ₪</div><div class="stat-value ${totIls>=0?'pos':'neg'}">${fmtMoney(totIls,'ILS')}</div></div>
      <div class="stat" style="cursor:default"><div class="stat-label">פתוחים $</div><div class="stat-value ${totUsd>=0?'pos':'neg'}">${fmtMoney(totUsd,'USD')}</div></div>
    </div>
    <div class="card">
      <div class="filters">
        <button class="filter-pill ${checkFilter==='all'?'active':''}" onclick="checkFilter='all';render()">הכל</button>
        <button class="filter-pill ${checkFilter==='pending'?'active':''}" onclick="checkFilter='pending';render()">ממתינים</button>
        <button class="filter-pill ${checkFilter==='cleared'?'active':''}" onclick="checkFilter='cleared';render()">נפרעו</button>
        <button class="filter-pill ${checkFilter==='bounced'?'active':''}" onclick="checkFilter='bounced';render()">חזרו</button>
      </div>
      ${checks.length===0?'<div class="empty"><div class="empty-icon">✎</div><div class="empty-title">אין צ׳קים</div></div>':`<div class="table-wrap"><table>
        <thead><tr><th>פירעון</th><th>שם</th><th>מספר</th><th>חשבון</th><th>סכום</th><th>סטטוס</th><th></th></tr></thead><tbody>
        ${checks.map(c=>{const acct=state.accounts.find(a=>a.id===c.accountId);const sign=c.direction==='incoming'?'+':'-';const cls=c.direction==='incoming'?'pos':'neg';const stCls=c.status==='pending'?'pill-gold':c.status==='cleared'?'pill-green':'pill-red';const stTxt=c.status==='pending'?'ממתין':c.status==='cleared'?'נפרע':'חזר';
          return `<tr style="cursor:pointer" onclick="openCheckModal('${c.id}')"><td><div style="font-weight:500">${fmtDate(c.dueDate)}</div></td><td>${escapeHtml(c.party||'')}</td><td>${escapeHtml(c.checkNumber||'—')}</td><td>${acct?escapeHtml(acct.name):''}</td><td class="amount ${cls}">${sign}${fmtMoney(c.amount,c.currency).replace('-','')}</td><td><span class="pill ${stCls}">${stTxt}</span></td><td>${c.status==='pending'?`<button class="btn btn-success btn-sm" onclick="event.stopPropagation();clearCheck('${c.id}')">נפרע</button>`:''}</td></tr>`;
        }).join('')}</tbody></table></div>`}
    </div>`;
}

function renderAccounts(){
  return `
    <div class="page-header">
      <div><h1 class="page-title">חשבונות</h1><div class="page-sub">${state.accounts.length} חשבונות</div></div>
      <button class="btn btn-primary" onclick="openAccountModal()">+ חשבון חדש</button>
    </div>
    ${state.accounts.length===0?'<div class="card"><div class="empty"><div class="empty-icon">▣</div><div class="empty-title">אין חשבונות</div><button class="btn btn-primary btn-sm" onclick="openAccountModal()" style="margin-top:9px">+ חשבון ראשון</button></div></div>':`<div class="dash-grid">
      ${state.accounts.map(a=>{
        const bal=getAccountBalance(a.id);
        const proj=getAccountBalance(a.id,'projected');
        const min=parseFloat(a.minBalance||0);
        const lowProj=proj<min&&min>0;
        const lowBal=bal<min&&min>0;
        const typeLabel={checking:'עו״ש',savings:'חיסכון',cash:'מזומן',credit:'אשראי',other:'אחר'}[a.type];
        return `<div class="acct-card" onclick="openAccountModal('${a.id}')">
          <div class="acct-name">${escapeHtml(a.name)}</div>
          <div class="acct-type">${typeLabel} · ${a.currency==='USD'?'דולר':'שקל'}</div>
          <div class="acct-bal" style="${bal<0?'color:var(--red)':lowBal?'color:var(--gold)':''}">${fmtMoney(bal,a.currency)}</div>
          ${proj!==bal?`<div class="acct-bal-future" style="${lowProj?'color:var(--red);font-weight:600':''}">צפוי: ${fmtMoney(proj,a.currency)}</div>`:''}
          ${min>0?`<div style="font-size:10px;color:var(--ink-mute);margin-top:3px">מינ' רצוי: ${fmtMoney(min,a.currency)}</div>`:''}
          ${lowProj?`<div class="acct-warn">⚠ חוסר ${fmtMoney(min-proj,a.currency)}</div>`:''}
        </div>`;
      }).join('')}
    </div>`}`;
}

function renderBudgets(){
  const today=new Date();const m=today.getMonth(),y=today.getFullYear();
  return `
    <div class="page-header">
      <div><h1 class="page-title">תקציבים</h1><div class="page-sub">תקציב חודשי לפי קטגוריה</div></div>
      <button class="btn btn-primary" onclick="openBudgetModal()">+ תקציב</button>
    </div>
    ${state.budgets.length===0?`<div class="card"><div class="empty"><div class="empty-icon">◉</div><div class="empty-title">אין תקציבים</div><div class="empty-desc" style="margin-bottom:9px">קבע תקציב חודשי לכל קטגוריה ותקבל מעקב והתראות</div><button class="btn btn-primary btn-sm" onclick="openBudgetModal()">+ תקציב ראשון</button></div></div>`:state.budgets.map(b=>{
      const cat=state.categories.find(c=>c.id===b.categoryId);
      if(!cat)return'';
      let spent=0;
      state.transactions.forEach(tx=>{if(tx.status!=='completed'||tx.type!=='expense'||tx.categoryId!==b.categoryId||tx.currency!==b.currency)return;const d=new Date(tx.date);if(d.getMonth()===m&&d.getFullYear()===y)spent+=+tx.amount});
      const pct=b.amount>0?(spent/b.amount*100):0;
      const remaining=b.amount-spent;
      const cls=pct>100?'over':pct>85?'warn':'';
      return `<div class="card" style="cursor:pointer" onclick="openBudgetModal('${b.id}')">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap;margin-bottom:8px">
          <div style="flex:1;min-width:140px"><div style="font-weight:600">${escapeHtml(cat.name)}</div><div style="font-size:12px;color:var(--ink-soft)">תקציב ${fmtMoney(b.amount,b.currency)} · ${pct.toFixed(0)}%</div></div>
          <div style="text-align:left"><div class="amount ${pct>100?'neg':'pos'}" style="font-size:14px">${fmtMoney(spent,b.currency)}</div><div style="font-size:11px;color:${remaining>=0?'var(--green)':'var(--red)'};font-weight:600">${remaining>=0?`נותרו ${fmtMoney(remaining,b.currency)}`:`חריגה ${fmtMoney(Math.abs(remaining),b.currency)}`}</div></div>
        </div>
        <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${Math.min(pct,100)}%"></div></div>
      </div>`;
    }).join('')}`;
}

function renderCategories(){
  const expense=state.categories.filter(c=>c.type==='expense');
  const income=state.categories.filter(c=>c.type==='income');
  const today=new Date();const m=today.getMonth(),y=today.getFullYear();
  const cs={};
  state.transactions.forEach(tx=>{const d=new Date(tx.date);if(d.getMonth()===m&&d.getFullYear()===y&&tx.status==='completed'&&tx.type==='expense'&&tx.currency==='ILS')cs[tx.categoryId]=(cs[tx.categoryId]||0)+ +tx.amount});
  return `
    <div class="page-header">
      <div><h1 class="page-title">קטגוריות</h1><div class="page-sub">ניהול קטגוריות הכנסה והוצאה</div></div>
      <button class="btn btn-primary" onclick="openCategoryModal()">+ קטגוריה</button>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">הוצאות (${expense.length})</div>
        ${expense.length===0?'<div class="empty"><div class="empty-title">אין קטגוריות</div></div>':expense.map(c=>{const sp=cs[c.id]||0;return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft);cursor:pointer" onclick="openCategoryModal('${c.id}')"><div style="font-weight:500">${escapeHtml(c.name)}</div><div style="display:flex;gap:7px;align-items:center">${sp>0?`<span style="font-size:12px;color:var(--ink-soft)">${fmtMoney(sp,'ILS')}</span>`:''}<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openCategoryModal('${c.id}')">ערוך</button></div></div>`}).join('')}
      </div>
      <div class="card">
        <div class="card-title">הכנסות (${income.length})</div>
        ${income.length===0?'<div class="empty"><div class="empty-title">אין קטגוריות</div></div>':income.map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft);cursor:pointer" onclick="openCategoryModal('${c.id}')"><div style="font-weight:500">${escapeHtml(c.name)}</div><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openCategoryModal('${c.id}')">ערוך</button></div>`).join('')}
      </div>
    </div>`;
}

let taskFilter={status:'open',priority:'all'};
let editingSubtasks=[];

function renderTasks(){
  let tasks=[...state.tasks];
  if(taskFilter.status==='open')tasks=tasks.filter(t=>!t.done);
  if(taskFilter.status==='done')tasks=tasks.filter(t=>t.done);
  if(taskFilter.priority!=='all')tasks=tasks.filter(t=>t.priority===taskFilter.priority);
  const today=todayISO();
  const prOrder={high:0,med:1,low:2};
  tasks.sort((a,b)=>{const aOver=!a.done&&a.dueDate&&a.dueDate<today?0:1;const bOver=!b.done&&b.dueDate&&b.dueDate<today?0:1;if(aOver!==bOver)return aOver-bOver;if(a.dueDate&&b.dueDate)return a.dueDate.localeCompare(b.dueDate);if(a.dueDate)return -1;if(b.dueDate)return 1;return prOrder[a.priority]-prOrder[b.priority]});
  const overdue=tasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<today);
  const todayList=tasks.filter(t=>!t.done&&t.dueDate===today);
  const upcoming=tasks.filter(t=>!t.done&&(!t.dueDate||t.dueDate>today));
  const done=tasks.filter(t=>t.done);
  return `
    <div class="page-header">
      <div><h1 class="page-title">משימות</h1><div class="page-sub">${state.tasks.filter(t=>!t.done).length} פתוחות · ${state.tasks.filter(t=>t.done).length} הושלמו</div></div>
      <button class="btn btn-primary" onclick="openTaskModal()">+ משימה חדשה</button>
    </div>
    <div class="card">
      <div class="filters">
        <button class="filter-pill ${taskFilter.status==='open'?'active':''}" onclick="taskFilter.status='open';render()">פתוחות</button>
        <button class="filter-pill ${taskFilter.status==='done'?'active':''}" onclick="taskFilter.status='done';render()">הושלמו</button>
        <button class="filter-pill ${taskFilter.status==='all'?'active':''}" onclick="taskFilter.status='all';render()">הכל</button>
        <span style="color:var(--line);margin:0 4px">|</span>
        <button class="filter-pill ${taskFilter.priority==='all'?'active':''}" onclick="taskFilter.priority='all';render()">הכל</button>
        <button class="filter-pill ${taskFilter.priority==='high'?'active':''}" onclick="taskFilter.priority='high';render()">דחוף</button>
        <button class="filter-pill ${taskFilter.priority==='med'?'active':''}" onclick="taskFilter.priority='med';render()">בינוני</button>
        <button class="filter-pill ${taskFilter.priority==='low'?'active':''}" onclick="taskFilter.priority='low';render()">נמוך</button>
      </div>
      ${tasks.length===0?'<div class="empty"><div class="empty-icon">✓</div><div class="empty-title">אין משימות תואמות</div></div>':`
        ${overdue.length>0&&taskFilter.status==='open'?`<div style="margin-bottom:13px"><div style="font-size:11px;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:6px">באיחור (${overdue.length})</div>${overdue.map(renderFullTaskItem).join('')}</div>`:''}
        ${todayList.length>0&&taskFilter.status==='open'?`<div style="margin-bottom:13px"><div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:6px">להיום (${todayList.length})</div>${todayList.map(renderFullTaskItem).join('')}</div>`:''}
        ${upcoming.length>0&&taskFilter.status==='open'?`<div style="margin-bottom:13px"><div style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:6px">עתידיות (${upcoming.length})</div>${upcoming.map(renderFullTaskItem).join('')}</div>`:''}
        ${(taskFilter.status==='done'||taskFilter.status==='all')&&done.length>0?`<div><div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:6px">הושלמו (${done.length})</div>${done.map(renderFullTaskItem).join('')}</div>`:''}
      `}
    </div>`;
}

function renderFullTaskItem(t){
  const isOverdue=t.dueDate&&t.dueDate<todayISO()&&!t.done;
  const prCls='priority-'+(t.priority||'med');
  const pr=String(t.priority||'med');
  const prText=uiLabel('taskPriority',pr);
  const prColor={high:'pill-red',med:'pill-gold',low:'pill-green'}[pr]||'pill-gold';
  const sub=t.subtasks&&t.subtasks.length?`<div class="subtask-list">${t.subtasks.map((s,i)=>`<div class="subtask ${s.done?'done':''}"><div class="subtask-check ${s.done?'done':''}" onclick="event.stopPropagation();toggleSubtask('${t.id}',${i})">${s.done?'✓':''}</div><span>${escapeHtml(s.title)}</span></div>`).join('')}</div>`:'';
  return `<div class="task-item ${t.done?'done':''} ${prCls}" onclick="if(!event.target.closest('.task-check')&&!event.target.closest('.subtask'))openTaskModal('${t.id}')" style="cursor:pointer">
    <div class="task-check ${t.done?'done':''}" onclick="event.stopPropagation();toggleTask('${t.id}')">${t.done?'✓':''}</div>
    <div class="task-content">
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-meta">
        <span class="pill ${prColor}">${escapeHtml(prText)}</span>
        ${t.dueDate?`<span style="${isOverdue?'color:var(--red);font-weight:600':''}">⏱ ${fmtDate(t.dueDate)}${t.reminderTime?' '+t.reminderTime:''}</span>`:''}
        ${t.subtasks&&t.subtasks.length?`<span>${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}</span>`:''}
      </div>
      ${sub}
    </div>
  </div>`;
}

function prevMonth(){
  calendarMonth--;
  if(calendarMonth<0){calendarMonth=11;calendarYear--}
  render();
}
function nextMonth(){
  calendarMonth++;
  if(calendarMonth>11){calendarMonth=0;calendarYear++}
  render();
}
function goToToday(){
  const n=new Date();
  calendarMonth=n.getMonth();
  calendarYear=n.getFullYear();
  selectedCalDay=todayISO();
  render();
}
function selectCalDay(iso){
  selectedCalDay=iso;
  render();
}

function renderCalendar(){
  const monthNames=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const dayNames=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const firstDay=new Date(calendarYear,calendarMonth,1);
  const lastDay=new Date(calendarYear,calendarMonth+1,0);
  const firstWeekday=firstDay.getDay();
  const daysInMonth=lastDay.getDate();
  const hebMonthLine=hebrewMonthRangeLabel(calendarYear,calendarMonth);
  const todayStr=todayISO();
  const cells=[];
  for(let i=0;i<firstWeekday;i++)cells.push('<div class="cal-day empty"></div>');
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(calendarYear,calendarMonth,d);
    const iso=localISO(date);
    const isToday=iso===todayStr;
    const isSelected=iso===selectedCalDay;
    const hebDayStr=HebrewDate.format(date,{dayOnly:true});
    const events=state.events.filter(e=>e.date===iso);
    const tasks=state.tasks.filter(t=>t.dueDate===iso&&!t.done);
    const txs=state.transactions.filter(t=>t.date===iso);
    const checks=state.checks.filter(c=>c.dueDate===iso);
    let hasRecurring=false;
    state.recurring.forEach(rec=>{const isActive=rec.active===1||rec.active==='1'||rec.active===true;if(!isActive)return;const occs=generateRecurringOccurrences(rec,iso,iso);if(occs.length)hasRecurring=true});
    let dots='';
    if(events.length)dots+='<div class="cal-dot"></div>';
    if(tasks.length)dots+='<div class="cal-dot task"></div>';
    if(txs.length||checks.length)dots+='<div class="cal-dot tx"></div>';
    if(hasRecurring)dots+='<div class="cal-dot recurring"></div>';
    const tip=escapeHtml(fmtDate(date)+' · '+HebrewDate.format(date));
    cells.push(`<div class="cal-day ${isToday?'today':''} ${isSelected?'selected':''}" title="${tip}" onclick="selectCalDay('${iso}')"><div style="display:flex;justify-content:space-between;width:100%;align-items:center"><div class="cal-day-num">${d}</div><div class="cal-day-heb">${hebDayStr}</div></div><div class="cal-day-dots">${dots}</div></div>`);
  }
  let selectedPanel='';
  if(selectedCalDay){
    const date=new Date(selectedCalDay);
    const events=[...state.events.filter(e=>e.date===selectedCalDay)].sort(compareEventsBySchedule);
    const tasks=state.tasks.filter(t=>t.dueDate===selectedCalDay);
    const txs=state.transactions.filter(t=>t.date===selectedCalDay);
    const checks=state.checks.filter(c=>c.dueDate===selectedCalDay);
    const recOccs=[];
    state.recurring.forEach(rec=>{const isActive=rec.active===1||rec.active==='1'||rec.active===true;if(!isActive)return;const occs=generateRecurringOccurrences(rec,selectedCalDay,selectedCalDay);if(occs.length)recOccs.push(rec)});
    const balances=state.accounts.map(a=>({account:a,balance:getAccountBalanceAsOf(a.id,selectedCalDay)}));
    selectedPanel=`<div class="card" style="margin-top:12px">
      <div class="card-title">${fmtDate(date)} · ${HebrewDate.format(date)}<div><button class="btn btn-secondary btn-sm" onclick="document.getElementById('eventDate').value='${selectedCalDay}';openEventModal()">+ אירוע</button> <button class="btn btn-ghost btn-sm" onclick="selectedCalDay=null;render()">×</button></div></div>
      <div class="day-section"><h4>יתרות בסוף יום זה</h4>
        <div class="dash-grid">${balances.map(b=>`<div class="acct-card" style="cursor:default"><div class="acct-name">${escapeHtml(b.account.name)}</div><div class="acct-type">${b.account.currency==='USD'?'דולר':'שקל'}</div><div class="acct-bal" style="${b.balance<0?'color:var(--red)':''}">${fmtMoney(b.balance,b.account.currency)}</div></div>`).join('')}</div>
      </div>
      ${events.length>0?`<div class="day-section"><h4>אירועים ופגישות</h4>${events.map(e=>`<div class="task-item" onclick="openEventModal('${e.id}')" style="cursor:pointer"><div style="background:var(--accent-soft);color:var(--accent);padding:6px 8px;border-radius:6px;text-align:center;min-width:52px;font-size:11px;font-weight:700;line-height:1.25">${escapeHtml(eventTimeDisplay(e))}</div><div class="task-content"><div class="task-title">${escapeHtml(e.title)}</div>${e.location?`<div class="task-meta">📍 ${escapeHtml(e.location)}</div>`:''}${linkedTopicsForEventHtml(e.id)}</div></div>`).join('')}</div>`:''}
      ${tasks.length>0?`<div class="day-section"><h4>משימות</h4>${tasks.map(renderFullTaskItem).join('')}</div>`:''}
      ${txs.length>0?`<div class="day-section"><h4>תנועות</h4><div class="table-wrap"><table><tbody>${txs.map(renderTxRowMini).join('')}</tbody></table></div></div>`:''}
      ${checks.length>0?`<div class="day-section"><h4>צ׳קים</h4><div class="table-wrap"><table><tbody>${checks.map(renderCheckRowMini).join('')}</tbody></table></div></div>`:''}
      ${recOccs.length>0?`<div class="day-section"><h4>פריטים קבועים</h4>${recOccs.map(r=>{const acct=state.accounts.find(a=>a.id===r.accountId);const cls=r.type==='income'?'pos':'neg';const sign=r.type==='income'?'+':'-';return `<div class="task-item" onclick="openRecurringModal('${r.id}')" style="cursor:pointer"><div style="background:var(--purple-soft);color:var(--purple);padding:6px;border-radius:6px;font-size:14px">↻</div><div class="task-content"><div class="task-title">${escapeHtml(r.name)}</div><div class="task-meta">${acct?escapeHtml(acct.name):''}</div></div><div class="amount ${cls}">${sign}${fmtMoney(r.amount,r.currency).replace('-','')}</div></div>`}).join('')}</div>`:''}
      ${events.length===0&&tasks.length===0&&txs.length===0&&checks.length===0&&recOccs.length===0?'<div class="empty"><div class="empty-title">אין פעילות ביום זה</div></div>':''}
    </div>`;
  }
  return `
    <div class="page-header">
      <div><h1 class="page-title">יומן</h1><div class="page-sub">חודש לועזי + תאריך עברי בכל יום · פגישות עם התחלה וסיום</div></div>
      <button class="btn btn-primary" onclick="openEventModal()">+ אירוע חדש</button>
    </div>
    <div class="card">
      <div class="cal-head">
        <div>
          <div class="cal-greg-title">${monthNames[calendarMonth]} ${calendarYear}</div>
          <div class="cal-heb-range">${escapeHtml(hebMonthLine)}</div>
          <div class="cal-sub-hint">שורת הימים למעלה: א׳–ש׳ = ימי השבוע הלועזיים (ראשון–שבת). בכל משבצת: מספר יום בחודש הלועזי + תאריך עברי (יום בחודש העברי). ריחוף או לחיצה ארוכה מציגים את התאריך המלא בשתי השיטות.</div>
        </div>
        <div class="cal-nav"><button type="button" onclick="prevMonth()">→ קודם</button><button type="button" onclick="goToToday()">היום</button><button type="button" onclick="nextMonth()">הבא ←</button></div>
      </div>
      <div class="cal-grid">${dayNames.map(n=>`<div class="cal-dayname">${n}</div>`).join('')}${cells.join('')}</div>
      <div style="display:flex;gap:13px;margin-top:12px;font-size:11px;color:var(--ink-soft);flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:5px"><div class="cal-dot"></div> אירוע</div>
        <div style="display:flex;align-items:center;gap:5px"><div class="cal-dot task"></div> משימה</div>
        <div style="display:flex;align-items:center;gap:5px"><div class="cal-dot tx"></div> תנועה</div>
        <div style="display:flex;align-items:center;gap:5px"><div class="cal-dot recurring"></div> קבוע</div>
      </div>
      ${selectedPanel}
    </div>`;
}

async function saveReopenSettings(){
  const sel=document.getElementById('settingReopenMode');
  const hoursEl=document.getElementById('settingReopenHours');
  const mode=(sel&&sel.value)||'always';
  const hours=Math.max(1,Math.min(720,parseInt(hoursEl&&hoursEl.value,10)||8));
  const meta=getMeta();
  meta.reopenMode=mode;
  meta.reopenQuietMinutes=hours*60;
  if(mode!=='timed'){
    delete meta.quickUntil;
    delete meta.quickEncPwd;
  }
  setMeta(meta);
  if(typeof masterPassword==='string'&&masterPassword)applyReopenStash(masterPassword);
  toast('העדפות כניסה נשמרו','success');
  render();
}

function renderSettings(){
  const s=state.settings;
  const sh=s.showInDashboard||{};
  const meta=getMeta();
  const reopenMode=meta.reopenMode||'always';
  const reopenHours=Math.max(1,Math.min(720,Math.round((meta.reopenQuietMinutes||480)/60)));
  const dashToggle=(key,label)=>`
    <div class="install-row">
      <span>${label}</span>
      <label class="toggle-switch" style="margin-right:auto">
        <input type="checkbox" ${sh[key]!==false?'checked':''} onchange="state.settings.showInDashboard['${key}']=this.checked;saveState();render()">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  const ulDef=defaultUiLabels();
  const ulTitles={currency:'מטבעות (תצוגה ברשימות)',txType:'סוג תנועה',txStatus:'סטטוס תנועה',paymentMethod:'אמצעי תשלום',txTag:'תיוג תנועה (קבוע/משתנה)',recurringType:'סוג הכנסה/הוצאה קבועה',recurringFrequency:'תדירות קבוע',yesNo:'קבוע פעיל (כן/לא)',accountType:'סוג חשבון',categoryType:'סוג קטגוריה',checkDirection:'כיוון צ׳ק',checkStatus:'סטטוס צ׳ק',taskPriority:'דחיפות משימה',exportRange:'אפשרויות טווח גיבוי',exportRecent:'תקופות מהירות בגיבוי'};
  let uiLabelsHtml='';
  Object.keys(ulDef).forEach(sec=>{
    uiLabelsHtml+=`<div style="font-weight:700;font-size:13px;margin:16px 0 8px;color:var(--accent)">${ulTitles[sec]||sec}</div><div class="form-row" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">`;
    Object.keys(ulDef[sec]).forEach(key=>{
      const val=(s.uiLabels&&s.uiLabels[sec]&&s.uiLabels[sec][key])||ulDef[sec][key];
      uiLabelsHtml+=`<div class="field"><label style="font-size:10px;color:var(--ink-mute)">${escapeHtml(key)}</label><input type="text" class="ui-label-input" data-uilsec="${sec}" data-uilkey="${key}" value="${escapeHtml(val)}"></div>`;
    });
    uiLabelsHtml+='</div>';
  });
  return `
    <div class="page-header">
      <div><h1 class="page-title">הגדרות</h1><div class="page-sub">התאמה אישית ואבטחה</div></div>
    </div>
    <div class="card">
      <div class="card-title">שמות</div>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;line-height:1.5">השם מופיע בברוכים הבאים. תנועות וצ׳קים — רק נתונים במכשיר; אין מצב «משתמש מתחלף».</p>
      <div class="form-row">
        <div class="field"><label>השם שלך</label>
          <input type="text" id="settingsMyName" value="${escapeHtml(s.myName||'')}" placeholder="">
        </div>
        <div class="field"><label>כינוי נוסף (אופציונלי)</label>
          <input type="text" id="settingsPartnerName" value="${escapeHtml(s.partnerName||'')}" placeholder="">
        </div>
      </div>
      <button type="button" class="btn btn-primary" onclick="saveDisplayNames()">שמור שמות</button>
    </div>
    <div class="card">
      <div class="card-title">ניהול קטגוריות, חשבונות ותקציבים</div>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;line-height:1.5">כל השמות והרשימות האלה נשלטים ידנית — אין «תבנית נסתרת» מחוץ למסכים האלה.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-secondary" onclick="navigate('categories')">קטגוריות</button>
        <button type="button" class="btn btn-secondary" onclick="navigate('accounts')">חשבונות</button>
        <button type="button" class="btn btn-secondary" onclick="navigate('budgets')">תקציבים</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">וואטסאפ וגוגל שיטס</div>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;line-height:1.65">מספר ברירת מחדל ל«דוח תנועות» בוואטסאפ. לגוגל שיטס: צרו גיליון, הדביקו את הסקריפט מ־<code style="font-size:11px">google-apps-script/SheetsSync.gs</code>, פרסמו כ-Web App (גישה: כל אחד), והדביקו את כתובת ה-URL כאן.</p>
      <div class="form-row">
        <div class="field"><label>מספר וואטסאפ (בלי +)</label>
          <input type="tel" id="settingDefaultWaPhone" dir="ltr" style="text-align:left" value="${escapeHtml(s.defaultWhatsAppPhone||'')}" placeholder="972501234567">
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>כתובת Web App (Google Apps Script)</label>
          <input type="url" id="settingSheetsUrl" dir="ltr" style="text-align:left" class="lock-input-text" value="${escapeHtml(s.sheetsSyncUrl||'')}" placeholder="https://script.google.com/macros/s/.../exec">
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>מפתח סודי (אופציונלי — זהה לסקריפט)</label>
          <input type="text" id="settingSheetsSecret" dir="ltr" style="text-align:left" autocomplete="off" value="${escapeHtml(s.sheetsSyncSecret||'')}" placeholder="ריק = ללא אימות">
        </div>
      </div>
      <button type="button" class="btn btn-primary" onclick="saveSheetsAndPhoneSettings()">שמור</button>
    </div>
    <div class="card">
      <div class="card-title">תוויות בממשק (רשימות נפתחות וטפסים)</div>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;line-height:1.5">ערכו את הטקסטים שמופיעים ליד הקוד הפנימי (למשל expense). אחרי שמירה הרשימות בתנועות/צ׳קים/קבועים יתעדכנו.</p>
      ${uiLabelsHtml}
      <button type="button" class="btn btn-primary" style="margin-top:14px" onclick="saveUiLabels()">שמור תוויות</button>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">תצוגת לוח בקרה</div>
        ${dashToggle('stats','סטטיסטיקות')}
        ${dashToggle('recentTx','תנועות אחרונות')}
        ${dashToggle('upcoming','צפוי בקרוב')}
        ${dashToggle('tasks','משימות')}
        ${dashToggle('events','אירועים')}
        ${dashToggle('alerts','התראות')}
        ${dashToggle('accountCards','כרטיסי חשבונות')}
        ${dashToggle('budgets','תקציבים בלוח בקרה')}
        ${dashToggle('backupReminder','תזכורת גיבוי בלוח בקרה')}
      </div>
      <div class="card">
        <div class="card-title">התנהגות</div>
        <div class="form-row">
          <div class="field"><label>חלון תזרים עתידי (ימים)</label>
            <input type="number" min="7" max="365" value="${s.futureWindowDays||30}" onchange="state.settings.futureWindowDays=parseInt(this.value,10)||30;saveState();render()">
          </div>
          <div class="field"><label>ימי היסטוריה בלוח בקרה</label>
            <input type="number" min="1" max="90" value="${s.historyDaysOnDash||7}" onchange="state.settings.historyDaysOnDash=parseInt(this.value,10)||7;saveState();render()">
          </div>
          <div class="field"><label>נעילה אוטומטית (דקות, 0=ללא)</label>
            <input type="number" min="0" max="240" value="${s.autoLockMinutes??15}" onchange="state.settings.autoLockMinutes=parseInt(this.value,10);saveState();resetInactivityTimer();render()">
          </div>
          <div class="field"><label>תזכורת גיבוי (ימים בלי ייצוא מלא)</label>
            <input type="number" min="1" max="120" value="${s.backupReminderDays??14}" onchange="state.settings.backupReminderDays=parseInt(this.value,10)||14;saveState();render()">
          </div>
          <div class="field" style="grid-column:1/-1">
            <label>כניסה חוזרת (אחרי ריענון או פתיחה מחדש)</label>
            <select id="settingReopenMode" class="lock-input-text" style="width:100%;max-width:420px;margin-top:4px" onchange="var r=document.getElementById('reopenTimedRow');if(r)r.style.display=this.value==='timed'?'flex':'none'">
              <option value="always" ${reopenMode==='always'?'selected':''}>תמיד — לדרוש סיסמה בכל פתיחה</option>
              <option value="session" ${reopenMode==='session'?'selected':''}>באותה לשונית בלבד — בלי סיסמה עד סגירת הלשונית</option>
              <option value="timed" ${reopenMode==='timed'?'selected':''}>זמן מהכניסה האחרונה (נשמר במכשיר)</option>
            </select>
            <div style="font-size:11px;color:var(--ink-mute);margin-top:6px;line-height:1.45">«זמן» דומה לנוחות הביומטרי: מפתח פתיחה בקידוד פשוט ב־localStorage. לא למי שחושש מגישה פיזית למכשיר. יש ללחוץ «שמור» אחרי שינוי.</div>
            <button type="button" class="btn btn-secondary" style="margin-top:8px" onclick="saveReopenSettings()">שמור העדפות כניסה</button>
          </div>
          <div class="form-row" id="reopenTimedRow" style="display:${reopenMode==='timed'?'flex':'none'};align-items:flex-end;gap:10px;flex-wrap:wrap;grid-column:1/-1">
            <div class="field"><label>משך (שעות, עד 720)</label>
              <input type="number" id="settingReopenHours" min="1" max="720" value="${reopenHours}">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">זיהוי ביומטרי (מכשיר)</div>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;line-height:1.5">שימוש בטביעת אצבע / Face ID / Windows Hello לפתיחה מהירה. <strong>חובה לפתוח מהאתר ב־HTTPS</strong> (לא מקובץ <code style="font-size:11px">file://</code>). במימוש זה נשמר מפתח פענוח בקידוד פשוט במטא־דאטה — מתאים לשימוש משפחתי מקומי.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="setupBiometric()">הגדר ביומטרי</button>
        <button class="btn btn-secondary" onclick="disableBiometric()" ${meta.biometricEnabled?'':'disabled'}>בטל ביומטרי</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">סנכרון ענן (E2E) עם Supabase</div>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;line-height:1.65">בסופבייס נשמרת רק <strong>מחרוזת מוצפנת</strong> — לא סיסמת האפליקציה ולא תוכן קריא. <strong>מפתח anon</strong> מופיע בלוח Supabase (API) והוא מיועד להיות בדפדפן; הגנה אמיתית באמצעות הרשאות RLS בשרת. סיסמת השדה למטה היא <em>לחשבון Supabase Auth</em> (לפחות 6 תווים), נפרדת מסיסמת פתיחת האפליקציה. מדריך פריסה מלא בקובץ <code style="font-size:11px">מדריך-פריסה-סופבייס-ורסל.txt</code>.</p>
      <p style="font-size:12px;color:var(--ink-mute);margin-bottom:12px">סטטוס סופבייס: <strong id="cloudVaultStatus">${cloudVaultAuthed()?'מחובר':'לא מחובר'}</strong></p>
      <div class="form-row">
        <div class="field" style="grid-column:1/-1"><label>כתובת Supabase (Project URL)</label>
          <input type="url" id="settingSupabaseUrl" dir="ltr" style="text-align:left" class="lock-input-text" value="${escapeHtml(s.supabaseUrl||'')}" placeholder="https://xxxx.supabase.co">
        </div>
        <div class="field" style="grid-column:1/-1"><label>מפתח anon (public) — מ-Project Settings → API</label>
          <input type="text" id="settingSupabaseAnonKey" dir="ltr" style="text-align:left" class="lock-input-text" autocomplete="off" value="${escapeHtml(s.supabaseAnonKey||'')}" placeholder="eyJhbGciOiJIUzI1NiIs...">
        </div>
        <div class="field"><label>אימייל (משתמש ב-Supabase Auth)</label>
          <input type="email" id="settingSupabaseAuthEmail" dir="ltr" style="text-align:left" autocomplete="username" value="${escapeHtml(s.supabaseAuthEmail||'')}" placeholder="you@example.com">
        </div>
        <div class="field"><label>סיסמה ל-Supabase (לא נשמרת באפליקציה)</label>
          <input type="password" id="settingCloudVaultPass" dir="ltr" style="text-align:left" autocomplete="current-password" placeholder="לרישום / התחברות">
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button type="button" class="btn btn-secondary" onclick="cloudVaultSaveUrls()">שמור חיבור לסופבייס</button>
        <button type="button" class="btn btn-secondary" onclick="cloudVaultRegister()">הרשמה בסופבייס</button>
        <button type="button" class="btn btn-primary" onclick="cloudVaultLogin()">התחברות לסופבייס</button>
        <button type="button" class="btn btn-secondary" onclick="cloudVaultLogout()" ${cloudVaultAuthed()?'':'disabled'}>ניתוק</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" onclick="cloudVaultPush()">דחיפה לענן (מוצפן)</button>
        <button type="button" class="btn btn-secondary" onclick="cloudVaultPull()">משיכה מהענן</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">אודות ופרטיות</div>
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.65">הנתונים נשמרים <strong>במכשיר</strong> (מוצפנים). אופציונלי: סנכרון דרך Supabase (למעלה) — בענן רק ciphertext. בלי זה: «גיבוי בין מכשירים» — ייצוא קובץ ושליחה בערוץ שבוחרים, ואז ייבוא במכשיר השני.</p>
    </div>
  `;
}

async function saveDisplayNames(){
  if(!state)return;
  const my=(document.getElementById('settingsMyName').value||'').trim();
  if(!my){toast('הזן את השם שלך','error');return}
  state.settings.myName=my;
  state.settings.partnerName=(document.getElementById('settingsPartnerName').value||'').trim();
  await saveState();
  toast('שמות נשמרו','success');
  render();
}

async function saveSheetsAndPhoneSettings(){
  if(!state)return;
  state.settings.defaultWhatsAppPhone=(document.getElementById('settingDefaultWaPhone').value||'').replace(/\D/g,'');
  state.settings.sheetsSyncUrl=(document.getElementById('settingSheetsUrl').value||'').trim();
  state.settings.sheetsSyncSecret=(document.getElementById('settingSheetsSecret').value||'').trim();
  await saveState();
  toast('נשמר','success');
  render();
}

async function saveUiLabels(){
  if(!state)return;
  const base=defaultUiLabels();
  const out={};
  Object.keys(base).forEach(sec=>{out[sec]=Object.assign({},base[sec])});
  document.querySelectorAll('.ui-label-input').forEach(inp=>{
    const sec=inp.dataset.uilsec,ukey=inp.dataset.uilkey;
    if(sec&&ukey!=null&&out[sec])out[sec][ukey]=inp.value;
  });
  state.settings.uiLabels=out;
  await saveState();
  if(typeof refreshAllFormSelectLabels==='function')refreshAllFormSelectLabels();
  toast('תוויות נשמרו','success');
  render();
}
