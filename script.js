const STORAGE_KEY = "axis1_crm_integrado_v1";
const AUTO_BACKUP_KEY = "axis1_crm_auto_backup_v1";
const AUTO_BACKUP_DATE_KEY = "axis1_crm_auto_backup_date_v1";

const planValues = {
  "Essencial": 399.90,
  "Estratégico": 549.90,
  "Autoridade": 969.90,
  "Autoridade + Landing Page": 1119.99,
  "Autoridade + Site": 1219.90
};

const $ = (id) => document.getElementById(id);

function uid() {
  return "axis-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  let text = String(value).replace(/[^\d,.-]/g, "");
  if (text.includes(",") && text.includes(".")) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(",", ".");
  return Number(text) || 0;
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s.includes("ativo")) return "Ativo";
  if (s.includes("paus")) return "Pausado";
  if (s.includes("cancel")) return "Cancelado";
  if (s.includes("lead")) return "Lead";
  return status || "Lead";
}

function normalizeRecord(r) {
  const name =
    r.name || r.nome || r.cliente || r.razaoSocial || r.razao_social || r.razao || r.empresa || "";
  const phone =
    r.phone || r.telefone || r.whatsapp || r.celular || r.contato || "";
  const plan =
    r.plan || r.plano || r.planoContratado || r.plano_contratado || r.servico || "";
  const value =
    r.value ?? r.valor ?? r.valorMensal ?? r.valor_mensal ?? r.investimento ?? 0;

  return {
    id: r.id || uid(),
    name: String(name || "").trim(),
    phone: onlyDigits(phone),
    plan: String(plan || "").trim(),
    value: parseMoney(value),
    status: normalizeStatus(r.status || r.situacao || r.tipo),
    firstContactDate: r.firstContactDate || r.primeiroContato || r.primeiro_contato || r.dataPrimeiroContato || r.data_primeiro_contato || r.contactDate || "",
    startDate: r.startDate || r.dataInicio || r.data_inicio || r.inicio || "",
    dueDate: r.dueDate || r.vencimento || r.proximoVencimento || r.proximo_vencimento || r.dataVencimento || "",
    notes: r.notes || r.observacoes || r.obs || r.anotacoes || "",
    lastPaidDate: r.lastPaidDate || r.ultimoPagamento || r.ultimo_pagamento || null,
    paymentHistory: Array.isArray(r.paymentHistory) ? r.paymentHistory : []
  };
}

function migrateArray(arr) {
  return arr
    .filter(item => item && typeof item === "object")
    .map(normalizeRecord);
}

function findLegacyData() {
  const possibleKeys = [
    STORAGE_KEY,
    "axis1_crm_records",
    "axis1_crm_clientes",
    "axis1_clientes",
    "crmAxis1",
    "clientesAxis1",
    "axis1-crm"
  ];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : parsed.records || parsed.clientes || parsed.data || [];
      if (Array.isArray(arr) && arr.length) return migrateArray(arr);
    } catch {}
  }

  return [];
}

function loadRecords() {
  let migrated = findLegacyData();
  if (migrated.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }
  return [];
}

let records = loadRecords();

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  autoBackup();
  render();
}

function autoBackup() {
  const payload = { exportedAt: new Date().toISOString(), version: "crm-blindado-auto-v1", records };
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(payload));
  localStorage.setItem(AUTO_BACKUP_DATE_KEY, new Date().toLocaleString("pt-BR"));
}

