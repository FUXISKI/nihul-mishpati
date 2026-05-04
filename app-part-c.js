function renderDashboard(){
  const today=new Date();
  const todayHeb=HebrewDate.format(today);
  const settings=state.settings.showInDashboard||{};
  const ilsBal=getTotalByCurrency('ILS');
  const usdBal=getTotalByCurrency('USD');
  const ilsProj=getTotalByCurrency('ILS','projected');
  const usdProj=getTotalByCurrency('USD','projected');
  const m=today.getMonth(),y=today.getFullYear();
  let monthIncomeIls=0,monthExpIls=0;
  state.transactions.forEach(tx=>{
    const d=new Date(tx.date);
    if(d.getMonth()===m&&d.getFullYear()===y&&tx.status==='completed'&&tx.currency==='ILS'){
      if(tx.type==='income')monthIncomeIls+=+tx.amount;
      if(tx.type==='expense')monthExpIls+=+tx.amount;
    }
  });
  const alerts=generateCashflowAlerts();
  const histDays=state.settings.historyDaysOnDash||7;
  const histCutoff=new Date(today);histCutoff.setDate(histCutoff.getDate()-histDays);
  const recent=[...state.transactions].filter(t=>t.status==='completed'&&new Date(t.date)>=histCutoff).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  const futureDays=state.settings.futureWindowDays||30;
  const futureCutoff=new Date(today);futureCutoff.setDate(futureCutoff.getDate()+futureDays);
  const upcoming=[...state.transactions].filter(t=>t.status==='pending'&&new Date(t.date)<=futureCutoff).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,6);
  const upcomingChecks=[...state.checks].filter(c=>c.status==='pending'&&new Date(c.dueDate)<=futureCutoff).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,5);
  const todayTasks=state.tasks.filter(t=>!t.done&&t.dueDate===todayISO()).slice(0,4);
  const overdueTasks=state.tasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<todayISO()).slice(0,4);
  const todayEvents=[...state.events.filter(e=>e.date===todayISO())].sort(compareEventsBySchedule).slice(0,3);
  const backupMeta=getMeta();
  const backupAfterDays=state.settings.backupReminderDays??14;
  const lastFullBackup=backupMeta.lastFullBackupAt;
  const daysNoBackup=lastFullBackup?(Date.now()-lastFullBackup)/864e5:Infinity;
  const backupBanner=settings.backupReminder!==false&&(!lastFullBackup||daysNoBackup>backupAfterDays);
  let backupBannerHtml='';
  if(backupBanner){
    const msg=!lastFullBackup
      ?'עדיין לא נרשם כאן ייצוא גיבוי מלא מהמכשיר הזה. הנתונים חיים בדפדפן בלבד — «ניקוי נתוני אתר» או מחיקת האתר עלולים למחוק הכל בלי אזהרה ייעודית.'
      :`עברו כ־${Math.floor(daysNoBackup)} ימים מאז ייצוא גיבוי מלא אחרון. כדאי לגבות לפני עדכוני מערכת או ניקוי דפדפן.`;
    backupBannerHtml=`<div class="card" style="margin-bottom:14px;border:1px solid var(--gold);background:linear-gradient(135deg,var(--gold-soft) 0%,var(--bg-soft) 100%)"><div style="font-size:13px;line-height:1.6;color:var(--ink-soft)"><strong style="color:var(--ink)">גיבוי</strong> — ${msg} אפשר גם <strong>גוגל שיטס</strong> בהגדרות לסנכרון תנועות שוטף (עם שיקול פרטיות). </div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn btn-primary btn-sm" onclick="openModal('syncModal')">פתח גיבוי בין מכשירים</button><button type="button" class="btn btn-secondary btn-sm" onclick="navigate('settings')">הגדרות</button></div></div>`;
  }
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">שלום, ${escapeHtml(myDisplayName())}</h1>
        <div class="page-sub">${fmtDate(today)} · ${todayHeb}</div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="openTxModal(null,{type:'expense'})">💸 הוצאה</button>
        <button class="btn btn-secondary" onclick="openTxModal(null,{type:'income'})">💰 הכנסה</button>
        <button class="btn btn-primary" onclick="openTaskModal()">+ משימה</button>
      </div>
    </div>
    ${backupBannerHtml}
    ${!state.accounts.length||!state.categories.length?`<div class="card" style="margin-bottom:14px;border:1px dashed var(--line);background:var(--bg-soft)"><div style="font-size:13px;line-height:1.55;color:var(--ink-soft)">התחלה נקייה: עדיין אין <strong>חשבונות</strong> או <strong>קטגוריות</strong>. הוסיפו לפחות אחד מכל סוג כדי לרשום הכנסות והוצאות.</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn btn-primary btn-sm" onclick="navigate('accounts')">+ חשבון</button><button type="button" class="btn btn-secondary btn-sm" onclick="navigate('categories')">+ קטגוריות</button></div></div>`:''}
    ${settings.alerts!==false&&alerts.length>0?`<div style="margin-bottom:16px">${alerts.slice(0,5).map(a=>`<div class="alert-item alert-${a.type}"><div class="alert-icon">${a.type==='danger'?'⚠️':a.type==='warn'?'⏰':'ℹ️'}</div><div class="alert-content"><div class="alert-title">${a.title}</div><div>${a.message}</div></div></div>`).join('')}</div>`:''}
    ${settings.stats!==false?`
      <div class="dash-grid">
        <div class="stat" onclick="navigate('accounts')">
          <div class="stat-label">סה״כ שקלים</div>
          <div class="stat-value ${ilsBal>=0?'pos':'neg'}">${fmtMoney(ilsBal,'ILS')}</div>
          <div class="stat-sub">צפוי ${futureDays} ימים: ${fmtMoney(ilsProj,'ILS')}</div>
        </div>
        <div class="stat" onclick="navigate('accounts')">
          <div class="stat-label">סה״כ דולרים</div>
          <div class="stat-value ${usdBal>=0?'pos':'neg'}">${fmtMoney(usdBal,'USD')}</div>
          <div class="stat-sub">צפוי: ${fmtMoney(usdProj,'USD')}</div>
        </div>
        <div class="stat" onclick="navigate('transactions')">
          <div class="stat-label">הכנסות החודש</div>
          <div class="stat-value pos">${fmtMoney(monthIncomeIls,'ILS')}</div>
          <div class="stat-sub">${today.toLocaleDateString('he-IL',{month:'long'})}</div>
        </div>
        <div class="stat" onclick="navigate('transactions')">
          <div class="stat-label">הוצאות החודש</div>
          <div class="stat-value neg">${fmtMoney(monthExpIls,'ILS')}</div>
          <div class="stat-sub">יתרה: ${fmtMoney(monthIncomeIls-monthExpIls,'ILS')}</div>
        </div>
      </div>
    `:''}
    ${settings.accountCards!==false&&state.accounts.length>0?`
      <div class="card">
        <div class="card-title">חשבונות <button class="btn btn-ghost btn-sm" onclick="navigate('accounts')">כולם ←</button></div>
        <div class="dash-grid">
          ${state.accounts.slice(0,4).map(a=>{
            const bal=getAccountBalance(a.id);
            const proj=getAccountBalance(a.id,'projected');
            const min=parseFloat(a.minBalance||0);
            const lowProj=proj<min&&min>0;
            return `<div class="acct-card" onclick="openAccountModal('${a.id}')">
              <div class="acct-name">${escapeHtml(a.name)}</div>
              <div class="acct-type">${a.currency==='USD'?'דולר':'שקל'}</div>
              <div class="acct-bal" style="${bal<0?'color:var(--red)':''}">${fmtMoney(bal,a.currency)}</div>
              ${proj!==bal?`<div class="acct-bal-future" style="${lowProj?'color:var(--red);font-weight:600':''}">צפוי: ${fmtMoney(proj,a.currency)}</div>`:''}
              ${lowProj?`<div class="acct-warn">⚠ חוסר ${fmtMoney(min-proj,a.currency)}</div>`:''}
            </div>`;
          }).join('')}
        </div>
      </div>
    `:''}
    <div class="two-col">
      ${settings.recentTx!==false?`<div class="card">
        <div class="card-title">תנועות אחרונות (${histDays} ימים) <button class="btn btn-ghost btn-sm" onclick="navigate('transactions')">הכל ←</button></div>
        ${recent.length===0?'<div class="empty"><div class="empty-icon">⇅</div><div class="empty-title">אין תנועות</div><button class="btn btn-primary btn-sm" onclick="openTxModal()" style="margin-top:8px">+ תנועה</button></div>':`<div class="table-wrap"><table><tbody>${recent.map(renderTxRowMini).join('')}</tbody></table></div>`}
      </div>`:''}
      ${settings.upcoming!==false?`<div class="card">
        <div class="card-title">צפוי בקרוב <button class="btn btn-ghost btn-sm" onclick="navigate('future')">הכל ←</button></div>
        ${upcoming.length===0&&upcomingChecks.length===0?'<div class="empty"><div class="empty-icon">◷</div><div class="empty-title">אין תנועות עתידיות</div></div>':`<div class="table-wrap"><table><tbody>${upcoming.map(renderTxRowMini).join('')}${upcomingChecks.map(renderCheckRowMini).join('')}</tbody></table></div>`}
      </div>`:''}
    </div>
    <div class="two-col">
      ${settings.tasks!==false?`<div class="card">
        <div class="card-title">משימות להיום <button class="btn btn-ghost btn-sm" onclick="navigate('tasks')">הכל ←</button></div>
        ${overdueTasks.length>0?`<div style="margin-bottom:9px"><div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:5px">באיחור</div>${overdueTasks.map(renderTaskItemMini).join('')}</div>`:''}
        ${todayTasks.length===0&&overdueTasks.length===0?'<div class="empty"><div class="empty-icon">✓</div><div class="empty-title">אין משימות להיום</div></div>':todayTasks.map(renderTaskItemMini).join('')}
      </div>`:''}
      ${settings.events!==false?`<div class="card">
        <div class="card-title">היום ביומן <button class="btn btn-ghost btn-sm" onclick="navigate('calendar')">ליומן ←</button></div>
        ${todayEvents.length===0?'<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">אין אירועים היום</div></div>':todayEvents.map(e=>`<div class="task-item" onclick="openEventModal('${e.id}')" style="cursor:pointer"><div style="background:var(--accent-soft);color:var(--accent);padding:6px 9px;border-radius:7px;text-align:center;min-width:52px"><div style="font-size:12px;font-weight:700;line-height:1.25">${escapeHtml(eventTimeDisplay(e))}</div></div><div class="task-content"><div class="task-title">${escapeHtml(e.title)}</div>${e.location?`<div class="task-meta">📍 ${escapeHtml(e.location)}</div>`:''}</div></div>`).join('')}
      </div>`:''}
    </div>
  `;
}

