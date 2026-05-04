function populateAccountSelect(sel,selectedId,filterCurrency){
  if(!sel)return;
  const cur=selectedId||'';
  sel.innerHTML=state.accounts.filter(a=>!filterCurrency||a.currency===filterCurrency).map(a=>`<option value="${a.id}" ${cur===a.id?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
  if(!sel.innerHTML)sel.innerHTML='<option value="">—</option>';
}

function populateCategorySelect(sel,type,selectedId){
  if(!sel)return;
  const cur=selectedId||'';
  const cats=state.categories.filter(c=>!type||c.type===type);
  sel.innerHTML=cats.map(c=>`<option value="${c.id}" ${cur===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
  if(!sel.innerHTML)sel.innerHTML='<option value="">—</option>';
}

function updateTxFormVisibility(){
  const type=document.getElementById('txType').value;
  const transfer=type==='transfer';
  const toField=document.getElementById('txToAccountField');
  const catField=document.getElementById('txCategoryField');
  const instCard=document.getElementById('txInstallmentsCard');
  const instFields=document.getElementById('txInstallmentsFields');
  const id=document.getElementById('txId').value;
  const isNew=!id;
  toField.style.display=transfer?'block':'none';
  catField.style.display=transfer?'none':'block';
  const canPlan=isNew&&type==='expense';
  instCard.style.display=canPlan?'block':'none';
  if(!canPlan){
    document.getElementById('txHasInstallments').checked=false;
    instFields.style.display='none';
  }else{
    const has=document.getElementById('txHasInstallments').checked;
    instFields.style.display=has?'block':'none';
  }
}

function recalcInstallments(){
  const principal=parseFloat(document.getElementById('txAmount').value)||0;
  const n=Math.max(2,parseInt(document.getElementById('txInstallmentCount').value,10)||2);
  const annual=parseFloat(document.getElementById('txInterestRate').value)||0;
  const cur=document.getElementById('txCurrency').value||'ILS';
  const amounts=amortInstallmentAmounts(principal,annual,n);
  const monthly=amounts[0]||0;
  const total=amounts.reduce((a,b)=>a+b,0);
  document.getElementById('txInstallmentAmount').value=fmtMoney(monthly,cur);
  document.getElementById('txTotalToPay').value=fmtMoney(total,cur);
  const help=document.getElementById('txInterestHelp');
  if(help){
    if(annual>0)help.textContent=`לפי ריבית שנתית ${annual}% — סכום כל תשלום משוער (עיגול).`;
    else help.textContent='ללא ריבית — חלוקה שווה של הקרן.';
  }
}

function openTxModal(id,opts){
  opts=opts||{};
  refreshAllFormSelectLabels();
  document.getElementById('txModalTitle').textContent=id?'עריכת תנועה':'תנועה חדשה';
  document.getElementById('txDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('txId').value=id||'';
  if(!id){
    document.getElementById('txDate').value=todayISO();
    document.getElementById('txType').value=opts.type||'expense';
    document.getElementById('txStatus').value=opts.status||'completed';
    document.getElementById('txAmount').value='';
    document.getElementById('txCurrency').value='ILS';
    document.getElementById('txPaymentMethod').value='cash';
    document.getElementById('txDescription').value='';
    document.getElementById('txNotes').value='';
    document.getElementById('txOwner').value='me';
    document.getElementById('txTag').value='variable';
    document.getElementById('txHasInstallments').checked=!!opts.installments;
    document.getElementById('txInstallmentCount').value=3;
    document.getElementById('txFirstInstallment').value=todayISO();
    document.getElementById('txInterestRate').value='';
  }else{
    const tx=state.transactions.find(t=>t.id===id);
    if(!tx){toast('לא נמצא','error');return}
    document.getElementById('txDate').value=tx.date;
    document.getElementById('txType').value=tx.type;
    document.getElementById('txStatus').value=tx.status||'completed';
    document.getElementById('txAmount').value=tx.amount;
    document.getElementById('txCurrency').value=tx.currency||'ILS';
    document.getElementById('txPaymentMethod').value=tx.paymentMethod||'cash';
    document.getElementById('txDescription').value=tx.description||'';
    document.getElementById('txNotes').value=tx.notes||'';
    document.getElementById('txOwner').value=tx.owner||'me';
    document.getElementById('txTag').value=tx.tag||'variable';
    document.getElementById('txHasInstallments').checked=false;
  }
  const t=document.getElementById('txType').value;
  populateAccountSelect(document.getElementById('txAccount'),id?state.transactions.find(x=>x.id===id)?.accountId:null);
  populateAccountSelect(document.getElementById('txToAccount'),id?state.transactions.find(x=>x.id===id)?.toAccountId:null);
  populateCategorySelect(document.getElementById('txCategory'),t==='income'?'income':'expense',id?state.transactions.find(x=>x.id===id)?.categoryId:null);
  document.getElementById('txCurrency').onchange=()=>{recalcInstallments()};
  updateTxFormVisibility();
  if(opts.installments){
    document.getElementById('txHasInstallments').checked=true;
    updateTxFormVisibility();
  }
  recalcInstallments();
  openModal('txModal');
}

async function saveTx(){
  const id=document.getElementById('txId').value;
  const type=document.getElementById('txType').value;
  const date=document.getElementById('txDate').value;
  const status=document.getElementById('txStatus').value;
  const amount=parseFloat(document.getElementById('txAmount').value)||0;
  const currency=document.getElementById('txCurrency').value;
  const paymentMethod=document.getElementById('txPaymentMethod').value;
  const accountId=document.getElementById('txAccount').value;
  const toAccountId=document.getElementById('txToAccount').value;
  const categoryId=document.getElementById('txCategory').value;
  const description=document.getElementById('txDescription').value.trim();
  const owner=document.getElementById('txOwner').value;
  const tag=document.getElementById('txTag').value;
  const notes=document.getElementById('txNotes').value;
  const hasInst=document.getElementById('txHasInstallments').checked;
  if(!date){toast('בחר תאריך','error');return}
  if(type!=='transfer'&&!categoryId){toast('בחר קטגוריה','error');return}
  if(type==='transfer'&&(!toAccountId||toAccountId===accountId)){toast('בחר חשבון יעד שונה','error');return}
  if(amount<=0){toast('סכום חייב להיות חיובי','error');return}
  if(!accountId){toast('בחר חשבון','error');return}
  if(id){
    const tx=state.transactions.find(t=>t.id===id);
    if(!tx){toast('לא נמצא','error');return}
    Object.assign(tx,{type,date,status,amount,currency,paymentMethod,accountId,toAccountId:type==='transfer'?toAccountId:null,categoryId:type==='transfer'?null:categoryId,description,owner,tag,notes,updatedAt:Date.now()});
    await saveState();
    closeModal('txModal');
    toast('נשמר','success');
    render();
    return;
  }
  if(type==='expense'&&hasInst){
    const count=Math.max(2,parseInt(document.getElementById('txInstallmentCount').value,10)||3);
    const first=document.getElementById('txFirstInstallment').value;
    const rate=parseFloat(document.getElementById('txInterestRate').value)||0;
    const parentId=uid();
    const dates=generateInstallmentDates(first,count);
    const amounts=amortInstallmentAmounts(amount,rate,count);
    for(let i=0;i<count;i++){
      state.transactions.push({
        id:uid(),type,date:dates[i],status,amount:amounts[i],currency,paymentMethod,accountId,toAccountId:null,categoryId,description:description||`תשלום ${i+1}/${count}`,owner,tag,notes:i===0?notes:'',installmentParentId:parentId,installmentNum:i+1,installmentTotal:count,interestRate:i===0?rate:0,principal:i===0?amount:undefined,createdAt:Date.now(),updatedAt:Date.now()
      });
    }
    await saveState();
    closeModal('txModal');
    toast('נוצרה תוכנית תשלומים','success');
    render();
    return;
  }
  state.transactions.push({id:uid(),type,date,status,amount,currency,paymentMethod,accountId,toAccountId:type==='transfer'?toAccountId:null,categoryId:type==='transfer'?null:categoryId,description,owner,tag,notes,createdAt:Date.now(),updatedAt:Date.now()});
  await saveState();
  closeModal('txModal');
  toast('נשמר','success');
  render();
}

async function deleteTx(){
  const id=document.getElementById('txId').value;
  if(!id)return;
  const tx=state.transactions.find(t=>t.id===id);
  if(!tx)return;
  if(tx.installmentParentId){
    if(!confirm('למחוק את כל תשלומי התוכנית?'))return;
    const pid=tx.installmentParentId;
    state.transactions=state.transactions.filter(t=>t.installmentParentId!==pid);
    await saveState();
    closeModal('txModal');
    toast('נמחק','success');
    render();
    return;
  }
  if(!confirm('למחוק תנועה?'))return;
  state.transactions=state.transactions.filter(t=>t.id!==id);
  await saveState();
  closeModal('txModal');
  toast('נמחק','success');
  render();
}

async function confirmTx(id){
  const tx=state.transactions.find(t=>t.id===id);
  if(!tx)return;
  tx.status='completed';
  tx.updatedAt=Date.now();
  await saveState();
  toast('סומן כבוצע','success');
  render();
}

function openRecurringModal(id){
  refreshAllFormSelectLabels();
  document.getElementById('recurringModalTitle').textContent=id?'עריכת קבוע':'הכנסה/הוצאה קבועה';
  document.getElementById('recurringDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('recurringId').value=id||'';
  if(!id){
    document.getElementById('recurringType').value='expense';
    document.getElementById('recurringName').value='';
    document.getElementById('recurringAmount').value='';
    document.getElementById('recurringCurrency').value='ILS';
    document.getElementById('recurringFrequency').value='monthly';
    document.getElementById('recurringDayOfMonth').value=1;
    document.getElementById('recurringStartDate').value=todayISO();
    document.getElementById('recurringEndDate').value='';
    document.getElementById('recurringActive').value='1';
    document.getElementById('recurringNotes').value='';
  }else{
    const r=state.recurring.find(x=>x.id===id);
    if(!r)return;
    document.getElementById('recurringType').value=r.type;
    document.getElementById('recurringName').value=r.name||'';
    document.getElementById('recurringAmount').value=r.amount;
    document.getElementById('recurringCurrency').value=r.currency||'ILS';
    document.getElementById('recurringFrequency').value=r.frequency||'monthly';
    document.getElementById('recurringDayOfMonth').value=r.dayOfMonth||1;
    document.getElementById('recurringStartDate').value=r.startDate||todayISO();
    document.getElementById('recurringEndDate').value=r.endDate||'';
    document.getElementById('recurringActive').value=(r.active===1||r.active==='1'||r.active===true)?'1':'0';
    document.getElementById('recurringNotes').value=r.notes||'';
  }
  const rt=document.getElementById('recurringType').value;
  populateAccountSelect(document.getElementById('recurringAccount'),id?state.recurring.find(x=>x.id===id)?.accountId:null);
  populateCategorySelect(document.getElementById('recurringCategory'),rt==='income'?'income':'expense',id?state.recurring.find(x=>x.id===id)?.categoryId:null);
  openModal('recurringModal');
}

async function saveRecurring(){
  const id=document.getElementById('recurringId').value;
  const o={
    type:document.getElementById('recurringType').value,
    name:document.getElementById('recurringName').value.trim(),
    amount:parseFloat(document.getElementById('recurringAmount').value)||0,
    currency:document.getElementById('recurringCurrency').value,
    frequency:document.getElementById('recurringFrequency').value,
    accountId:document.getElementById('recurringAccount').value,
    categoryId:document.getElementById('recurringCategory').value,
    dayOfMonth:parseInt(document.getElementById('recurringDayOfMonth').value,10)||1,
    startDate:document.getElementById('recurringStartDate').value,
    endDate:document.getElementById('recurringEndDate').value||null,
    active:document.getElementById('recurringActive').value==='1'?1:0,
    notes:document.getElementById('recurringNotes').value
  };
  if(!o.name){toast('הזן שם','error');return}
  if(o.amount<=0){toast('סכום חייב להיות חיובי','error');return}
  if(!o.accountId||!o.categoryId){toast('בחר חשבון וקטגוריה','error');return}
  if(id){
    const r=state.recurring.find(x=>x.id===id);
    if(r)Object.assign(r,o,{updatedAt:Date.now()});
  }else state.recurring.push({id:uid(),...o,createdAt:Date.now(),updatedAt:Date.now()});
  await saveState();
  closeModal('recurringModal');
  toast('נשמר','success');
  render();
}

async function deleteRecurring(){
  const id=document.getElementById('recurringId').value;
  if(!id||!confirm('למחוק?'))return;
  state.recurring=state.recurring.filter(r=>r.id!==id);
  await saveState();
  closeModal('recurringModal');
  toast('נמחק','success');
  render();
}

function openCheckModal(id){
  refreshAllFormSelectLabels();
  document.getElementById('checkModalTitle').textContent=id?'עריכת צ׳ק':'צ׳ק חדש';
  document.getElementById('checkDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('checkId').value=id||'';
  const dirEl=document.getElementById('checkDirection');
  if(!id){
    dirEl.value='incoming';
    document.getElementById('checkDueDate').value=todayISO();
    document.getElementById('checkAmount').value='';
    document.getElementById('checkCurrency').value='ILS';
    document.getElementById('checkNumber').value='';
    document.getElementById('checkParty').value='';
    document.getElementById('checkStatus').value='pending';
    document.getElementById('checkOwner').value='me';
    document.getElementById('checkNotes').value='';
  }else{
    const c=state.checks.find(x=>x.id===id);
    if(!c)return;
    dirEl.value=c.direction||'incoming';
    document.getElementById('checkDueDate').value=c.dueDate;
    document.getElementById('checkAmount').value=c.amount;
    document.getElementById('checkCurrency').value=c.currency||'ILS';
    document.getElementById('checkNumber').value=c.checkNumber||'';
    document.getElementById('checkParty').value=c.party||'';
    document.getElementById('checkStatus').value=c.status||'pending';
    document.getElementById('checkOwner').value=c.owner||'me';
    document.getElementById('checkNotes').value=c.notes||'';
  }
  document.getElementById('checkPartyLabel').textContent=dirEl.value==='incoming'?'שם הנותן':'שם המוטב';
  populateAccountSelect(document.getElementById('checkAccount'),id?state.checks.find(x=>x.id===id)?.accountId:null);
  openModal('checkModal');
}

async function saveCheck(){
  const id=document.getElementById('checkId').value;
  const o={
    direction:document.getElementById('checkDirection').value,
    dueDate:document.getElementById('checkDueDate').value,
    amount:parseFloat(document.getElementById('checkAmount').value)||0,
    currency:document.getElementById('checkCurrency').value,
    accountId:document.getElementById('checkAccount').value,
    checkNumber:document.getElementById('checkNumber').value.trim(),
    party:document.getElementById('checkParty').value.trim(),
    status:document.getElementById('checkStatus').value,
    owner:document.getElementById('checkOwner').value,
    notes:document.getElementById('checkNotes').value
  };
  if(!o.dueDate||o.amount<=0||!o.accountId){toast('מלא שדות חובה','error');return}
  if(id){
    const c=state.checks.find(x=>x.id===id);
    if(c)Object.assign(c,o,{updatedAt:Date.now()});
  }else state.checks.push({id:uid(),...o,createdAt:Date.now(),updatedAt:Date.now()});
  await saveState();
  closeModal('checkModal');
  toast('נשמר','success');
  render();
}

async function deleteCheck(){
  const id=document.getElementById('checkId').value;
  if(!id||!confirm('למחוק?'))return;
  state.checks=state.checks.filter(c=>c.id!==id);
  await saveState();
  closeModal('checkModal');
  toast('נמחק','success');
  render();
}

async function clearCheck(id){
  const c=state.checks.find(x=>x.id===id);
  if(!c)return;
  c.status='cleared';
  c.updatedAt=Date.now();
  await saveState();
  toast('צ׳ק סומן כנפרע','success');
  render();
}

function openAccountModal(id){
  refreshAllFormSelectLabels();
  document.getElementById('accountModalTitle').textContent=id?'עריכת חשבון':'חשבון חדש';
  document.getElementById('accountDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('accountId').value=id||'';
  if(!id){
    document.getElementById('accountName').value='';
    document.getElementById('accountType').value='checking';
    document.getElementById('accountCurrency').value='ILS';
    document.getElementById('accountOpeningBalance').value=0;
    document.getElementById('accountMinBalance').value=0;
    document.getElementById('accountNotes').value='';
  }else{
    const a=state.accounts.find(x=>x.id===id);
    if(!a)return;
    document.getElementById('accountName').value=a.name||'';
    document.getElementById('accountType').value=a.type||'checking';
    document.getElementById('accountCurrency').value=a.currency||'ILS';
    document.getElementById('accountOpeningBalance').value=a.openingBalance;
    document.getElementById('accountMinBalance').value=a.minBalance;
    document.getElementById('accountNotes').value=a.notes||'';
  }
  openModal('accountModal');
}

async function saveAccount(){
  const id=document.getElementById('accountId').value;
  const o={
    name:document.getElementById('accountName').value.trim(),
    type:document.getElementById('accountType').value,
    currency:document.getElementById('accountCurrency').value,
    openingBalance:parseFloat(document.getElementById('accountOpeningBalance').value)||0,
    minBalance:parseFloat(document.getElementById('accountMinBalance').value)||0,
    notes:document.getElementById('accountNotes').value
  };
  if(!o.name){toast('הזן שם חשבון','error');return}
  if(id){
    const a=state.accounts.find(x=>x.id===id);
    if(a)Object.assign(a,o,{updatedAt:Date.now()});
  }else state.accounts.push({id:uid(),...o,createdAt:Date.now(),updatedAt:Date.now()});
  await saveState();
  closeModal('accountModal');
  toast('נשמר','success');
  render();
}

async function deleteAccount(){
  const id=document.getElementById('accountId').value;
  if(!id)return;
  const inUse=state.transactions.some(t=>t.accountId===id||t.toAccountId===id)||state.checks.some(c=>c.accountId===id)||state.recurring.some(r=>r.accountId===id);
  if(inUse&&!confirm('חשבון בשימוש — למחוק בכל זאת?'))return;
  if(!confirm('למחוק חשבון?'))return;
  state.accounts=state.accounts.filter(a=>a.id!==id);
  await saveState();
  closeModal('accountModal');
  toast('נמחק','success');
  render();
}

function openCategoryModal(id){
  refreshAllFormSelectLabels();
  document.getElementById('categoryModalTitle').textContent=id?'עריכת קטגוריה':'קטגוריה חדשה';
  document.getElementById('categoryDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('categoryId').value=id||'';
  if(!id){
    document.getElementById('categoryName').value='';
    document.getElementById('categoryType').value='expense';
  }else{
    const c=state.categories.find(x=>x.id===id);
    if(!c)return;
    document.getElementById('categoryName').value=c.name||'';
    document.getElementById('categoryType').value=c.type||'expense';
  }
  openModal('categoryModal');
}

async function saveCategory(){
  const id=document.getElementById('categoryId').value;
  const o={name:document.getElementById('categoryName').value.trim(),type:document.getElementById('categoryType').value};
  if(!o.name){toast('הזן שם','error');return}
  if(id){
    const c=state.categories.find(x=>x.id===id);
    if(c)Object.assign(c,o);
  }else state.categories.push({id:uid(),...o});
  await saveState();
  closeModal('categoryModal');
  toast('נשמר','success');
  render();
}

async function deleteCategory(){
  const id=document.getElementById('categoryId').value;
  if(!id)return;
  const inUse=state.transactions.some(t=>t.categoryId===id)||state.recurring.some(r=>r.categoryId===id)||state.budgets.some(b=>b.categoryId===id);
  if(inUse&&!confirm('קטגוריה בשימוש — למחוק?'))return;
  if(!confirm('למחוק קטגוריה?'))return;
  state.categories=state.categories.filter(c=>c.id!==id);
  state.budgets=state.budgets.filter(b=>b.categoryId!==id);
  await saveState();
  closeModal('categoryModal');
  toast('נמחק','success');
  render();
}

function openBudgetModal(id){
  refreshAllFormSelectLabels();
  document.getElementById('budgetModalTitle').textContent=id?'עריכת תקציב':'תקציב חדש';
  document.getElementById('budgetDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('budgetId').value=id||'';
  const sel=document.getElementById('budgetCategory');
  populateCategorySelect(sel,'expense',id?state.budgets.find(b=>b.id===id)?.categoryId:null);
  if(!id){
    document.getElementById('budgetAmount').value='';
    document.getElementById('budgetCurrency').value='ILS';
    document.getElementById('budgetNotes').value='';
  }else{
    const b=state.budgets.find(x=>x.id===id);
    if(!b)return;
    document.getElementById('budgetAmount').value=b.amount;
    document.getElementById('budgetCurrency').value=b.currency||'ILS';
    document.getElementById('budgetNotes').value=b.notes||'';
  }
  openModal('budgetModal');
}

async function saveBudget(){
  const id=document.getElementById('budgetId').value;
  const o={
    categoryId:document.getElementById('budgetCategory').value,
    amount:parseFloat(document.getElementById('budgetAmount').value)||0,
    currency:document.getElementById('budgetCurrency').value,
    notes:document.getElementById('budgetNotes').value
  };
  if(!o.categoryId){toast('בחר קטגוריה','error');return}
  if(o.amount<=0){toast('סכום חייב להיות חיובי','error');return}
  if(state.budgets.some(b=>b.categoryId===o.categoryId&&b.currency===o.currency&&b.id!==id)){toast('כבר קיים תקציב לקטגוריה ומטבע זה','error');return}
  if(id){
    const b=state.budgets.find(x=>x.id===id);
    if(b)Object.assign(b,o,{updatedAt:Date.now()});
  }else state.budgets.push({id:uid(),...o,createdAt:Date.now(),updatedAt:Date.now()});
  await saveState();
  closeModal('budgetModal');
  toast('נשמר','success');
  render();
}

async function deleteBudget(){
  const id=document.getElementById('budgetId').value;
  if(!id||!confirm('למחוק?'))return;
  state.budgets=state.budgets.filter(b=>b.id!==id);
  await saveState();
  closeModal('budgetModal');
  toast('נמחק','success');
  render();
}

function buildTaskLinkedEventOptions(selectedId){
  if(!state)return'';
  const evs=[...state.events].sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  let h='<option value="">ללא קישור לפגישה</option>';
  evs.forEach(e=>{
    const lbl=fmtDate(e.date)+' · '+eventTimeDisplay(e)+' · '+(e.title||'ללא כותרת');
    h+=`<option value="${e.id}" ${e.id===selectedId?'selected':''}>${escapeHtml(lbl)}</option>`;
  });
  return h;
}

function buildSubtaskEventSelectOptions(selectedId){
  if(!state)return'<option value="">ללא פגישה</option>';
  const evs=[...state.events].sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  let h='<option value="">ללא פגישה</option>';
  evs.forEach(e=>{
    const raw=e.title||'אירוע';
    const ttl=raw.length>24?raw.slice(0,24)+'…':raw;
    h+=`<option value="${e.id}" ${e.id===selectedId?'selected':''}>${escapeHtml(fmtDate(e.date)+' · '+ttl)}</option>`;
  });
  return h;
}

function renderSubtasksEditor(){
  const box=document.getElementById('subtasksList');
  if(!box)return;
  box.innerHTML=editingSubtasks.map((s,i)=>{
    const sel=s.linkedEventId||'';
    const opts=buildSubtaskEventSelectOptions(sel);
    return `<div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap"><input type="text" style="flex:1;min-width:120px;padding:7px;border:1px solid var(--line);border-radius:6px" value="${escapeHtml(s.title)}" oninput="editingSubtasks[${i}].title=this.value"><select style="flex:0 1 200px;max-width:100%;font-size:11px;padding:6px;border:1px solid var(--line);border-radius:6px" onchange="editingSubtasks[${i}].linkedEventId=this.value||null">${opts}</select><button type="button" class="btn btn-ghost btn-sm" onclick="editingSubtasks.splice(${i},1);renderSubtasksEditor()">×</button></div>`;
  }).join('');
}

function addSubtaskField(){
  editingSubtasks.push({title:'',done:false,linkedEventId:null});
  renderSubtasksEditor();
}

function openTaskModal(id){
  refreshAllFormSelectLabels();
  document.getElementById('taskModalTitle').textContent=id?'עריכת משימה':'משימה חדשה';
  document.getElementById('taskDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('taskId').value=id||'';
  let linkedEv=null;
  if(!id){
    document.getElementById('taskTitle').value='';
    document.getElementById('taskDueDate').value='';
    document.getElementById('taskReminderTime').value='';
    document.getElementById('taskPriority').value='med';
    document.getElementById('taskNotes').value='';
    editingSubtasks=[];
  }else{
    const t=state.tasks.find(x=>x.id===id);
    if(!t)return;
    document.getElementById('taskTitle').value=t.title||'';
    document.getElementById('taskDueDate').value=t.dueDate||'';
    document.getElementById('taskReminderTime').value=t.reminderTime||'';
    document.getElementById('taskPriority').value=t.priority||'med';
    document.getElementById('taskNotes').value=t.notes||'';
    linkedEv=t.linkedEventId||null;
    editingSubtasks=JSON.parse(JSON.stringify(t.subtasks||[]));
  }
  const tLe=document.getElementById('taskLinkedEvent');
  if(tLe)tLe.innerHTML=buildTaskLinkedEventOptions(linkedEv);
  renderSubtasksEditor();
  openModal('taskModal');
}

async function saveTask(){
  const id=document.getElementById('taskId').value;
  const leRaw=(document.getElementById('taskLinkedEvent')&&document.getElementById('taskLinkedEvent').value||'').trim();
  const linkedEventId=leRaw||null;
  const o={
    title:document.getElementById('taskTitle').value.trim(),
    dueDate:document.getElementById('taskDueDate').value||null,
    reminderTime:document.getElementById('taskReminderTime').value||null,
    priority:document.getElementById('taskPriority').value,
    owner:'both',
    linkedEventId,
    notes:document.getElementById('taskNotes').value,
    subtasks:editingSubtasks.filter(s=>s.title&&s.title.trim()).map(s=>{
      const row={title:s.title.trim(),done:!!s.done};
      if(s.linkedEventId)row.linkedEventId=s.linkedEventId;
      return row;
    })
  };
  if(!o.title){toast('הזן כותרת','error');return}
  if(id){
    const t=state.tasks.find(x=>x.id===id);
    if(t)Object.assign(t,o,{updatedAt:Date.now()});
  }else state.tasks.push({id:uid(),...o,done:false,createdAt:Date.now(),updatedAt:Date.now()});
  await saveState();
  closeModal('taskModal');
  toast('נשמר','success');
  render();
}

async function deleteTask(){
  const id=document.getElementById('taskId').value;
  if(!id||!confirm('למחוק?'))return;
  state.tasks=state.tasks.filter(t=>t.id!==id);
  await saveState();
  closeModal('taskModal');
  toast('נמחק','success');
  render();
}

async function toggleTask(id){
  const t=state.tasks.find(x=>x.id===id);
  if(!t)return;
  t.done=!t.done;
  t.updatedAt=Date.now();
  await saveState();
  render();
}

async function toggleSubtask(taskId,idx){
  const t=state.tasks.find(x=>x.id===taskId);
  if(!t||!t.subtasks||!t.subtasks[idx])return;
  t.subtasks[idx].done=!t.subtasks[idx].done;
  t.updatedAt=Date.now();
  await saveState();
  render();
}

function toggleEventTimeFields(){
  const row=document.getElementById('eventTimeRow');
  const allDay=document.getElementById('eventAllDay').checked;
  if(row)row.style.display=allDay?'none':'grid';
}

function openEventModal(id){
  document.getElementById('eventModalTitle').textContent=id?'עריכת אירוע':'אירוע חדש';
  document.getElementById('eventDeleteBtn').style.display=id?'inline-flex':'none';
  document.getElementById('eventId').value=id||'';
  if(!id){
    document.getElementById('eventTitle').value='';
    document.getElementById('eventDate').value=selectedCalDay||todayISO();
    document.getElementById('eventTime').value='';
    document.getElementById('eventEndTime').value='';
    document.getElementById('eventAllDay').checked=false;
    document.getElementById('eventLocation').value='';
    document.getElementById('eventNotes').value='';
  }else{
    const e=state.events.find(x=>x.id===id);
    if(!e)return;
    document.getElementById('eventTitle').value=e.title||'';
    document.getElementById('eventDate').value=e.date||todayISO();
    document.getElementById('eventAllDay').checked=!!e.allDay;
    document.getElementById('eventTime').value=e.allDay?'':(e.time||'');
    document.getElementById('eventEndTime').value=e.allDay?'':(e.endTime||'');
    document.getElementById('eventLocation').value=e.location||'';
    document.getElementById('eventNotes').value=e.notes||'';
  }
  toggleEventTimeFields();
  openModal('eventModal');
}

async function saveEvent(){
  const id=document.getElementById('eventId').value;
  const allDay=document.getElementById('eventAllDay').checked;
  const time=allDay?'':document.getElementById('eventTime').value;
  const endTime=allDay?'':document.getElementById('eventEndTime').value;
  if(!allDay&&time&&endTime&&endTime<=time){toast('שעת הסיום חייבת להיות אחרי ההתחלה','error');return}
  const o={
    title:document.getElementById('eventTitle').value.trim(),
    date:document.getElementById('eventDate').value,
    allDay,
    time,
    endTime,
    location:document.getElementById('eventLocation').value.trim(),
    notes:document.getElementById('eventNotes').value
  };
  if(!o.title||!o.date){toast('מלא כותרת ותאריך','error');return}
  if(id){
    const e=state.events.find(x=>x.id===id);
    if(e)Object.assign(e,o,{updatedAt:Date.now()});
  }else state.events.push({id:uid(),...o,createdAt:Date.now(),updatedAt:Date.now()});
  await saveState();
  closeModal('eventModal');
  toast('נשמר','success');
  render();
}

async function deleteEvent(){
  const id=document.getElementById('eventId').value;
  if(!id||!confirm('למחוק?'))return;
  state.tasks.forEach(t=>{
    if(t.linkedEventId===id)t.linkedEventId=null;
    (t.subtasks||[]).forEach(s=>{if(s.linkedEventId===id)s.linkedEventId=null});
  });
  state.events=state.events.filter(e=>e.id!==id);
  await saveState();
  closeModal('eventModal');
  toast('נמחק','success');
  render();
}

function switchSyncTab(tab){
  document.querySelectorAll('#syncModal .tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.getElementById('syncTabExport').style.display=tab==='export'?'block':'none';
  document.getElementById('syncTabReports').style.display=tab==='reports'?'block':'none';
  document.getElementById('syncTabImport').style.display=tab==='import'?'block':'none';
  document.getElementById('syncTabDanger').style.display=tab==='danger'?'block':'none';
  if(tab==='reports'&&state){
    const ph=document.getElementById('exportWhatsAppPhone');
    if(ph&&!ph.value.trim()&&state.settings.defaultWhatsAppPhone)ph.value=state.settings.defaultWhatsAppPhone;
  }
}

function refillSelect(id,section,order){
  const el=document.getElementById(id);
  if(!el)return;
  const prev=el.value;
  el.innerHTML=order.map(k=>`<option value="${k}">${escapeHtml(uiLabel(section,k))}</option>`).join('');
  if([...el.options].some(o=>o.value===String(prev)))el.value=prev;
}

function refreshAllFormSelectLabels(){
  if(!state)return;
  refillSelect('txType','txType',['expense','income','transfer']);
  refillSelect('txStatus','txStatus',['completed','pending']);
  refillSelect('txCurrency','currency',['ILS','USD']);
  refillSelect('txPaymentMethod','paymentMethod',['cash','credit','bit','check','other']);
  refillSelect('txTag','txTag',['variable','fixed']);
  refillSelect('recurringType','recurringType',['expense','income']);
  refillSelect('recurringCurrency','currency',['ILS','USD']);
  refillSelect('recurringFrequency','recurringFrequency',['monthly','bimonthly','quarterly','yearly','weekly']);
  refillSelect('recurringActive','yesNo',['1','0']);
  refillSelect('checkDirection','checkDirection',['incoming','outgoing']);
  refillSelect('checkCurrency','currency',['ILS','USD']);
  refillSelect('checkStatus','checkStatus',['pending','cleared','bounced']);
  refillSelect('accountType','accountType',['checking','savings','cash','credit','other']);
  refillSelect('accountCurrency','currency',['ILS','USD']);
  refillSelect('categoryType','categoryType',['expense','income']);
  refillSelect('budgetCurrency','currency',['ILS','USD']);
  refillSelect('taskPriority','taskPriority',['low','med','high']);
  refillSelect('exportRange','exportRange',['all','range','recent']);
  refillSelect('exportRecent','exportRecent',['7','30','90','180','365']);
}

function getExportDateBoundsForReports(){
  const range=document.getElementById('exportRange').value;
  if(range==='all')return{from:null,to:null};
  if(range==='range'){
    return{
      from:document.getElementById('exportFromDate').value||null,
      to:document.getElementById('exportToDate').value||null
    };
  }
  const days=parseInt(document.getElementById('exportRecent').value,10)||30;
  const t=new Date();t.setDate(t.getDate()-days);
  return{from:localISO(t),to:todayISO()};
}

function transactionsForCurrentExportRange(){
  const{from,to}=getExportDateBoundsForReports();
  const inR=d=>{if(!d)return false;return(!from||d>=from)&&(!to||d<=to)};
  return state.transactions.filter(tx=>inR(tx.date)).sort((a,b)=>a.date.localeCompare(b.date));
}

function csvEscapeCell(v){
  if(v==null)return'';
  const s=String(v);
  if(/[",\n\r]/.test(s))return'"'+s.replace(/"/g,'""')+'"';
  return s;
}

async function exportTransactionsCsv(){
  if(!state||!masterPassword){toast('פתחו את האפליקציה','error');return}
  const txs=transactionsForCurrentExportRange();
  const headers=['מזהה','תאריך','סוג','סטטוס','סכום','מטבע','קטגוריה','חשבון','חשבון_יעד','תיאור','אמצעי_תשלום','תיוג','הערות','עודכן'];
  const rows=txs.map(tx=>{
    const cat=tx.categoryId?state.categories.find(c=>c.id===tx.categoryId):null;
    const acct=state.accounts.find(a=>a.id===tx.accountId);
    const acctTo=tx.toAccountId?state.accounts.find(a=>a.id===tx.toAccountId):null;
    return[
      tx.id,
      tx.date,
      uiLabel('txType',tx.type),
      uiLabel('txStatus',tx.status||'completed'),
      tx.amount,
      tx.currency,
      cat?cat.name:'',
      acct?acct.name:'',
      acctTo?acctTo.name:'',
      tx.description||'',
      uiLabel('paymentMethod',tx.paymentMethod||'cash'),
      uiLabel('txTag',tx.tag||'variable'),
      (tx.notes||'').replace(/\r?\n/g,' '),
      tx.updatedAt||''
    ].map(csvEscapeCell).join(',');
  });
  const bom='\uFEFF';
  const csv=bom+headers.join(',')+'\n'+rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`תנועות-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('קובץ CSV הורד (נפתח באקסל)','success');
}

function normalizeWaPhone(raw){
  let d=String(raw||'').replace(/\D/g,'');
  if(d.startsWith('0'))d='972'+d.slice(1);
  return d;
}

function buildTransactionsReportText(){
  const txs=transactionsForCurrentExportRange();
  const lines=[];
  lines.push('דוח תנועות — מערכת פנימית');
  lines.push('נוצר: '+fmtDate(new Date())+' · '+txs.length+' תנועות');
  lines.push('—————————————');
  txs.forEach((tx,i)=>{
    const cat=tx.categoryId?state.categories.find(c=>c.id===tx.categoryId):null;
    const acct=state.accounts.find(a=>a.id===tx.accountId);
    const parts=[(i+1)+')',fmtDate(tx.date),uiLabel('txType',tx.type),fmtMoney(tx.amount,tx.currency).replace(/\s/g,' ')];
    if(cat)parts.push(cat.name);
    if(acct)parts.push(acct.name);
    if(tx.description)parts.push(tx.description);
    if(tx.notes)parts.push('('+tx.notes.replace(/\r?\n/g,' ')+')');
    lines.push(parts.join(' · '));
  });
  return lines.join('\n');
}

function shareTransactionsWhatsApp(){
  if(!state){toast('לא זמין','error');return}
  let phone=(document.getElementById('exportWhatsAppPhone')&&document.getElementById('exportWhatsAppPhone').value)||'';
  if(!phone.trim())phone=state.settings.defaultWhatsAppPhone||'';
  phone=normalizeWaPhone(phone);
  if(!phone||phone.length<9){toast('הזינו מספר טלפון (למשל 972501234567)','error');return}
  const text=buildTransactionsReportText();
  if(text.length>3800)toast('ההודעה ארוכה — וואטסאפ עלול לחתוך; מומלץ «הורד CSV»','');
  window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
}

async function syncTransactionsToGoogleSheets(){
  if(!state||!masterPassword){toast('פתחו את האפליקציה','error');return}
  const url=(state.settings.sheetsSyncUrl||'').trim();
  if(!url){toast('הגדירו כתובת Web App בהגדרות','error');return}
  const txs=state.transactions.map(tx=>{
    const cat=tx.categoryId?state.categories.find(c=>c.id===tx.categoryId):null;
    const acct=state.accounts.find(a=>a.id===tx.accountId);
    const acctTo=tx.toAccountId?state.accounts.find(a=>a.id===tx.toAccountId):null;
    return{
      id:tx.id,date:tx.date,type:tx.type,status:tx.status||'completed',amount:tx.amount,currency:tx.currency,
      category:cat?cat.name:'',account:acct?acct.name:'',toAccount:acctTo?acctTo.name:'',
      description:tx.description||'',paymentMethod:tx.paymentMethod||'cash',tag:tx.tag||'',notes:tx.notes||'',
      updatedAt:tx.updatedAt||tx.createdAt||0
    };
  });
  try{
    await fetch(url,{
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({secret:state.settings.sheetsSyncSecret||'',deviceId:state.deviceId,transactions:txs})
    });
    toast('הבקשה נשלחה לגוגל — בדקו את הגיליון (הדפדפן לא תמיד מציג תשובה מפורטת)','success');
  }catch(e){
    console.error(e);
    toast('שליחה נכשלה — בדקו רשת וכתובת. '+((e&&e.message)||''),'error');
  }
}

function updateExportFields(){
  const v=document.getElementById('exportRange').value;
  document.getElementById('exportRangeFields').style.display=v==='range'?'grid':'none';
  document.getElementById('exportRecentField').style.display=v==='recent'?'block':'none';
}

function buildExportPayload(){
  const range=document.getElementById('exportRange').value;
  const clone=JSON.parse(JSON.stringify(state));
  const inDate=(ds,from,to)=>{if(!ds)return false;const d=ds;return(!from||d>=from)&&(!to||d<=to)};
  if(range==='all')return clone;
  let from=null,to=null;
  if(range==='range'){
    from=document.getElementById('exportFromDate').value||null;
    to=document.getElementById('exportToDate').value||null;
  }else if(range==='recent'){
    const days=parseInt(document.getElementById('exportRecent').value,10)||30;
    const t=new Date();t.setDate(t.getDate()-days);
    from=localISO(t);to=todayISO();
  }
  clone.transactions=clone.transactions.filter(tx=>inDate(tx.date,from,to));
  clone.checks=clone.checks.filter(c=>inDate(c.dueDate,from,to));
  clone.tasks=clone.tasks.filter(t=>!t.dueDate||inDate(t.dueDate,from,to));
  clone.events=clone.events.filter(e=>inDate(e.date,from,to));
  return clone;
}

function recordFullBackupExported(){
  try{
    const m=getMeta();
    m.lastFullBackupAt=Date.now();
    setMeta(m);
  }catch(e){}
}

async function buildExportFile(){
  const data=buildExportPayload();
  const json=JSON.stringify({version:2,exportedAt:Date.now(),deviceId:state.deviceId,data});
  const enc=document.getElementById('exportEncrypted').checked;
  const body=enc?await Crypto.encrypt(json,masterPassword):json;
  const blob=new Blob([body],{type:enc?'application/octet-stream':'application/json'});
  const name=enc?`family-backup-${todayISO()}.fmenc`:`family-backup-${todayISO()}.json`;
  return{blob,name,encrypted:enc};
}

async function exportData(){
  if(!masterPassword){toast('לא מחובר','error');return}
  try{
    const {blob,name}=await buildExportFile();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=name;
    a.click();
    URL.revokeObjectURL(a.href);
    recordFullBackupExported();
    toast('גיבוי נשמר בהורדות','success');
  }catch(e){console.error(e);toast('שגיאה בייצוא','error')}
}

async function exportDataShare(){
  if(!masterPassword){toast('לא מחובר','error');return}
  try{
    const {blob,name}=await buildExportFile();
    const file=new File([blob],name,{type:blob.type});
    if(navigator.share&&typeof File!=='undefined'&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:'גיבוי',text:'קובץ גיבוי — לייבא במכשיר אחר (ללא שרת).'});
      recordFullBackupExported();
      toast('נפתח תפריט שיתוף','success');
    }else{
      toast('אין כאן «שתף קובץ» — מורידים את הקובץ; שלחו אותו ידנית');
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=name;
      a.click();
      URL.revokeObjectURL(a.href);
      recordFullBackupExported();
    }
  }catch(e){
    if(e&&e.name==='AbortError')return;
    console.error(e);
    toast('שיתוף בוטל או נכשל — נסו «הורד קובץ»','error');
  }
}

function mergeKey(ent,id){return `${ent}:${id}`}

function diffItemStatus(localArr,remoteArr,id){
  const L=localArr.find(x=>x.id===id);
  const R=remoteArr.find(x=>x.id===id);
  if(!L&&R)return'new';
  if(L&&!R)return'missing';
  if(!L||!R)return'same';
  const j1=JSON.stringify(L),j2=JSON.stringify(R);
  if(j1===j2)return'same';
  const lu=L.updatedAt||L.createdAt||0,ru=R.updatedAt||R.createdAt||0;
  if(ru>lu)return'update';
  if(lu>ru)return'conflict';
  return'conflict';
}

function buildMergePreview(remoteState){
  const rows=[];
  const R=remoteState||{};
  const prev=mergeDecisions||{};
  const entities=[
    ['accounts',state.accounts,R.accounts||[]],
    ['categories',state.categories,R.categories||[]],
    ['transactions',state.transactions,R.transactions||[]],
    ['checks',state.checks,R.checks||[]],
    ['recurring',state.recurring,R.recurring||[]],
    ['budgets',state.budgets,R.budgets||[]],
    ['tasks',state.tasks,R.tasks||[]],
    ['events',state.events,R.events||[]]
  ];
  mergeDecisions={};
  entities.forEach(([name,loc,rem])=>{
    const ids=new Set([...loc.map(x=>x.id),...rem.map(x=>x.id)]);
    ids.forEach(id=>{
      const st=diffItemStatus(loc,rem,id);
      if(st==='same'||st==='missing')return;
      const R=rem.find(x=>x.id===id);
      const L=loc.find(x=>x.id===id);
      const key=mergeKey(name,id);
      const defApply=st==='new'||st==='update';
      mergeDecisions[key]={entity:name,id,status:st,apply:prev[key]&&typeof prev[key].apply==='boolean'?prev[key].apply:defApply};
      const title=st==='new'?`חדש: ${name} ${R?.name||R?.title||R?.description||id}`:`${name}: ${st==='update'?'עדכון':'סתירה'} ${id}`;
      rows.push({key,title,status:st,remote:R,local:L});
    });
  });
  return rows;
}

function toggleMerge(key){
  if(!mergeDecisions[key])return;
  mergeDecisions[key].apply=!mergeDecisions[key].apply;
  renderImportPreview();
}

function renderImportPreview(){
  const box=document.getElementById('importPreview');
  if(!pendingImportData){box.style.display='none';return}
  const rows=buildMergePreview(pendingImportData);
  if(!rows.length){
    box.innerHTML='<div class="alert-item alert-success"><div class="alert-icon">✓</div><div class="alert-content"><div class="alert-title">אין הבדלים</div>הנתונים זהים למה שכבר קיים.</div></div>';
    box.style.display='block';
    return;
  }
  box.innerHTML=`<p style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">${rows.length} פריטים להחלה. סמן מה לייבא:</p>
    ${rows.map(r=>{
      const d=mergeDecisions[r.key];
      const checked=d&&d.apply;
      const st=d?.status||r.status;
      const stClass=st==='new'?'new':st==='update'?'update':'conflict';
      return `<div class="merge-item ${checked?'':'skip'}">
        <div class="merge-toggle ${checked?'checked':''}" onclick="toggleMerge('${r.key}')">${checked?'✓':''}</div>
        <div><div style="font-weight:600;font-size:13px">${escapeHtml(r.title)}</div><div style="font-size:11px;color:var(--ink-mute)">${escapeHtml(JSON.stringify(r.remote).slice(0,120))}…</div></div>
        <div><span class="merge-status ${stClass}">${st}</span></div>
      </div>`;
    }).join('')}
    <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="applyImportMerge()">ייבא נבחרים</button>`;
  box.style.display='block';
}

async function applyImportMerge(){
  if(!pendingImportData)return;
  const pick=(name)=>Object.keys(mergeDecisions).filter(k=>mergeDecisions[k].entity===name&&mergeDecisions[k].apply).map(k=>mergeDecisions[k].id);
  function upsert(arr,item){const i=arr.findIndex(x=>x.id===item.id);if(i>=0)arr[i]=item;else arr.push(item)}
  const R=pendingImportData||{};
  ['accounts','categories','transactions','checks','recurring','budgets','tasks','events'].forEach(name=>{
    const ids=new Set(pick(name));
    (R[name]||[]).forEach(item=>{if(ids.has(item.id))upsert(state[name],JSON.parse(JSON.stringify(item)))});
  });
  pendingImportData=null;
  document.getElementById('importPreview').style.display='none';
  await saveState();
  closeModal('syncModal');
  toast('ייבוא הושלם','success');
  render();
}

function loadImportFile(ev){
  const f=ev.target.files&&ev.target.files[0];
  if(!f)return;
  const reader=new FileReader();
  reader.onload=async e=>{
    const text=e.target.result;
    try{
      const parsed=JSON.parse(text);
      const data=parsed.data||parsed;
      pendingImportData=data;
      pendingImportEncrypted=null;
      renderImportPreview();
    }catch(err){
      pendingImportEncrypted=String(text).trim();
      pendingImportData=null;
      document.getElementById('importPwdInput').value='';
      document.getElementById('importPwdError').textContent='';
      openModal('importPwdModal');
    }
  };
  reader.readAsText(f,'UTF-8');
}

async function continueImportWithPwd(){
  const pwd=document.getElementById('importPwdInput').value;
  const err=document.getElementById('importPwdError');
  err.textContent='';
  if(!pwd){err.textContent='הזן סיסמה';return}
  try{
    const json=await Crypto.decrypt(pendingImportEncrypted,pwd);
    let parsed;
    try{parsed=JSON.parse(json)}catch(e2){err.textContent='קובץ לא תקין אחרי פענוח';return}
    pendingImportData=parsed.data||parsed;
    pendingImportEncrypted=null;
    closeModal('importPwdModal');
    renderImportPreview();
  }catch(e){err.textContent='סיסמה שגויה או קובץ פגום'}
}

async function replaceData(ev){
  const f=ev.target.files&&ev.target.files[0];
  if(!f)return;
  if(!confirm('להחליף את כל הנתונים בקובץ זה?'))return;
  const text=await f.text();
  try{
    let data;
    if(f.name.endsWith('.fmenc')||!text.trim().startsWith('{')){
      const pwd=prompt('סיסמת קובץ מוצפן:');
      if(!pwd)return;
      const json=await Crypto.decrypt(text.trim(),pwd);
      const parsed=JSON.parse(json);
      data=parsed.data||parsed;
    }else{
      const parsed=JSON.parse(text);
      data=parsed.data||parsed;
    }
    const merged=Object.assign(defaultState(),data,{settings:Object.assign(defaultState().settings,data.settings||{},{showInDashboard:Object.assign(defaultState().settings.showInDashboard,(data.settings||{}).showInDashboard||{})})});
    embeddedSupabaseDefaults(merged.settings);
    state=merged;
    await saveState();
    toast('הנתונים הוחלפו','success');
    render();
  }catch(e){toast('שגיאה בטעינת קובץ','error')}
}

function confirmFullWipe(){
  if(!confirm('למחוק הכל לצמיתות?'))return;
  if(!confirm('בטוח? לא ניתן לשחזר.'))return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(META_KEY);
  location.reload();
}

async function init(){
  const manifest={
    id:location.origin+'/',
    name:'מערכת פנימית',
    short_name:'פנימי',
    description:'תקציב, יומן ומשימות — נתונים מקומיים',
    start_url:'./',
    scope:'./',
    display:'standalone',
    display_override:['standalone','minimal-ui'],
    orientation:'portrait',
    background_color:'#efe7df',
    theme_color:'#efe7df',
    lang:'he',
    dir:'rtl',
    icons:[
      {src:'./icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'./icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
      {src:'./icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
    ],
    shortcuts:[
      {name:'הוצאה חדשה',short_name:'הוצאה',url:'./?action=new_tx',icons:[{src:'./icons/icon-192.png',sizes:'192x192',type:'image/png'}]},
      {name:'הכנסה חדשה',short_name:'הכנסה',url:'./?action=new_income',icons:[{src:'./icons/icon-192.png',sizes:'192x192',type:'image/png'}]},
      {name:'משימה חדשה',short_name:'משימה',url:'./?action=new_task',icons:[{src:'./icons/icon-192.png',sizes:'192x192',type:'image/png'}]}
    ]
  };
  const blob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
  document.getElementById('manifest-link').href=URL.createObjectURL(blob);
  const meta=getMeta();
  if(!meta.passwordHash){
    document.getElementById('setupScreen').style.display='flex';
    setTimeout(()=>{const el=document.getElementById('setupMyName');if(el)el.focus();else document.getElementById('setupInput1').focus()},100);
  }else{
    const quick=await attemptAutoUnlock();
    if(!quick){
      document.getElementById('lockScreen').style.display='flex';
      document.getElementById('lockBioBtn').style.display=meta.biometricEnabled?'':'none';
      setTimeout(()=>document.getElementById('lockInput').focus(),100);
    }
  }
  document.getElementById('lockInput').addEventListener('keydown',e=>{if(e.key==='Enter')tryUnlock()});
  document.getElementById('setupInput2').addEventListener('keydown',e=>{if(e.key==='Enter')completeSetup()});
  const setupMy=document.getElementById('setupMyName');
  if(setupMy)setupMy.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('setupInput1').focus()}});
  document.getElementById('setupInput1').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('setupInput2').focus()}});
  document.getElementById('txType').addEventListener('change',updateTxFormVisibility);
  document.getElementById('txPaymentMethod').addEventListener('change',updateTxFormVisibility);
  document.getElementById('txHasInstallments').addEventListener('change',updateTxFormVisibility);
  document.getElementById('txAmount').addEventListener('input',recalcInstallments);
  document.getElementById('txCurrency').addEventListener('change',recalcInstallments);

  if('serviceWorker' in navigator){
    const secure=location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
    if(secure){
      const base=location.pathname.replace(/[^/]*$/,'');
      navigator.serviceWorker.register(base+'sw.js',{scope:base||'/'}).catch(()=>{});
    }
  }
}

window.addEventListener('DOMContentLoaded',()=>{init().catch(e=>console.error(e))});
