const STORAGE_KEY = "axis1_crm_v2_insano";
const LEGACY_KEYS = ["axis1_crm_v2_insano","axis1_crm_definitivo_v1","axis1_crm_integrado_v1","axis1_crm_records","axis1_crm_clientes","axis1_clientes","crmAxis1","clientesAxis1","axis1-crm","crm"];
const SNAPSHOT_KEY = "axis1_crm_v2_snapshots";
const TRASH_KEY = "axis1_crm_v2_trash";
const GOAL_KEY = "axis1_crm_v2_goal";

const planValues = {
  "Essencial": 399.90,
  "Estratégico": 549.90,
  "Autoridade": 969.90,
  "Autoridade + Landing Page": 1119.99,
  "Autoridade + Site": 1219.90
};

const $ = (id) => document.getElementById(id);

function uid(){return "axis-"+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function onlyDigits(v){return String(v||"").replace(/\D/g,"")}
function todayStr(){return new Date().toISOString().slice(0,10)}
function parseMoney(value){
  if(typeof value==="number") return value;
  if(!value) return 0;
  let text=String(value).replace(/[^\d,.-]/g,"");
  if(text.includes(",")&&text.includes(".")) text=text.replace(/\./g,"").replace(",",".");
  else text=text.replace(",",".");
  return Number(text)||0;
}
function formatMoney(value){return (Number(value)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function formatDate(dateStr){
  if(!dateStr) return "-";
  const [y,m,d]=String(dateStr).split("-");
  if(!y||!m||!d) return "-";
  return `${d}/${m}/${y}`;
}
function daysBetween(dateStr){
  const today=new Date(`${todayStr()}T12:00:00`);
  const target=new Date(`${dateStr}T12:00:00`);
  return Math.round((target-today)/86400000);
}
function addOneMonth(dateStr){
  if(!dateStr) return "";
  const d=new Date(`${dateStr}T12:00:00`);
  const day=d.getDate();
  d.setMonth(d.getMonth()+1);
  if(d.getDate()!==day)d.setDate(0);
  return d.toISOString().slice(0,10);
}
function normalizePhone(v){
  const digits=onlyDigits(v);
  if(digits.startsWith("55")) return digits;
  return "55"+digits;
}
function normalizeStatus(status){
  const s=String(status||"").trim().toLowerCase();
  if(s.includes("ativo")) return "Ativo";
  if(s.includes("paus")) return "Pausado";
  if(s.includes("cancel")) return "Cancelado";
  if(s.includes("lead")) return "Lead";
  return status||"Lead";
}
function validateCpfCnpj(value){
  const digits=onlyDigits(value);
  if(!digits) return true;
  if(digits.length===11) return !/^(\d)\1+$/.test(digits);
  if(digits.length===14) return !/^(\d)\1+$/.test(digits);
  return false;
}
function formatDoc(value){
  const d=onlyDigits(value);
  if(d.length===11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4");
  if(d.length===14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,"$1.$2.$3/$4-$5");
  return value || "";
}
function normalizeRecord(r){
  const paymentType = r.paymentType || r.tipoPagamento || r.formaPagamento || r.forma_pagamento || "1x";
  const value = parseMoney(r.value ?? r.valor ?? r.valorMensal ?? r.valor_mensal ?? r.investimento ?? 0);
  const history = Array.isArray(r.paymentHistory) ? r.paymentHistory : (Array.isArray(r.historicoPagamentos) ? r.historicoPagamentos : []);
  return {
    id: r.id || uid(),
    name: String(r.name || r.nome || r.cliente || r.razaoSocial || r.razao_social || r.razao || r.empresa || "").trim(),
    documentNumber: onlyDigits(r.documentNumber || r.cnpj || r.cpf || r.cpfCnpj || r.cpf_cnpj || r.documento || ""),
    phone: onlyDigits(r.phone || r.telefone || r.whatsapp || r.celular || r.contato || ""),
    email: String(r.email || r.e_mail || r.mail || "").trim(),
    plan: String(r.plan || r.plano || r.planoContratado || r.plano_contratado || r.servico || "").trim(),
    value,
    status: normalizeStatus(r.status || r.situacao || r.tipo),
    paymentType: String(paymentType).includes("2") ? "2x" : "1x",
    firstContactDate: r.firstContactDate || r.primeiroContato || r.primeiro_contato || r.dataPrimeiroContato || r.data_primeiro_contato || r.contactDate || "",
    startDate: r.startDate || r.dataInicio || r.data_inicio || r.inicio || "",
    dueDate: r.dueDate || r.vencimento || r.proximoVencimento || r.proximo_vencimento || r.dataVencimento || "",
    dueDate2: r.dueDate2 || r.vencimento2 || r.segundoVencimento || r.segundo_vencimento || "",
    notes: r.notes || r.observacoes || r.obs || r.anotacoes || "",
    lastPaidDate: r.lastPaidDate || r.ultimoPagamento || r.ultimo_pagamento || null,
    paymentHistory: history.map(h => ({
      paidAt: h.paidAt || h.data || h.date || todayStr(),
      amount: parseMoney(h.amount ?? h.valor ?? h.value ?? 0),
      installment: h.installment || h.parcela || "Mensal",
      previousDueDate: h.previousDueDate || h.vencimentoAnterior || "",
      nextDueDate: h.nextDueDate || h.proximoVencimento || ""
    }))
  };
}
function migrateArray(arr){return arr.filter(x=>x&&typeof x==="object").map(normalizeRecord)}
function readArrayFromRaw(raw){
  const parsed=JSON.parse(raw);
  if(Array.isArray(parsed)) return parsed;
  if(Array.isArray(parsed.records)) return parsed.records;
  if(Array.isArray(parsed.clientes)) return parsed.clientes;
  if(Array.isArray(parsed.data)) return parsed.data;
  if(parsed.backup && Array.isArray(parsed.backup.records)) return parsed.backup.records;
  return [];
}
function findInitialData(){
  for(const key of LEGACY_KEYS){
    const raw=localStorage.getItem(key);
    if(!raw) continue;
    try{
      const arr=readArrayFromRaw(raw);
      if(Array.isArray(arr)&&arr.length) return migrateArray(arr);
    }catch{}
  }
  return [];
}

let records = findInitialData();
let trash = loadTrash();
localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

function toast(msg){
  const el=$("toast");
  el.textContent=msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),3500);
}
function getSnapshots(){
  try{return JSON.parse(localStorage.getItem(SNAPSHOT_KEY))||[]}catch{return []}
}
function createSnapshot(reason){
  const snapshots=getSnapshots();
  snapshots.unshift({date:new Date().toISOString(), reason, records});
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0,10)));
}
function saveRecords(reason="Alteração salva"){
  createSnapshot(reason);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  render();
}
function loadTrash(){
  try{return JSON.parse(localStorage.getItem(TRASH_KEY))||[]}catch{return []}
}
function saveTrash(){
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}
function restoreSnapshot(){
  const snapshots=getSnapshots();
  if(!snapshots.length) return toast("Nenhuma versão anterior encontrada.");
  const s=snapshots[0];
  if(!confirm(`Restaurar versão anterior de ${new Date(s.date).toLocaleString("pt-BR")}?\nMotivo: ${s.reason}`)) return;
  records=migrateArray(s.records||[]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  render();
  toast("Versão anterior restaurada.");
}
function recordFromForm(){
  const selectedPlan=$("plan").value;
  let value=parseMoney($("value").value);
  if(!value && planValues[selectedPlan]) value=planValues[selectedPlan];
  const existing=records.find(r=>r.id===$("recordId").value);
  return {
    id:$("recordId").value || uid(),
    name:$("name").value.trim(),
    documentNumber:onlyDigits($("documentNumber").value),
    phone:onlyDigits($("phone").value.trim()),
    email:$("email").value.trim(),
    plan:selectedPlan,
    value,
    status:$("status").value,
    paymentType:$("paymentType").value,
    firstContactDate:$("firstContactDate").value,
    startDate:$("startDate").value,
    dueDate:$("dueDate").value,
    dueDate2:$("dueDate2").value,
    notes:$("notes").value.trim(),
    lastPaidDate:existing?.lastPaidDate || null,
    paymentHistory:existing?.paymentHistory || []
  };
}
function validateRecord(r){
  if(!r.name) return "Informe o nome/razão social.";
  if(r.documentNumber && !validateCpfCnpj(r.documentNumber)) return "Informe um CPF/CNPJ com 11 ou 14 dígitos válidos.";
  if(!r.phone || r.phone.length<10 || r.phone.length>11) return "Informe um WhatsApp válido com DDD.";
  if(r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return "Informe um e-mail válido.";
  if(!r.plan) return "Selecione um plano.";
  if(r.status==="Lead" && !r.firstContactDate) return "Para lead, informe a data do primeiro contato.";
  if(r.status==="Ativo" && !r.dueDate) return "Para cliente ativo, informe o vencimento mensal ou parcela 1.";
  if(r.status==="Ativo" && r.paymentType==="2x" && !r.dueDate2) return "Para pagamento 2x, informe o vencimento da parcela 2.";
  return "";
}
function upsertRecord(r){
  const idx=records.findIndex(x=>x.id===r.id);
  if(idx>=0) records[idx]=r;
  else records.unshift(r);
  saveRecords("Cadastro salvo/editado");
  clearForm();
  toast("Cadastro salvo com segurança.");
}
function clearForm(){
  $("clientForm").reset();
  $("recordId").value="";
  $("status").value="Lead";
  $("paymentType").value="1x";
  $("dueDate2Wrap").classList.add("hidden");
  $("formTitle").textContent="Cadastrar lead/cliente";
}
function fillForm(r){
  $("recordId").value=r.id;
  $("name").value=r.name||"";
  $("documentNumber").value=formatDoc(r.documentNumber||"");
  $("phone").value=r.phone||"";
  $("email").value=r.email||"";
  $("plan").value=r.plan||"";
  $("value").value=r.value ? String(r.value).replace(".",",") : "";
  $("status").value=r.status||"Lead";
  $("paymentType").value=r.paymentType||"1x";
  $("firstContactDate").value=r.firstContactDate||"";
  $("startDate").value=r.startDate||"";
  $("dueDate").value=r.dueDate||"";
  $("dueDate2").value=r.dueDate2||"";
  $("notes").value=r.notes||"";
  toggleDue2();
  $("formTitle").textContent="Editar cadastro";
  window.scrollTo({top:0,behavior:"smooth"});
}
function deleteRecord(id){
  const rec=records.find(r=>r.id===id);
  if(!rec) return;
  if(!confirm(`Mover "${rec.name}" para a lixeira?`)) return;
  trash.unshift({...rec, deletedAt:new Date().toISOString()});
  trash=trash.slice(0,20);
  saveTrash();
  records=records.filter(r=>r.id!==id);
  saveRecords("Cadastro movido para lixeira");
  toast("Cadastro movido para a lixeira.");
}
function restoreFromTrash(id){
  const rec=trash.find(r=>r.id===id);
  if(!rec) return;
  records.unshift(normalizeRecord(rec));
  trash=trash.filter(r=>r.id!==id);
  saveTrash();
  saveRecords("Cadastro restaurado da lixeira");
  toast("Cadastro restaurado.");
}
function clearTrash(){
  if(!trash.length) return toast("Lixeira já está vazia.");
  if(!confirm("Esvaziar lixeira definitivamente?")) return;
  trash=[];
  saveTrash();
  renderTrash();
  toast("Lixeira esvaziada.");
}
function markAsClient(id){
  const r=records.find(x=>x.id===id);
  if(!r) return;
  r.status="Ativo";
  r.startDate=r.startDate||todayStr();
  r.dueDate=r.dueDate||addOneMonth(todayStr());
  saveRecords("Lead convertido em cliente");
  toast("Lead convertido em cliente ativo.");
}
function registerPayment(id, installment){
  const r=records.find(x=>x.id===id);
  if(!r) return;
  const amount = r.paymentType==="2x" ? (r.value/2) : r.value;
  const previousDueDate = installment===2 ? r.dueDate2 : r.dueDate;
  r.lastPaidDate=todayStr();
  r.paymentHistory=r.paymentHistory||[];
  r.paymentHistory.unshift({
    paidAt: todayStr(),
    amount,
    installment: r.paymentType==="2x" ? `${installment}ª parcela` : "Mensal",
    previousDueDate,
    nextDueDate: installment===2 || r.paymentType==="1x" ? addOneMonth(previousDueDate||todayStr()) : r.dueDate2
  });
  if(r.paymentType==="1x"){
    r.dueDate=addOneMonth(r.dueDate||todayStr());
  } else if(installment===2){
    r.dueDate=addOneMonth(r.dueDate||todayStr());
    r.dueDate2=addOneMonth(r.dueDate2||todayStr());
  }
  saveRecords("Pagamento registrado");
  toast(r.paymentType==="2x" && installment===1 ? "1ª parcela registrada. 2ª parcela continua pendente." : "Pagamento registrado.");
}
function whatsappUrl(phone,message){return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`}
function openCharge(id, installment=1){
  const r=records.find(x=>x.id===id);
  if(!r) return;
  const due = installment===2 ? r.dueDate2 : r.dueDate;
  const parcela = r.paymentType==="2x" ? ` da ${installment}ª parcela` : "";
  const diff=daysBetween(due);
  const msg=diff<0
    ? `Olá, tudo bem? Passando para lembrar que o pagamento${parcela} referente aos serviços da AXIS 1 venceu em ${formatDate(due)}. Pode me confirmar, por gentileza, a previsão de regularização?`
    : `Olá, tudo bem? Passando para lembrar que o pagamento${parcela} referente aos serviços da AXIS 1 vence em ${formatDate(due)}. Qualquer dúvida estou à disposição.`;
  window.open(whatsappUrl(r.phone,msg),"_blank");
}
function openFollowUp(id){
  const r=records.find(x=>x.id===id);
  if(!r) return;
  const day=Math.max(1,daysBetween(r.firstContactDate)*-1);
  const messages={
    1:`Olá, ${r.name}! Conseguiu dar uma olhada na proposta da AXIS 1? Se fizer sentido, posso te orientar no melhor caminho para começar.`,
    3:`Olá, ${r.name}! Passando só para reforçar: a proposta da AXIS 1 foi pensada para posicionar melhor sua marca e atrair mais clientes com estratégia.`,
    5:`Olá, ${r.name}! Estou organizando a agenda da semana. Se quiser avançar com a proposta, consigo deixar tudo encaminhado para você.`,
    7:`Olá, ${r.name}! Vou encerrar seu atendimento por aqui para não ficar te incomodando. Se quiser retomar depois, é só me chamar.`
  };
  const targetDay=[7,5,3,1].find(d=>day>=d)||1;
  window.open(whatsappUrl(r.phone,messages[targetDay]),"_blank");
}
function paymentMonthTotal(){
  const now=new Date();
  const y=now.getFullYear(), m=now.getMonth();
  return records.reduce((sum,r)=>sum+(r.paymentHistory||[]).reduce((s,h)=>{
    const d=new Date(`${h.paidAt}T12:00:00`);
    return d.getFullYear()===y && d.getMonth()===m ? s+(Number(h.amount)||0) : s;
  },0),0);
}
function isPaymentRegisteredThisCycle(r, installment){
  const due = installment===2 ? r.dueDate2 : r.dueDate;
  return (r.paymentHistory||[]).some(h=>h.previousDueDate===due && String(h.installment).includes(r.paymentType==="2x"?`${installment}`:"Mensal"));
}
function exportBackup(){
  const payload={exportedAt:new Date().toISOString(), version:"crm-v2-insano", records, trash, monthlyGoal:localStorage.getItem(GOAL_KEY)||""};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`backup-crm-axis1-v2-insano-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup exportado.");
}
function importBackup(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      let imported = Array.isArray(data)?data:(data.records||data.clientes||data.data||data.backup?.records);
      if(!Array.isArray(imported)) throw new Error("Formato inválido");
      if(!confirm("Importar esse backup vai substituir os cadastros atuais deste navegador. Deseja continuar?")) return;
      createSnapshot("Antes de importar backup");
      records=migrateArray(imported);
      if(Array.isArray(data.trash)) trash=migrateArray(data.trash);
      if(data.monthlyGoal) localStorage.setItem(GOAL_KEY, data.monthlyGoal);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      saveTrash();
      loadGoal();
      render();
      toast("Backup importado e convertido automaticamente.");
    }catch(e){toast("Não foi possível importar. Arquivo inválido ou incompatível.")}
  };
  reader.readAsText(file);
}
function loadGoal(){
  const g=localStorage.getItem(GOAL_KEY)||"";
  $("monthlyGoal").value=g ? String(g).replace(".",",") : "";
}
function saveGoal(){
  localStorage.setItem(GOAL_KEY, parseMoney($("monthlyGoal").value));
  renderMetrics();
  toast("Meta mensal salva.");
}
function toggleDue2(){
  $("dueDate2Wrap").classList.toggle("hidden", $("paymentType").value!=="2x");
}
function getFilteredRecords(){
  const q=$("searchInput").value.trim().toLowerCase();
  const status=$("statusFilter").value;
  return records.filter(r=>{
    const matchStatus=status==="Todos"||r.status===status;
    const text=`${r.name} ${r.documentNumber} ${r.plan} ${r.phone} ${r.email} ${r.notes}`.toLowerCase();
    return matchStatus && text.includes(q);
  });
}
function buildAlerts(){
  const alerts=[];
  records.forEach(r=>{
    if(r.status==="Ativo"){
      const dues = r.paymentType==="2x" ? [{n:1,date:r.dueDate},{n:2,date:r.dueDate2}] : [{n:1,date:r.dueDate}];
      dues.forEach(d=>{
        if(!d.date || isPaymentRegisteredThisCycle(r,d.n)) return;
        const diff=daysBetween(d.date);
        const label = r.paymentType==="2x" ? `${d.n}ª parcela` : "mensalidade";
        if(diff<0) alerts.push({urgent:true,type:"Cobrança vencida",text:`${r.name} — ${label} venceu em ${formatDate(d.date)}`,action:()=>openCharge(r.id,d.n),label:"Cobrar"});
        if(diff===0) alerts.push({urgent:true,type:"Vence hoje",text:`${r.name} — ${label} vence hoje`,action:()=>openCharge(r.id,d.n),label:"Cobrar"});
        if(diff>=1 && diff<=3) alerts.push({urgent:false,type:`Vence em ${diff} dia(s)`,text:`${r.name} — ${label} vence em ${formatDate(d.date)}`,action:()=>openCharge(r.id,d.n),label:"Cobrar"});
      });
    }
    if(r.status==="Lead" && r.firstContactDate){
      const day=daysBetween(r.firstContactDate)*-1;
      if([1,3,5,7].includes(day)) alerts.push({urgent:false,type:`Follow-up dia ${day}`,text:`${r.name} precisa de follow-up`,action:()=>openFollowUp(r.id),label:"Follow-up"});
    }
  });
  return alerts;
}
function renderAlerts(){
  const box=$("alertsList");
  const alerts=buildAlerts();
  box.innerHTML="";
  if(!alerts.length){box.innerHTML=`<div class="alert-item"><span>Nenhum alerta pendente agora.</span></div>`;return}
  alerts.forEach(a=>{
    const div=document.createElement("div");
    div.className=`alert-item ${a.urgent?"urgent":""}`;
    div.innerHTML=`<div><strong>${a.type}</strong><br><span>${a.text}</span></div><button class="btn btn-primary btn-small">${a.label}</button>`;
    div.querySelector("button").onclick=a.action;
    box.appendChild(div);
  });
}
function renderMetrics(){
  const active=records.filter(r=>r.status==="Ativo");
  const leads=records.filter(r=>r.status==="Lead");
  const activeRevenue=active.reduce((sum,r)=>sum+(Number(r.value)||0),0);
  const received=paymentMonthTotal();
  const goal=parseMoney(localStorage.getItem(GOAL_KEY)||0);
  const overdue=records.filter(r=>r.status==="Ativo" && ((r.dueDate&&daysBetween(r.dueDate)<0&&!isPaymentRegisteredThisCycle(r,1)) || (r.paymentType==="2x"&&r.dueDate2&&daysBetween(r.dueDate2)<0&&!isPaymentRegisteredThisCycle(r,2)))).length;
  $("receivedMonth").textContent=formatMoney(received);
  $("remainingGoal").textContent=formatMoney(Math.max(goal-received,0));
  $("activeRevenue").textContent=formatMoney(activeRevenue);
  $("activeCount").textContent=active.length;
  $("leadCount").textContent=leads.length;
  $("overdueCount").textContent=overdue;
}
function renderTable(){
  const tbody=$("recordsTable");
  const data=getFilteredRecords();
  if(!data.length){tbody.innerHTML=`<tr><td colspan="9">Nenhum cadastro encontrado.</td></tr>`;return}
  tbody.innerHTML="";
  data.forEach(r=>{
    const overdue = r.status==="Ativo" && ((r.dueDate&&daysBetween(r.dueDate)<0&&!isPaymentRegisteredThisCycle(r,1)) || (r.paymentType==="2x"&&r.dueDate2&&daysBetween(r.dueDate2)<0&&!isPaymentRegisteredThisCycle(r,2)));
    const tr=document.createElement("tr");
    if(overdue) tr.classList.add("row-overdue");
    const payText = r.paymentType==="2x" ? `2x (${formatMoney(r.value/2)} + ${formatMoney(r.value/2)})` : "Mensal / 1x";
    const dueText = r.paymentType==="2x" ? `1ª: ${formatDate(r.dueDate)}<br>2ª: ${formatDate(r.dueDate2)}` : formatDate(r.dueDate);
    const actions=[`<button class="btn btn-secondary btn-small" data-action="edit">Editar</button>`,`<button class="btn btn-secondary btn-small" data-action="history">Histórico</button>`];
    if(r.status==="Lead"){actions.push(`<button class="btn btn-primary btn-small" data-action="follow">Follow-up</button>`,`<button class="btn btn-warning btn-small" data-action="client">Virou cliente</button>`)}
    if(r.status==="Ativo"){
      if(r.paymentType==="2x") actions.push(`<button class="btn btn-primary btn-small" data-action="paid1">Pago 1</button>`,`<button class="btn btn-primary btn-small" data-action="paid2">Pago 2</button>`,`<button class="btn btn-warning btn-small" data-action="charge1">Cobrar 1</button>`,`<button class="btn btn-warning btn-small" data-action="charge2">Cobrar 2</button>`);
      else actions.push(`<button class="btn btn-primary btn-small" data-action="paid">Pago</button>`,`<button class="btn btn-warning btn-small" data-action="charge">Cobrar</button>`);
    }
    actions.push(`<button class="btn btn-danger btn-small" data-action="delete">Excluir</button>`);
    tr.innerHTML=`
      <td><strong>${r.name||"-"}</strong><br><span class="muted">${r.phone||""}${r.email?` • ${r.email}`:""}</span></td>
      <td>${r.documentNumber?formatDoc(r.documentNumber):"-"}</td>
      <td>${r.plan||"-"}</td>
      <td>${formatMoney(r.value)}</td>
      <td><span class="badge ${r.status}">${r.status}</span>${overdue?`<br><span class="badge overdue">atrasado</span>`:""}</td>
      <td>${payText}</td>
      <td>${dueText}</td>
      <td>${formatDate(r.lastPaidDate)}</td>
      <td><div class="actions">${actions.join("")}</div></td>`;
    tr.querySelector('[data-action="edit"]').onclick=()=>fillForm(r);
    tr.querySelector('[data-action="history"]').onclick=()=>showHistory(r.id);
    tr.querySelector('[data-action="delete"]').onclick=()=>deleteRecord(r.id);
    const map={follow:()=>openFollowUp(r.id),client:()=>markAsClient(r.id),paid:()=>registerPayment(r.id,1),paid1:()=>registerPayment(r.id,1),paid2:()=>registerPayment(r.id,2),charge:()=>openCharge(r.id,1),charge1:()=>openCharge(r.id,1),charge2:()=>openCharge(r.id,2)};
    Object.entries(map).forEach(([k,fn])=>{const b=tr.querySelector(`[data-action="${k}"]`); if(b)b.onclick=fn});
    tbody.appendChild(tr);
  });
}
function showHistory(id){
  const r=records.find(x=>x.id===id);
  if(!r) return;
  const c=$("historyContent");
  const hist=r.paymentHistory||[];
  if(!hist.length)c.innerHTML=`<p class="muted">Nenhum pagamento registrado para ${r.name}.</p>`;
  else c.innerHTML=hist.map(h=>`<div class="history-row"><div><strong>${h.installment}</strong><br><span class="muted">Pago em ${formatDate(h.paidAt)} | Vencimento: ${formatDate(h.previousDueDate)}</span></div><strong>${formatMoney(h.amount)}</strong></div>`).join("");
  $("historyDialog").showModal();
}
function renderTrash(){
  const box=$("trashList");
  if(!trash.length){box.innerHTML=`<div class="trash-item"><span>Lixeira vazia.</span></div>`;return}
  box.innerHTML="";
  trash.forEach(r=>{
    const div=document.createElement("div");
    div.className="trash-item";
    div.innerHTML=`<div><strong>${r.name||"-"}</strong><br><span>${r.plan||"-"} • excluído em ${new Date(r.deletedAt||Date.now()).toLocaleString("pt-BR")}</span></div><button class="btn btn-warning btn-small">Restaurar</button>`;
    div.querySelector("button").onclick=()=>restoreFromTrash(r.id);
    box.appendChild(div);
  });
}
function render(){renderMetrics();renderAlerts();renderTable();renderTrash()}

$("clientForm").addEventListener("submit",e=>{e.preventDefault();const r=recordFromForm();const error=validateRecord(r);if(error)return toast(error);upsertRecord(r)});
$("plan").addEventListener("change",()=>{const plan=$("plan").value;if(planValues[plan]&&!$("value").value)$("value").value=String(planValues[plan]).replace(".",",")});
$("paymentType").addEventListener("change",toggleDue2);
$("documentNumber").addEventListener("blur",()=>{$("documentNumber").value=formatDoc($("documentNumber").value)});
$("clearFormBtn").onclick=clearForm;
$("exportBackupBtn").onclick=exportBackup;
$("importBackupInput").onchange=e=>importBackup(e.target.files[0]);
$("restoreSnapshotBtn").onclick=restoreSnapshot;
$("saveGoalBtn").onclick=saveGoal;
$("searchInput").oninput=renderTable;
$("statusFilter").onchange=renderTable;
$("closeHistoryBtn").onclick=()=>$("historyDialog").close();
$("clearTrashBtn").onclick=clearTrash;

loadGoal();
toggleDue2();
render();