function renderTxRowMini(tx){
  const acct=state.accounts.find(a=>a.id===tx.accountId);
  const cat=state.categories.find(c=>c.id===tx.categoryId);
  const sign=tx.type==='income'?'+':(tx.type==='expense'?'-':'');
  const cls=tx.type==='income'?'pos':(tx.type==='expense'?'neg':'');
  const desc=tx.description||(tx.type==='transfer'?uiLabel('txType','transfer'):(cat?cat.name:''));
  const isInst=tx.installmentParentId?`<span class="recurring-badge">${tx.installmentNum}/${tx.installmentTotal}</span> `:'';
  return `<tr style="cursor:pointer" onclick="openTxModal('${tx.id}')">
    <td style="width:24px">${tx.type==='income'?'↗':tx.type==='expense'?'↙':'⇄'}</td>
    <td><div style="font-weight:500;font-size:13px">${isInst}${escapeHtml(desc)}</div><div style="font-size:11px;color:var(--ink-mute)">${acct?escapeHtml(acct.name):''}</div></td>
    <td style="text-align:left"><div class="amount ${cls}">${sign}${fmtMoney(tx.amount,tx.currency).replace('-','')}</div><div style="font-size:11px;color:var(--ink-mute)">${fmtDateShort(tx.date)}</div></td>
  </tr>`;
}

