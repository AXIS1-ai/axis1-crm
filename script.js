const STORAGE_KEY = 'axis1_crm_clientes_v1';

const form = document.getElementById('clientForm');
const fields = {
  id: document.getElementById('clientId'),
  nome: document.getElementById('nome'),
  plano: document.getElementById('plano'),
  valor: document.getElementById('valor'),
  status: document.getElementById('status'),
  inicio: document.getElementById('inicio'),
  vencimento: document.getElementById('vencimento'),
  whatsapp: document.getElementById('whatsapp'),
  email: document.getElementById('email'),
  observacoes: document.getElementById('observacoes')
};

let clientes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes)); }
function brl(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function parseMoney(str) { return Number(String(str).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0; }
function formatDate(date) { if (!date) return '-'; const [y,m,d] = date.split('-'); return `${d}/${m}/${y}`; }
function onlyDigits(value) { return String(value || '').replace(/\D/g, ''); }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

fields.plano.addEventListener('change', () => {
  const selected = fields.plano.selectedOptions[0];
  const valor = selected?.dataset.valor || '';
  if (valor && valor !== '0') fields.valor.value = brl(valor);
  if (fields.plano.value === 'Personalizado') fields.valor.value = '';
});

fields.valor.addEventListener('blur', () => { fields.valor.value = brl(parseMoney(fields.valor.value)); });

fields.whatsapp.addEventListener('input', () => {
  let v = onlyDigits(fields.whatsapp.value).slice(0, 11);
  if (v.length > 10) fields.whatsapp.value = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  else if (v.length > 6) fields.whatsapp.value = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 2) fields.whatsapp.value = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const cliente = {
    id: fields.id.value || crypto.randomUUID(),
    nome: fields.nome.value.trim(),
    plano: fields.plano.value,
    valor: parseMoney(fields.valor.value),
    status: fields.status.value,
    inicio: fields.inicio.value,
    vencimento: fields.vencimento.value,
    whatsapp: fields.whatsapp.value.trim(),
    email: fields.email.value.trim(),
    observacoes: fields.observacoes.value.trim(),
    atualizadoEm: new Date().toISOString()
  };
  const index = clientes.findIndex(c => c.id === cliente.id);
  if (index >= 0) clientes[index] = cliente;
  else clientes.push(cliente);
  save();
  resetForm();
  render();
});

document.getElementById('resetBtn').addEventListener('click', resetForm);
document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('statusFilter').addEventListener('change', render);

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(clientes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-crm-axis1-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error('Arquivo inválido');
    clientes = data;
    save();
    render();
    alert('Backup importado com sucesso.');
  } catch {
    alert('Não foi possível importar. Verifique se o arquivo é um backup válido.');
  }
});

function resetForm() {
  form.reset();
  fields.id.value = '';
  document.getElementById('formTitle').textContent = 'Adicionar cliente';
}