function formatMoney(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return "-";
  return `${d}/${m}/${y}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addOneMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function daysBetween(dateStr) {
  const today = new Date(`${todayStr()}T12:00:00`);
  const target = new Date(`${dateStr}T12:00:00`);
  return Math.round((target - today) / 86400000);
}

function normalizePhone(v) {
  const digits = onlyDigits(v);
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3300);
}

function recordFromForm() {
  const selectedPlan = $("plan").value;
  let value = parseMoney($("value").value);
  if (!value && planValues[selectedPlan]) value = planValues[selectedPlan];

  const existing = records.find(r => r.id === $("recordId").value);

  return {
    id: $("recordId").value || uid(),
    name: $("name").value.trim(),
    phone: onlyDigits($("phone").value.trim()),
    plan: selectedPlan,
    value,
    status: $("status").value,
    firstContactDate: $("firstContactDate").value,
    startDate: $("startDate").value,
    dueDate: $("dueDate").value,
    notes: $("notes").value.trim(),
    lastPaidDate: existing?.lastPaidDate || null,
    paymentHistory: existing?.paymentHistory || []
  };
}

function fillForm(record) {
  $("recordId").value = record.id;
  $("name").value = record.name || "";
  $("phone").value = record.phone || "";
  $("plan").value = record.plan || "";
  $("value").value = record.value ? String(record.value).replace(".", ",") : "";
  $("status").value = record.status || "Lead";
  $("firstContactDate").value = record.firstContactDate || "";
  $("startDate").value = record.startDate || "";
  $("dueDate").value = record.dueDate || "";
  $("notes").value = record.notes || "";
  $("formTitle").textContent = "Editar cadastro";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearForm() {
  $("clientForm").reset();
  $("recordId").value = "";
  $("status").value = "Lead";
  $("formTitle").textContent = "Cadastrar lead/cliente";
}

function validateRecord(record) {
  if (!record.name) return "Informe o nome/razão social.";
  if (!record.phone || record.phone.length < 10 || record.phone.length > 11) return "Informe um WhatsApp válido com DDD.";
  if (!record.plan) return "Selecione um plano.";
  if (record.status === "Lead" && !record.firstContactDate) return "Para lead, informe a data do primeiro contato.";
  if (record.status === "Ativo" && !record.dueDate) return "Para cliente ativo, informe o próximo vencimento.";
  return "";
}

function upsertRecord(record) {
  const idx = records.findIndex(r => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.unshift(record);
  saveRecords();
  clearForm();
  toast("Cadastro salvo com segurança.");
}

function deleteRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!confirm(`Excluir "${rec?.name || "cadastro"}"? Faça backup antes se tiver dúvida.`)) return;
  records = records.filter(r => r.id !== id);
  saveRecords();
  toast("Cadastro excluído.");
}

function markAsClient(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  rec.status = "Ativo";
  rec.startDate = rec.startDate || todayStr();
  rec.dueDate = rec.dueDate || addOneMonth(todayStr());
  saveRecords();
  toast("Lead convertido em cliente ativo.");
}

function markAsPaid(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  const oldDue = rec.dueDate || todayStr();
  const nextDue = addOneMonth(oldDue);
  rec.lastPaidDate = todayStr();
  rec.dueDate = nextDue;
  rec.paymentHistory = rec.paymentHistory || [];
  rec.paymentHistory.unshift({ paidAt: todayStr(), previousDueDate: oldDue, nextDueDate: nextDue, value: rec.value });
  saveRecords();
  toast(`Pagamento registrado. Próximo vencimento: ${formatDate(nextDue)}.`);
}

function whatsappUrl(phone, message) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function openCharge(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  const diff = daysBetween(rec.dueDate);
  const msg = diff < 0
    ? `Olá, tudo bem? Passando para lembrar que o pagamento referente aos serviços da AXIS 1 venceu em ${formatDate(rec.dueDate)}. Pode me confirmar, por gentileza, a previsão de regularização?`
    : `Olá, tudo bem? Passando para lembrar que o pagamento referente aos serviços da AXIS 1 vence em ${formatDate(rec.dueDate)}. Qualquer dúvida estou à disposição.`;
  window.open(whatsappUrl(rec.phone, msg), "_blank");
}

function openFollowUp(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  const day = Math.max(1, daysBetween(rec.firstContactDate) * -1);
  const messages = {
    1: `Olá, ${rec.name}! Conseguiu dar uma olhada na proposta da AXIS 1? Se fizer sentido, posso te orientar no melhor caminho para começar.`,
    3: `Olá, ${rec.name}! Passando só para reforçar: a proposta da AXIS 1 foi pensada para posicionar melhor sua marca e atrair mais clientes com estratégia.`,
    5: `Olá, ${rec.name}! Estou organizando a agenda da semana. Se quiser avançar com a proposta, consigo deixar tudo encaminhado para você.`,
    7: `Olá, ${rec.name}! Vou encerrar seu atendimento por aqui para não ficar te incomodando. Se quiser retomar depois, é só me chamar.`
  };
  const targetDay = [7,5,3,1].find(d => day >= d) || 1;
  window.open(whatsappUrl(rec.phone, messages[targetDay]), "_blank");
}

function exportBackup() {
  const payload = { exportedAt: new Date().toISOString(), version: "crm-blindado-auto-v1", records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup-crm-axis1-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup exportado. Guarde esse arquivo com segurança.");
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const imported = Array.isArray(data) ? data : data.records || data.clientes || data.data;
      if (!Array.isArray(imported)) throw new Error("Formato inválido");
      if (!confirm("Importar esse backup vai substituir os cadastros atuais deste navegador. Deseja continuar?")) return;
      records = migrateArray(imported);
      saveRecords();
      toast("Backup importado e convertido automaticamente.");
    } catch (e) {
      toast("Não foi possível importar. Arquivo inválido.");
    }
  };
  reader.readAsText(file);
}

function restoreAutoBackup() {
  const raw = localStorage.getItem(AUTO_BACKUP_KEY);
  if (!raw) return toast("Nenhum backup automático encontrado neste navegador.");
  const date = localStorage.getItem(AUTO_BACKUP_DATE_KEY) || "data desconhecida";
  if (!confirm(`Restaurar backup automático de ${date}? Isso substituirá a lista atual.`)) return;
  try {
    const data = JSON.parse(raw);
    const imported = Array.isArray(data) ? data : data.records;
    if (!Array.isArray(imported)) throw new Error("Formato inválido");
    records = migrateArray(imported);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    render();
    toast("Backup automático restaurado e convertido.");
  } catch {
    toast("Backup automático inválido.");
  }
}

function getFilteredRecords() {
  const q = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  return records.filter(r => {
    const matchStatus = status === "Todos" || r.status === status;
    const text = `${r.name} ${r.plan} ${r.phone} ${r.notes}`.toLowerCase();
    return matchStatus && text.includes(q);
  });
}

function renderAlerts() {
  const box = $("alertsList");
  const alerts = [];
  records.forEach(r => {
    if (r.status === "Ativo" && r.dueDate) {
      const diff = daysBetween(r.dueDate);
      if (diff < 0) alerts.push({ type: "Cobrança vencida", text: `${r.name} venceu em ${formatDate(r.dueDate)}`, action: () => openCharge(r.id), label: "Cobrar" });
      if (diff === 0) alerts.push({ type: "Vence hoje", text: `${r.name} vence hoje`, action: () => openCharge(r.id), label: "Cobrar" });
      if (diff === 1) alerts.push({ type: "Vence amanhã", text: `${r.name} vence amanhã`, action: () => openCharge(r.id), label: "Cobrar" });
    }
    if (r.status === "Lead" && r.firstContactDate) {
      const day = daysBetween(r.firstContactDate) * -1;
      if ([1,3,5,7].includes(day)) alerts.push({ type: `Follow-up dia ${day}`, text: `${r.name} precisa de follow-up`, action: () => openFollowUp(r.id), label: "Follow-up" });
    }
  });

  $("pendingCount").textContent = alerts.length;
  box.innerHTML = "";
  if (!alerts.length) {
    box.innerHTML = `<div class="alert-item"><span>Nenhum alerta pendente agora.</span></div>`;
    return;
  }
  alerts.forEach(a => {
    const div = document.createElement("div");
    div.className = "alert-item";
    div.innerHTML = `<div><strong>${a.type}</strong><br><span>${a.text}</span></div><button class="btn btn-primary btn-small">${a.label}</button>`;
    div.querySelector("button").onclick = a.action;
    box.appendChild(div);
  });
}

function renderTable() {
  const tbody = $("recordsTable");
  const data = getFilteredRecords();
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7">Nenhum cadastro encontrado.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  data.forEach(r => {
    const tr = document.createElement("tr");
    const actions = [
      `<button class="btn btn-secondary btn-small" data-action="edit">Editar</button>`
    ];
    if (r.status === "Lead") {
      actions.push(`<button class="btn btn-primary btn-small" data-action="follow">Follow-up</button>`);
      actions.push(`<button class="btn btn-warning btn-small" data-action="client">Virou cliente</button>`);
    }
    if (r.status === "Ativo") {
      actions.push(`<button class="btn btn-primary btn-small" data-action="paid">Pago</button>`);
      actions.push(`<button class="btn btn-warning btn-small" data-action="charge">Cobrar</button>`);
    }
    actions.push(`<button class="btn btn-danger btn-small" data-action="delete">Excluir</button>`);
    tr.innerHTML = `
      <td><strong>${r.name || "-"}</strong><br><small>${r.phone || ""}</small></td>
      <td>${r.plan || "-"}</td>
      <td>${formatMoney(r.value)}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${formatDate(r.firstContactDate)}</td>
      <td>${formatDate(r.dueDate)}</td>
      <td><div class="actions">${actions.join("")}</div></td>
    `;
    tr.querySelector('[data-action="edit"]').onclick = () => fillForm(r);
    tr.querySelector('[data-action="delete"]').onclick = () => deleteRecord(r.id);
    const follow = tr.querySelector('[data-action="follow"]');
    if (follow) follow.onclick = () => openFollowUp(r.id);
    const client = tr.querySelector('[data-action="client"]');
    if (client) client.onclick = () => markAsClient(r.id);
    const charge = tr.querySelector('[data-action="charge"]');
    if (charge) charge.onclick = () => openCharge(r.id);
    const paid = tr.querySelector('[data-action="paid"]');
    if (paid) paid.onclick = () => markAsPaid(r.id);
    tbody.appendChild(tr);
  });
}

function renderMetrics() {
  const active = records.filter(r => r.status === "Ativo");
  const leads = records.filter(r => r.status === "Lead");
  const revenue = active.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  $("activeRevenue").textContent = formatMoney(revenue);
  $("activeCount").textContent = active.length;
  $("leadCount").textContent = leads.length;
}

function render() {
  renderMetrics();
  renderAlerts();
  renderTable();
}

$("clientForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const record = recordFromForm();
  const error = validateRecord(record);
  if (error) return toast(error);
  upsertRecord(record);
});

$("plan").addEventListener("change", () => {
  const plan = $("plan").value;
  if (planValues[plan] && !$("value").value) $("value").value = String(planValues[plan]).replace(".", ",");
});

$("clearFormBtn").onclick = clearForm;
$("exportBackupBtn").onclick = exportBackup;
$("importBackupInput").onchange = (e) => importBackup(e.target.files[0]);
$("restoreAutoBackupBtn").onclick = restoreAutoBackup;
$("searchInput").oninput = renderTable;
$("statusFilter").onchange = renderTable;

window.addEventListener("beforeunload", autoBackup);
autoBackup();
render();