function renderCheckRowMini(c){
  const acct=state.accounts.find(a=>a.id===c.accountId);
  const cls=c.direction==='incoming'?'pos':'neg';
  const sign=c.direction==='incoming'?'+':'-';
  return `<tr style="cursor:pointer" onclick="openCheckModal('${c.id}')">
    <td style="width:24px">✎</td>
    <td><div style="font-weight:500;font-size:13px">צ׳ק: ${escapeHtml(c.party||'')}</div><div style="font-size:11px;color:var(--ink-mute)">${acct?escapeHtml(acct.name):''}</div></td>
    <td style="text-align:left"><div class="amount ${cls}">${sign}${fmtMoney(c.amount,c.currency).replace('-','')}</div><div style="font-size:11px;color:var(--ink-mute)">${fmtDateShort(c.dueDate)}</div></td>
  </tr>`;
}

function renderTaskItemMini(t){
  const isOverdue=t.dueDate&&t.dueDate<todayISO()&&!t.done;
  const prCls='priority-'+(t.priority||'med');
  return `<div class="task-item ${t.done?'done':''} ${prCls}" onclick="if(!event.target.closest('.task-check'))openTaskModal('${t.id}')" style="cursor:pointer">
    <div class="task-check ${t.done?'done':''}" onclick="event.stopPropagation();toggleTask('${t.id}')">${t.done?'✓':''}</div>
    <div class="task-content"><div class="task-title">${escapeHtml(t.title)}</div><div class="task-meta">${t.dueDate?`<span style="${isOverdue?'color:var(--red);font-weight:600':''}">⏱ ${fmtDateShort(t.dueDate)}${t.reminderTime?' '+t.reminderTime:''}</span>`:''}${t.subtasks&&t.subtasks.length?`<span>${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}</span>`:''}</div></div>
  </div>`;
}