function editClient(id) {
  const c = clientes.find(item => item.id === id);
  if (!c) return;
  fields.id.value = c.id;
  fields.nome.value = c.nome;
  fields.plano.value = c.plano;
  fields.valor.value = brl(c.valor);
  fields.status.value = c.status;
  fields.inicio.value = c.inicio;
  fields.vencimento.value = c.vencimento;
  fields.whatsapp.value = c.whatsapp || '';
  fields.email.value = c.email || '';
  fields.observacoes.value = c.observacoes || '';
  document.getElementById('formTitle').textContent = 'Editar cliente';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteClient(id) {
  if (!confirm('Excluir este cliente do CRM?')) return;
  clientes = clientes.filter(c => c.id !== id);
  save();
  render();
}

function buildPhone(c) {
  const digits = onlyDigits(c.whatsapp);
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function openWhats(id) {
  const c = clientes.find(item => item.id === id);
  if (!c || !c.whatsapp) return alert('Este cliente não tem WhatsApp cadastrado.');
  const msg = encodeURIComponent(`Olá, ${c.nome}! Tudo bem? Passando para falar sobre o acompanhamento do seu plano ${c.plano} da AXIS 1.`);
  window.open(`https://wa.me/${buildPhone(c)}?text=${msg}`, '_blank');
}

function cobrarCliente(id) {
  const c = clientes.find(item => item.id === id);
  if (!c || !c.whatsapp) return alert('Este cliente não tem WhatsApp cadastrado.');

  const due = daysUntil(c.vencimento);
  let msg;
  if (due < 0) {
    msg = `Olá, ${c.nome}! Tudo bem? Passando para lembrar que o pagamento referente ao plano ${c.plano} da AXIS 1 venceu em ${formatDate(c.vencimento)}.\n\nQuando puder, me envie o comprovante para eu dar baixa por aqui. Qualquer dúvida estou à disposição.`;
  } else if (due === 0) {
    msg = `Olá, ${c.nome}! Tudo bem? Passando para lembrar que o pagamento referente ao plano ${c.plano} da AXIS 1 vence hoje (${formatDate(c.vencimento)}).\n\nQualquer dúvida estou à disposição.`;
  } else if (due === 1) {
    msg = `Olá, ${c.nome}! Tudo bem? Passando para lembrar que o pagamento referente ao plano ${c.plano} da AXIS 1 vence amanhã (${formatDate(c.vencimento)}).\n\nQualquer dúvida estou à disposição.`;
  } else {
    msg = `Olá, ${c.nome}! Tudo bem? Passando para lembrar que o pagamento referente ao plano ${c.plano} da AXIS 1 vence em ${formatDate(c.vencimento)}.\n\nQualquer dúvida estou à disposição.`;
  }
  window.open(`https://wa.me/${buildPhone(c)}?text=${encodeURIComponent(msg)}`, '_blank');
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function renderAlerts() {
  const container = document.getElementById('billingAlerts');
  const ativos = clientes.filter(c => c.status === 'Ativo');
  const vencidos = ativos.filter(c => daysUntil(c.vencimento) < 0).sort((a,b) => daysUntil(a.vencimento) - daysUntil(b.vencimento));
  const hoje = ativos.filter(c => daysUntil(c.vencimento) === 0);
  const amanha = ativos.filter(c => daysUntil(c.vencimento) === 1);

  const box = (title, list, danger=false) => `
    <div class="alert-box ${danger ? 'danger' : ''}">
      <h3>${title}</h3>
      <div class="alert-list">
        ${list.map(c => `
          <div class="alert-item">
            <div><strong>${escapeHtml(c.nome)}</strong><p>${escapeHtml(c.plano)} • ${brl(c.valor)} • vencimento ${formatDate(c.vencimento)}</p></div>
            <button class="charge" onclick="cobrarCliente('${c.id}')">Cobrar no WhatsApp</button>
          </div>
        `).join('')}
      </div>
    </div>`;

  let html = '';
  if (vencidos.length) html += box('🚨 Pagamentos em atraso', vencidos, true);
  if (hoje.length) html += box('⚠️ Pagamentos vencem hoje', hoje);
  if (amanha.length) html += box('🔔 Pagamentos vencem amanhã', amanha);
  container.innerHTML = html;
}

function render() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filter = document.getElementById('statusFilter').value;
  const tbody = document.getElementById('clientsTable');

  const filtered = clientes
    .filter(c => filter === 'Todos' || c.status === filter)
    .filter(c => `${c.nome} ${c.plano} ${c.email}`.toLowerCase().includes(search))
    .sort((a,b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

  tbody.innerHTML = filtered.map(c => {
    const due = daysUntil(c.vencimento);
    const dueText = due < 0 ? `Venceu há ${Math.abs(due)} dia(s)` : due === 0 ? 'Vence hoje' : due === 1 ? 'Vence amanhã' : due <= 7 ? `Vence em ${due} dia(s)` : formatDate(c.vencimento);
    const rowClass = due < 0 && c.status === 'Ativo' ? 'overdue-row' : due === 0 && c.status === 'Ativo' ? 'today-row' : due === 1 && c.status === 'Ativo' ? 'tomorrow-row' : '';
    return `
      <tr class="${rowClass}">
        <td><strong>${escapeHtml(c.nome)}</strong><br><small>${escapeHtml(c.email || '')}</small></td>
        <td>${escapeHtml(c.plano)}</td>
        <td>${brl(c.valor)}</td>
        <td><span class="badge ${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
        <td>${formatDate(c.inicio)}</td>
        <td>${dueText}</td>
        <td class="actions">
          <button class="edit" onclick="editClient('${c.id}')">Editar</button>
          <button class="charge" onclick="cobrarCliente('${c.id}')">Cobrar</button>
          <button class="whats" onclick="openWhats('${c.id}')">WhatsApp</button>
          <button class="delete" onclick="deleteClient('${c.id}')">Excluir</button>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'block';

  const ativos = clientes.filter(c => c.status === 'Ativo');
  document.getElementById('ativosCount').textContent = ativos.length;
  document.getElementById('receitaAtiva').textContent = brl(ativos.reduce((sum, c) => sum + Number(c.valor || 0), 0));
  document.getElementById('vencemLogo').textContent = clientes.filter(c => c.status === 'Ativo' && daysUntil(c.vencimento) >= 0 && daysUntil(c.vencimento) <= 7).length;
  renderAlerts();
}

render();
