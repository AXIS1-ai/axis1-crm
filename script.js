const STORAGE_KEY = 'axis1_crm_integrado_v1';
const WHATSAPP_AXIS = '5516997424912';

const $ = (id) => document.getElementById(id);
const form = $('crmForm');
const table = $('crmTable');
const alertsBox = $('alertsBox');
let records = loadRecords();

function loadRecords(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveRecords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function onlyDigits(v){ return (v || '').replace(/\D/g,''); }
function money(n){ return Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function parseMoney(v){
  if(typeof v === 'number') return v;
  const clean = (v||'').replace(/[^\d,\.]/g,'').replace(/\./g,'').replace(',','.');
  return Number(clean || 0);
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function daysBetween(dateISO){
  if(!dateISO) return null;
  const today = new Date(todayISO() + 'T00:00:00');
  const date = new Date(dateISO + 'T00:00:00');
  return Math.round((date - today) / 86400000);
}
function addDays(dateISO, days){
  const d = new Date(dateISO + 'T00:00:00'); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function formatDate(dateISO){
  if(!dateISO) return '-';
  const [y,m,d]=dateISO.split('-'); return `${d}/${m}/${y}`;
}
function waLink(phone, text){
  const number = onlyDigits(phone).startsWith('55') ? onlyDigits(phone) : `55${onlyDigits(phone)}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

$('plano').addEventListener('change', () => {
  const opt = $('plano').selectedOptions[0];
  const valor = opt?.dataset?.valor || '';
  if(valor && Number(valor) > 0) $('valor').value = money(valor);
});
$('valor').addEventListener('blur', () => { $('valor').value = money(parseMoney($('valor').value)); });
$('whatsapp').addEventListener('input', (e) => {
  let d = onlyDigits(e.target.value).slice(0,11);
  if(d.length > 10) e.target.value = d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  else if(d.length > 6) e.target.value = d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  else if(d.length > 2) e.target.value = d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const record = {
    id: $('editId').value || uid(),
    nome: $('nome').value.trim(),
    whatsapp: $('whatsapp').value.trim(),
    email: $('email').value.trim(),
    plano: $('plano').value,
    valor: parseMoney($('valor').value),
    status: $('status').value,
    primeiroContato: $('primeiroContato').value,
    dataInicio: $('dataInicio').value,
    vencimento: $('vencimento').value,
    observacoes: $('observacoes').value.trim(),
    updatedAt: new Date().toISOString()
  };
  if(onlyDigits(record.whatsapp).length < 10){ alert('Digite um WhatsApp válido com DDD.'); return; }
  if(record.status === 'Lead' && !record.primeiroContato){ alert('Para Lead, informe a data do primeiro contato.'); return; }
  if(record.status === 'Ativo' && !record.vencimento){ alert('Para Cliente Ativo, informe o próximo vencimento.'); return; }
  const idx = records.findIndex(r => r.id === record.id);
  if(idx >= 0) records[idx] = record; else records.push(record);
  saveRecords(); resetForm(); render();
});

$('clearForm').addEventListener('click', resetForm);
$('search').addEventListener('input', render);
$('filterStatus').addEventListener('change', render);

function resetForm(){
  form.reset(); $('editId').value=''; $('formTitle').textContent='Adicionar lead/cliente';
}
function fillForm(id){
  const r = records.find(x=>x.id===id); if(!r) return;
  $('editId').value=r.id; $('nome').value=r.nome; $('whatsapp').value=r.whatsapp; $('email').value=r.email;
  $('plano').value=r.plano; $('valor').value=money(r.valor); $('status').value=r.status;
  $('primeiroContato').value=r.primeiroContato||''; $('dataInicio').value=r.dataInicio||''; $('vencimento').value=r.vencimento||''; $('observacoes').value=r.observacoes||'';
  $('formTitle').textContent='Editar registro'; window.scrollTo({top:260,behavior:'smooth'});
}
function removeRecord(id){
  if(confirm('Tem certeza que deseja excluir este registro?')){ records = records.filter(r=>r.id!==id); saveRecords(); render(); }
}
function convertToClient(id){
  const r = records.find(x=>x.id===id); if(!r) return;
  r.status='Ativo'; if(!r.dataInicio) r.dataInicio=todayISO(); if(!r.vencimento) r.vencimento=addDays(todayISO(),30);
  saveRecords(); render();
}

function followStage(r){
  if(r.status !== 'Lead' || !r.primeiroContato) return null;
  const diff = -daysBetween(r.primeiroContato); // days since first contact
  if([1,3,5,7].includes(diff)) return diff;
  return null;
}
function followMessage(r, day){
  const name = r.nome.split(' ')[0];
  const msgs = {
    1:`Oi, ${name}! Tudo bem? Conseguiu dar uma olhada na proposta da AXIS 1 para o Plano ${r.plano}? Se fizer sentido, posso te orientar no melhor caminho pra começar.`,
    3:`Oi, ${name}! Passando só pra reforçar: a proposta do Plano ${r.plano} foi pensada para organizar sua presença digital e atrair mais clientes com estratégia. Quer que eu te explique os próximos passos?`,
    5:`Oi, ${name}! Estou organizando a agenda da semana e consigo encaixar mais alguns projetos. Se quiser seguir com o Plano ${r.plano}, me chama que já deixo tudo encaminhado.`,
    7:`Oi, ${name}! Vou encerrar seu atendimento por aqui pra não ficar te incomodando. Se quiser retomar a proposta da AXIS 1 depois, é só me chamar. 👍`
  };
  return msgs[day] || msgs[1];
}
function chargeMessage(r){
  const diff = daysBetween(r.vencimento);
  const name = r.nome.split(' ')[0];
  if(diff < 0) return `Oi, ${name}! Tudo bem? Passando para lembrar que o pagamento referente aos serviços da AXIS 1 venceu em ${formatDate(r.vencimento)}. Qualquer dúvida estou à disposição.`;
  if(diff === 0) return `Oi, ${name}! Tudo bem? Passando para lembrar que o pagamento referente aos serviços da AXIS 1 vence hoje. Qualquer dúvida estou à disposição.`;
  return `Oi, ${name}! Tudo bem? Passando para lembrar que o pagamento referente aos serviços da AXIS 1 vence amanhã. Qualquer dúvida estou à disposição.`;
}
function openFollow(id){ const r=records.find(x=>x.id===id); const day=followStage(r); window.open(waLink(r.whatsapp, followMessage(r, day || 1)),'_blank'); }
function openCharge(id){ const r=records.find(x=>x.id===id); window.open(waLink(r.whatsapp, chargeMessage(r)),'_blank'); }
function openWhats(id){ const r=records.find(x=>x.id===id); window.open(waLink(r.whatsapp, `Oi, ${r.nome.split(' ')[0]}! Tudo bem? Aqui é da AXIS 1.`),'_blank'); }

function renderAlerts(){
  const alerts=[];
  records.forEach(r=>{
    const f=followStage(r);
    if(f) alerts.push({type:'follow', text:`Follow-up Dia ${f}: ${r.nome} — ${r.plano}`, id:r.id, action:'Follow-up'});
    if(r.status==='Ativo' && r.vencimento){
      const d=daysBetween(r.vencimento);
      if(d <= 1) alerts.push({type:'charge', text:`${d<0?'Vencido':d===0?'Vence hoje':'Vence amanhã'}: ${r.nome} — ${money(r.valor)}`, id:r.id, action:'Cobrar'});
    }
  });
  if(!alerts.length){ alertsBox.className='alerts-box empty'; alertsBox.textContent='Nenhum alerta pendente por enquanto.'; return; }
  alertsBox.className='alerts-box';
  alertsBox.innerHTML = alerts.map(a=>`<div class="alert"><div><strong>${a.text}</strong><br><small>${a.type==='follow'?'Lead precisa de continuidade':'Cliente precisa de lembrete financeiro'}</small></div><button class="mini ${a.type==='follow'?'edit':'whats'}" onclick="${a.type==='follow'?'openFollow':'openCharge'}('${a.id}')">${a.action}</button></div>`).join('');
}

function render(){
  const q = $('search').value.toLowerCase(); const fs = $('filterStatus').value;
  const filtered = records.filter(r => (fs==='Todos'||r.status===fs) && [r.nome,r.plano,r.whatsapp,r.email].join(' ').toLowerCase().includes(q));
  table.innerHTML = filtered.length ? filtered.map(r=>{
    const f=followStage(r); const due=r.vencimento?daysBetween(r.vencimento):null;
    const followCell = r.status==='Lead' ? (f ? `<span class="due">Dia ${f}</span>` : `<span class="hint">${r.primeiroContato?`Contato: ${formatDate(r.primeiroContato)}`:'Sem data'}</span>`) : '<span class="hint">—</span>';
    const dueCell = r.status==='Ativo' ? (due===null?'<span class="hint">Sem vencimento</span>':`<span class="${due<=1?'due':'ok'}">${formatDate(r.vencimento)}</span>`) : '<span class="hint">—</span>';
    return `<tr>
      <td><strong>${r.nome}</strong><br><span class="hint">${r.whatsapp}</span></td>
      <td>${r.plano}</td><td>${money(r.valor)}</td><td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${followCell}</td><td>${dueCell}</td>
      <td><div class="actions">
        ${r.status==='Lead'?`<button class="mini whats" onclick="openFollow('${r.id}')">Follow-up</button><button class="mini edit" onclick="convertToClient('${r.id}')">Virou cliente</button>`:''}
        ${r.status==='Ativo'?`<button class="mini whats" onclick="openCharge('${r.id}')">Cobrar</button>`:''}
        <button class="mini edit" onclick="openWhats('${r.id}')">WhatsApp</button>
        <button class="mini edit" onclick="fillForm('${r.id}')">Editar</button>
        <button class="mini danger" onclick="removeRecord('${r.id}')">Excluir</button>
      </div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="hint">Nenhum registro encontrado.</td></tr>';
  const leads = records.filter(r=>r.status==='Lead').length;
  const ativos = records.filter(r=>r.status==='Ativo').length;
  const receita = records.filter(r=>r.status==='Ativo').reduce((s,r)=>s+Number(r.valor||0),0);
  $('totalLeads').textContent=leads; $('totalAtivos').textContent=ativos; $('receitaMensal').textContent=money(receita);
  renderAlerts();
}

$('exportBackup').addEventListener('click',()=>{
  const blob = new Blob([JSON.stringify(records,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`backup-axis1-crm-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href);
});
$('importBackup').addEventListener('change',(e)=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(!Array.isArray(data)) throw new Error(); records=data; saveRecords(); render(); alert('Backup importado com sucesso!'); }catch{ alert('Arquivo inválido.'); } };
  reader.readAsText(file);
});

render();