let txFilter={type:'all',account:'all',search:'',tag:'all',from:null,to:null,paymentMethod:'all'};

function renderTransactions(){
  let txs=[...state.transactions].filter(t=>t.status==='completed');
  if(txFilter.type!=='all')txs=txs.filter(t=>t.type===txFilter.type);
  if(txFilter.account!=='all')txs=txs.filter(t=>t.accountId===txFilter.account||t.toAccountId===txFilter.account);
  if(txFilter.tag!=='all')txs=txs.filter(t=>(t.tag||'variable')===txFilter.tag);
  if(txFilter.paymentMethod!=='all')txs=txs.filter(t=>(t.paymentMethod||'cash')===txFilter.paymentMethod);
  if(txFilter.from)txs=txs.filter(t=>t.date>=txFilter.from);
  if(txFilter.to)txs=txs.filter(t=>t.date<=txFilter.to);
  if(txFilter.search){const q=txFilter.search.toLowerCase();txs=txs.filter(t=>(t.description||'').toLowerCase().includes(q)||(t.notes||'').toLowerCase().includes(q))}
  txs.sort((a,b)=>new Date(b.date)-new Date(a.date));
  let totIncIls=0,totExpIls=0;
  txs.forEach(tx=>{
    if(tx.currency!=='ILS')return;
    if(tx.type==='income')totIncIls+=+tx.amount;
    else if(tx.type==='expense')totExpIls+=+tx.amount;
  });
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">תנועות</h1>
        <div class="page-sub">${txs.length} תנועות · הכנסות ${fmtMoney(totIncIls,'ILS')} · הוצאות ${fmtMoney(totExpIls,'ILS')}</div>
      </div>
      <button class="btn btn-primary" onclick="openTxModal()">+ תנועה חדשה</button>
    </div>
    <div class="card">
      <div class="filters">
        <div class="search-wrap"><input class="search-box" type="text" placeholder="חיפוש..." value="${escapeHtml(txFilter.search)}" oninput="txFilter.search=this.value;render()"></div>
        <button class="filter-pill ${txFilter.type==='all'?'active':''}" onclick="txFilter.type='all';render()">הכל</button>
        <button class="filter-pill ${txFilter.type==='income'?'active':''}" onclick="txFilter.type='income';render()">הכנסות</button>
        <button class="filter-pill ${txFilter.type==='expense'?'active':''}" onclick="txFilter.type='expense';render()">הוצאות</button>
        <button class="filter-pill ${txFilter.type==='transfer'?'active':''}" onclick="txFilter.type='transfer';render()">העברות</button>
        <select class="filter-select" onchange="txFilter.account=this.value;render()">
          <option value="all">כל החשבונות</option>
          ${state.accounts.map(a=>`<option value="${a.id}" ${txFilter.account===a.id?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="txFilter.paymentMethod=this.value;render()">
          <option value="all">כל אמצעי תשלום</option>
          <option value="cash" ${txFilter.paymentMethod==='cash'?'selected':''}>${escapeHtml(uiLabel('paymentMethod','cash'))}</option>
          <option value="credit" ${txFilter.paymentMethod==='credit'?'selected':''}>${escapeHtml(uiLabel('paymentMethod','credit'))}</option>
          <option value="bit" ${txFilter.paymentMethod==='bit'?'selected':''}>${escapeHtml(uiLabel('paymentMethod','bit'))}</option>
          <option value="check" ${txFilter.paymentMethod==='check'?'selected':''}>${escapeHtml(uiLabel('paymentMethod','check'))}</option>
          <option value="other" ${txFilter.paymentMethod==='other'?'selected':''}>${escapeHtml(uiLabel('paymentMethod','other'))}</option>
        </select>
        <select class="filter-select" onchange="txFilter.tag=this.value;render()">
          <option value="all">קבוע ומשתנה</option>
          <option value="fixed" ${txFilter.tag==='fixed'?'selected':''}>${escapeHtml(uiLabel('txTag','fixed'))}</option>
          <option value="variable" ${txFilter.tag==='variable'?'selected':''}>${escapeHtml(uiLabel('txTag','variable'))}</option>
        </select>
        <input type="date" class="filter-date" value="${txFilter.from||''}" onchange="txFilter.from=this.value||null;render()">
        <input type="date" class="filter-date" value="${txFilter.to||''}" onchange="txFilter.to=this.value||null;render()">
        ${txFilter.from||txFilter.to||txFilter.search||txFilter.type!=='all'||txFilter.account!=='all'||txFilter.tag!=='all'||txFilter.paymentMethod!=='all'?`<button class="btn btn-ghost btn-sm" onclick="txFilter={type:'all',account:'all',search:'',tag:'all',from:null,to:null,paymentMethod:'all'};render()">נקה</button>`:''}
      </div>
      ${txs.length===0?'<div class="empty"><div class="empty-icon">⇅</div><div class="empty-title">אין תנועות תואמות</div></div>':`
        <div class="table-wrap"><table>
          <thead><tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th>חשבון</th><th>אמצעי</th><th>סכום</th></tr></thead>
          <tbody>
            ${txs.map(tx=>{
              const acct=state.accounts.find(a=>a.id===tx.accountId);
              const cat=state.categories.find(c=>c.id===tx.categoryId);
              const sign=tx.type==='income'?'+':(tx.type==='expense'?'-':'');
              const cls=tx.type==='income'?'pos':(tx.type==='expense'?'neg':'');
              const pm=escapeHtml(uiLabel('paymentMethod',tx.paymentMethod||'cash'));
              const isInst=tx.installmentParentId?`<span class="recurring-badge">${tx.installmentNum}/${tx.installmentTotal}</span> `:'';
              const isFixed=tx.tag==='fixed'?`<span class="fixed-badge">${escapeHtml(uiLabel('txTag','fixed'))}</span> `:'';
              return `<tr style="cursor:pointer" onclick="openTxModal('${tx.id}')">
                <td>${fmtDateShort(tx.date)}</td>
                <td><div style="font-weight:500">${isFixed}${isInst}${escapeHtml(tx.description||(tx.type==='transfer'?uiLabel('txType','transfer'):''))}</div></td>
                <td>${cat?escapeHtml(cat.name):'—'}</td>
                <td>${acct?escapeHtml(acct.name):''}</td>
                <td>${pm}</td>
                <td class="amount ${cls}">${sign}${fmtMoney(tx.amount,tx.currency).replace('-','')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      `}
    </div>
  `;
}

function renderRecurring(){
  const expenses=state.recurring.filter(r=>r.type==='expense');
  const incomes=state.recurring.filter(r=>r.type==='income');
  let totMonthlyExpIls=0,totMonthlyIncIls=0;
  state.recurring.forEach(r=>{
    if(r.currency!=='ILS')return;
    const isActive=r.active===1||r.active==='1'||r.active===true;
    if(!isActive)return;
    const f={monthly:1,bimonthly:0.5,quarterly:1/3,yearly:1/12,weekly:4.33}[r.frequency]||1;
    const monthly=+r.amount*f;
    if(r.type==='expense')totMonthlyExpIls+=monthly;
    else totMonthlyIncIls+=monthly;
  });
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">הוצאות והכנסות קבועות</h1>
        <div class="page-sub">תנועות שחוזרות על עצמן ומשפיעות על התזרים</div>
      </div>
      <button class="btn btn-primary" onclick="openRecurringModal()">+ פריט קבוע</button>
    </div>
    <div class="three-col">
      <div class="stat" style="cursor:default">
        <div class="stat-label">הכנסות חודשיות צפויות</div>
        <div class="stat-value pos">${fmtMoney(totMonthlyIncIls,'ILS')}</div>
        <div class="stat-sub">ממוצע חודשי משוקלל</div>
      </div>
      <div class="stat" style="cursor:default">
        <div class="stat-label">הוצאות חודשיות צפויות</div>
        <div class="stat-value neg">${fmtMoney(totMonthlyExpIls,'ILS')}</div>
      </div>
      <div class="stat" style="cursor:default">
        <div class="stat-label">תזרים נטו</div>
        <div class="stat-value ${totMonthlyIncIls-totMonthlyExpIls>=0?'pos':'neg'}">${fmtMoney(totMonthlyIncIls-totMonthlyExpIls,'ILS')}</div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">הוצאות קבועות (${expenses.length})</div>
        ${expenses.length===0?'<div class="empty"><div class="empty-icon">↻</div><div class="empty-title">אין הוצאות קבועות</div></div>':`<div class="table-wrap"><table><tbody>${expenses.map(renderRecurringRow).join('')}</tbody></table></div>`}
      </div>
      <div class="card">
        <div class="card-title">הכנסות קבועות (${incomes.length})</div>
        ${incomes.length===0?'<div class="empty"><div class="empty-icon">↻</div><div class="empty-title">אין הכנסות קבועות</div></div>':`<div class="table-wrap"><table><tbody>${incomes.map(renderRecurringRow).join('')}</tbody></table></div>`}
      </div>
    </div>
  `;
}

function renderRecurringRow(r){
  const acct=state.accounts.find(a=>a.id===r.accountId);
  const freq={monthly:'חודשי',bimonthly:'דו-חודשי',quarterly:'רבעוני',yearly:'שנתי',weekly:'שבועי'}[r.frequency];
  const cls=r.type==='income'?'pos':'neg';
  const sign=r.type==='income'?'+':'-';
  const isActive=r.active===1||r.active==='1'||r.active===true;
  return `<tr style="cursor:pointer;${!isActive?'opacity:.5':''}" onclick="openRecurringModal('${r.id}')">
    <td><div style="font-weight:500">${escapeHtml(r.name)}</div><div style="font-size:11px;color:var(--ink-mute)">${freq} · יום ${r.dayOfMonth||'?'} · ${acct?escapeHtml(acct.name):''}</div></td>
    <td style="text-align:left"><div class="amount ${cls}">${sign}${fmtMoney(r.amount,r.currency).replace('-','')}</div>${!isActive?'<div style="font-size:10px;color:var(--ink-mute)">מושבת</div>':''}</td>
  </tr>`;
}

function renderInstallments(){
  const groups={};
  state.transactions.forEach(tx=>{
    if(tx.installmentParentId){
      if(!groups[tx.installmentParentId])groups[tx.installmentParentId]=[];
      groups[tx.installmentParentId].push(tx);
    }
  });
  const plans=Object.keys(groups).map(parentId=>{
    const items=groups[parentId].sort((a,b)=>(a.installmentNum||0)-(b.installmentNum||0));
    const first=items[0];
    const total=items.reduce((s,t)=>s+ +t.amount,0);
    const paid=items.filter(t=>t.status==='completed').reduce((s,t)=>s+ +t.amount,0);
    return{parentId,description:first.description||'',type:first.type,currency:first.currency,total,paid,remaining:total-paid,count:items.length,paidCount:items.filter(t=>t.status==='completed').length,items,interestRate:first.interestRate||0,principal:first.principal||total,accountId:first.accountId,paymentMethod:first.paymentMethod};
  });
  plans.sort((a,b)=>(b.remaining/b.total)-(a.remaining/a.total));
  let totIls=0;
  plans.forEach(p=>{if(p.type==='expense'&&p.currency==='ILS')totIls+=p.remaining});
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">תשלומים והלוואות</h1>
        <div class="page-sub">${plans.length} תוכניות · יתרה לתשלום: ${fmtMoney(totIls,'ILS')}</div>
      </div>
      <button class="btn btn-primary" onclick="openTxModal(null,{type:'expense',installments:true})">+ תוכנית תשלומים</button>
    </div>
    ${plans.length===0?`<div class="card"><div class="empty"><div class="empty-icon">▦</div><div class="empty-title">אין תוכניות תשלומים</div><div class="empty-desc" style="margin-bottom:10px">צור תנועה חדשה והפעל "תשלומים מרובים"</div><button class="btn btn-primary btn-sm" onclick="openTxModal(null,{type:'expense',installments:true})">+ תוכנית חדשה</button></div></div>`:plans.map(p=>{
      const acct=state.accounts.find(a=>a.id===p.accountId);
      const progress=p.count>0?(p.paidCount/p.count)*100:0;
      const cls=p.type==='income'?'pos':'neg';
      const sign=p.type==='income'?'+':'-';
      const interestText=p.interestRate>0?` · ריבית ${p.interestRate}%`:'';
      return `<div class="card" style="cursor:pointer" onclick="openInstallmentDetail('${p.parentId}')">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <div style="font-weight:600;font-size:14px">${escapeHtml(p.description||'תוכנית תשלומים')}</div>
            <div style="font-size:12px;color:var(--ink-soft);margin-top:3px">${acct?escapeHtml(acct.name):''} · ${p.paidCount}/${p.count} שולמו${interestText}</div>
          </div>
          <div style="text-align:left">
            <div class="amount ${cls}" style="font-size:15px">${sign}${fmtMoney(p.total,p.currency).replace('-','')}</div>
            <div style="font-size:11px;color:var(--ink-mute)">נותרו ${fmtMoney(p.remaining,p.currency)}</div>
          </div>
        </div>
        <div class="progress-bar"><div class="progress-fill ${progress>=100?'over':progress>=70?'':'warn'}" style="width:${Math.min(progress,100)}%"></div></div>
      </div>`;
    }).join('')}
  `;
}

function openInstallmentDetail(parentId){
  const items=state.transactions.filter(t=>t.installmentParentId===parentId).sort((a,b)=>(a.installmentNum||0)-(b.installmentNum||0));
  if(!items.length)return;
  const first=items[0];
  const acct=state.accounts.find(a=>a.id===first.accountId);
  const total=items.reduce((s,t)=>s+ +t.amount,0);
  const paid=items.filter(t=>t.status==='completed').reduce((s,t)=>s+ +t.amount,0);
  document.getElementById('instDetailTitle').textContent=first.description||'תוכנית תשלומים';
  document.getElementById('instDetailBody').innerHTML=`
    <div class="three-col" style="margin-bottom:14px">
      <div class="stat" style="cursor:default"><div class="stat-label">סך התוכנית</div><div class="stat-value">${fmtMoney(total,first.currency)}</div></div>
      <div class="stat" style="cursor:default"><div class="stat-label">שולם</div><div class="stat-value pos">${fmtMoney(paid,first.currency)}</div></div>
      <div class="stat" style="cursor:default"><div class="stat-label">נותר</div><div class="stat-value neg">${fmtMoney(total-paid,first.currency)}</div></div>
    </div>
    <div class="card">
      <div class="detail-row"><span class="detail-label">חשבון</span><span class="detail-value">${acct?escapeHtml(acct.name):''}</span></div>
      <div class="detail-row"><span class="detail-label">אמצעי תשלום</span><span class="detail-value">${escapeHtml(uiLabel('paymentMethod',first.paymentMethod||'cash'))}</span></div>
      ${first.interestRate>0?`<div class="detail-row"><span class="detail-label">ריבית שנתית</span><span class="detail-value">${first.interestRate}%</span></div>`:''}
      ${first.principal&&first.principal!==total?`<div class="detail-row"><span class="detail-label">קרן מקורית</span><span class="detail-value">${fmtMoney(first.principal,first.currency)}</span></div>`:''}
      ${first.principal&&first.principal<total?`<div class="detail-row"><span class="detail-label">סך ריבית</span><span class="detail-value" style="color:var(--red)">${fmtMoney(total-first.principal,first.currency)}</span></div>`:''}
    </div>
    <div class="card-title" style="margin:14px 0 8px">תשלומים</div>
    ${items.map(t=>`<div class="install-item ${t.status==='completed'?'paid':''}">
      <div class="num">${t.installmentNum}</div>
      <div><div style="font-weight:500;${t.status==='completed'?'text-decoration:line-through':''}">${fmtMoney(t.amount,t.currency)}</div><div style="font-size:11px;color:var(--ink-mute)">${fmtDate(t.date)}</div></div>
      <div>${t.status==='completed'?'<span class="pill pill-green">שולם</span>':t.date<todayISO()?'<span class="pill pill-red">באיחור</span>':'<span class="pill pill-gold">ממתין</span>'}</div>
      <div>${t.status!=='completed'?`<button class="btn btn-success btn-sm" onclick="confirmTx('${t.id}');closeModal('installmentDetailModal');setTimeout(()=>openInstallmentDetail('${parentId}'),200)">סמן כשולם</button>`:`<button class="btn btn-ghost btn-sm" onclick="openTxModal('${t.id}')">ערוך</button>`}</div>
    </div>`).join('')}
    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-danger" onclick="if(confirm('למחוק את כל ${items.length} התשלומים?'))deleteInstallmentPlan('${parentId}')">מחק תוכנית</button></div>
  `;
  openModal('installmentDetailModal');
}

async function deleteInstallmentPlan(parentId){
  state.transactions=state.transactions.filter(t=>t.installmentParentId!==parentId);
  await saveState();
  closeModal('installmentDetailModal');
  toast('התוכנית נמחקה','success');
  render();
}
