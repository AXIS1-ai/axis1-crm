const SCHEMA_VERSION = 3;
const STORAGE_KEY = "axis1_crm_v2_insano";
const LEGACY_KEYS = [
  "axis1_crm_v2_insano",
  "axis1_crm_definitivo_v1",
  "axis1_crm_integrado_v1",
  "axis1_crm_records",
  "axis1_crm_clientes",
  "axis1_clientes",
  "crmAxis1",
  "clientesAxis1",
  "axis1-crm",
  "crm"
];
const SNAPSHOT_KEY = "axis1_crm_v2_snapshots";
const TRASH_KEY = "axis1_crm_v2_trash";
const GOAL_KEY = "axis1_crm_v2_goal";
const MAX_SNAPSHOTS = 10;

const planValues = {
  "Essencial": 399.90,
  "Estratégico": 549.90,
  "Autoridade": 969.90,
  "Autoridade + Landing Page": 1119.99,
  "Autoridade + Site": 1219.90
};

const $ = (id) => document.getElementById(id);

function uid(prefix = "axis") {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function todayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  let text = String(value).replace(/[^\d,.-]/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(",", ".");
  }
  return Number(text) || 0;
}

function formatMoney(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const [year, month, day] = String(dateStr).split("-");
  if (!year || !month || !day) return "-";
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
}

function daysBetween(dateStr) {
  if (!dateStr) return Number.NaN;
  const today = new Date(`${todayStr()}T12:00:00`);
  const target = new Date(`${dateStr}T12:00:00`);
  return Math.round((target - today) / 86400000);
}

function addOneMonth(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + 1);
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

function normalizePhone(value) {
  let digits = onlyDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDocument(value) {
  return onlyDigits(value);
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "ativo" || normalized === "cliente" || normalized === "active") return "Ativo";
  if (normalized.includes("paus")) return "Pausado";
  if (normalized.includes("cancel")) return "Cancelado";
  return "Lead";
}

function validateCpf(value) {
  const cpf = normalizeDocument(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calculateDigit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

function validateCnpj(value) {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calculateDigit = (baseLength) => {
    const weights = baseLength === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(cnpj[12]) && calculateDigit(13) === Number(cnpj[13]);
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function formatDoc(value) {
  const digits = normalizeDocument(value);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits;
}

function normalizeRecord(record = {}) {
  const paymentType = record.paymentType || record.tipoPagamento || record.formaPagamento || record.forma_pagamento || "1x";
  const value = parseMoney(record.value ?? record.valor ?? record.valorMensal ?? record.valor_mensal ?? record.investimento ?? 0);
  const history = Array.isArray(record.paymentHistory)
    ? record.paymentHistory
    : (Array.isArray(record.historicoPagamentos) ? record.historicoPagamentos : []);

  return {
    id: String(record.id || uid()),
    name: String(record.name || record.nome || record.cliente || record.razaoSocial || record.razao_social || record.razao || record.empresa || "").trim(),
    documentNumber: normalizeDocument(record.documentNumber || record.cnpj || record.cpf || record.cpfCnpj || record.cpf_cnpj || record.documento || ""),
    phone: normalizePhone(record.phone || record.telefone || record.whatsapp || record.celular || record.contato || ""),
    email: normalizeEmail(record.email || record.e_mail || record.mail || ""),
    plan: String(record.plan || record.plano || record.planoContratado || record.plano_contratado || record.servico || "").trim(),
    value,
    status: normalizeStatus(record.status || record.situacao || record.tipo),
    paymentType: String(paymentType).includes("2") ? "2x" : "1x",
    firstContactDate: record.firstContactDate || record.primeiroContato || record.primeiro_contato || record.dataPrimeiroContato || record.data_primeiro_contato || record.contactDate || "",
    startDate: record.startDate || record.dataInicio || record.data_inicio || record.inicio || "",
    dueDate: record.dueDate || record.vencimento || record.proximoVencimento || record.proximo_vencimento || record.dataVencimento || "",
    dueDate2: record.dueDate2 || record.vencimento2 || record.segundoVencimento || record.segundo_vencimento || "",
    notes: String(record.notes || record.observacoes || record.obs || record.anotacoes || "").trim(),
    lastPaidDate: record.lastPaidDate || record.ultimoPagamento || record.ultimo_pagamento || null,
    paymentHistory: history
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        paidAt: item.paidAt || item.data || item.date || todayStr(),
        amount: parseMoney(item.amount ?? item.valor ?? item.value ?? 0),
        installment: String(item.installment || item.parcela || "Mensal"),
        previousDueDate: item.previousDueDate || item.vencimentoAnterior || "",
        nextDueDate: item.nextDueDate || item.proximoVencimento || ""
      })),
    deletedAt: record.deletedAt || record.excluidoEm || null
  };
}

function migrateArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").map(normalizeRecord);
}

function extractRecords(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.records)) return data.records;
  if (Array.isArray(data.clientes)) return data.clientes;
  if (Array.isArray(data.data)) return data.data;
  if (data.backup && Array.isArray(data.backup.records)) return data.backup.records;
  return null;
}

function findInitialData() {
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const extracted = extractRecords(JSON.parse(raw));
      if (Array.isArray(extracted) && extracted.length) return migrateArray(extracted);
      if (key === STORAGE_KEY && Array.isArray(extracted)) return [];
    } catch {
      // Ignora uma chave antiga corrompida e tenta a próxima.
    }
  }
  return [];
}

function loadTrash() {
  try {
    return migrateArray(JSON.parse(localStorage.getItem(TRASH_KEY) || "[]"));
  } catch {
    return [];
  }
}

function readGoal() {
  return parseMoney(localStorage.getItem(GOAL_KEY) || 0);
}

function normalizeSnapshot(snapshot = {}) {
  const source = snapshot.data && typeof snapshot.data === "object"
    ? snapshot.data
    : (snapshot.state && typeof snapshot.state === "object" ? snapshot.state : snapshot);

  return {
    id: String(snapshot.id || uid("snapshot")),
    createdAt: snapshot.createdAt || snapshot.date || new Date().toISOString(),
    reason: String(snapshot.reason || snapshot.motivo || "Versão anterior"),
    schemaVersion: Number(snapshot.schemaVersion) || SCHEMA_VERSION,
    data: {
      records: migrateArray(source.records || source.clientes || []),
      trash: migrateArray(source.trash || source.lixeira || []),
      monthlyGoal: parseMoney(source.monthlyGoal ?? source.metaMensal ?? 0)
    }
  };
}

function getSnapshots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeSnapshot).slice(0, MAX_SNAPSHOTS) : [];
  } catch {
    return [];
  }
}

function setSnapshots(snapshots) {
  localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify(snapshots.map(normalizeSnapshot).slice(0, MAX_SNAPSHOTS))
  );
}

let records = findInitialData();
let trash = loadTrash();
let monthlyGoal = readGoal();
let pendingImport = null;

function captureState() {
  return cloneData({ records, trash, monthlyGoal });
}

function buildSnapshot(reason, state = captureState()) {
  return normalizeSnapshot({
    id: uid("snapshot"),
    createdAt: new Date().toISOString(),
    reason,
    schemaVersion: SCHEMA_VERSION,
    data: state
  });
}

function pushSnapshot(reason, state = captureState()) {
  const snapshot = buildSnapshot(reason, state);
  setSnapshots([snapshot, ...getSnapshots()]);
  return snapshot;
}

function persistData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
  localStorage.setItem(GOAL_KEY, String(monthlyGoal || 0));
}

function applyImportantChange(reason, mutate) {
  pushSnapshot(reason);
  mutate();
  persistData();
  render();
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("show"), 4200);
}

function recordFromForm() {
  const selectedPlan = $("plan").value;
  let value = parseMoney($("value").value);
  if (!value && planValues[selectedPlan]) value = planValues[selectedPlan];
  const existing = records.find((record) => record.id === $("recordId").value);

  return normalizeRecord({
    id: $("recordId").value || uid(),
    name: $("name").value,
    documentNumber: $("documentNumber").value,
    phone: $("phone").value,
    email: $("email").value,
    plan: selectedPlan,
    value,
    status: $("status").value,
    paymentType: $("paymentType").value,
    firstContactDate: $("firstContactDate").value,
    startDate: $("startDate").value,
    dueDate: $("dueDate").value,
    dueDate2: $("dueDate2").value,
    notes: $("notes").value,
    lastPaidDate: existing?.lastPaidDate || null,
    paymentHistory: existing?.paymentHistory || []
  });
}

function duplicateMatch(record, collection = records, excludeId = "") {
  const checks = [
    { key: "phone", label: "WhatsApp", value: normalizePhone(record.phone) },
    { key: "documentNumber", label: "CPF/CNPJ", value: normalizeDocument(record.documentNumber) },
    { key: "email", label: "e-mail", value: normalizeEmail(record.email) }
  ];

  for (const check of checks) {
    if (!check.value) continue;
    const found = collection.find((item) => (
      item.id !== excludeId && String(item[check.key] || "") === check.value
    ));
    if (found) return { record: found, field: check.label };
  }
  return null;
}

function validateRecord(record) {
  if (!record.name) return "Informe o nome/razão social.";

  if (record.documentNumber) {
    if (record.documentNumber.length === 11 && !validateCpf(record.documentNumber)) {
      return "O CPF informado é inválido. Confira os dígitos.";
    }
    if (record.documentNumber.length === 14 && !validateCnpj(record.documentNumber)) {
      return "O CNPJ informado é inválido. Confira os dígitos.";
    }
    if (![11, 14].includes(record.documentNumber.length)) {
      return "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.";
    }
  }

  if (!record.phone || record.phone.length < 10 || record.phone.length > 11) {
    return "Informe um WhatsApp válido com DDD.";
  }
  if (record.email && !validateEmail(record.email)) {
    return "Informe um e-mail válido.";
  }
  if (!record.plan) return "Selecione um plano.";
  if (record.status === "Lead" && !record.firstContactDate) {
    return "Para lead, informe a data do primeiro contato.";
  }
  if (record.status === "Ativo" && !record.dueDate) {
    return "Para cliente ativo, informe o vencimento mensal ou parcela 1.";
  }
  if (record.status === "Ativo" && record.paymentType === "2x" && !record.dueDate2) {
    return "Para pagamento 2x, informe o vencimento da parcela 2.";
  }

  const duplicate = duplicateMatch(record, records, record.id);
  if (duplicate) {
    return `Já existe um cadastro com o mesmo ${duplicate.field}: ${duplicate.record.name || "sem nome"}.`;
  }
  return "";
}

function upsertRecord(record) {
  const index = records.findIndex((item) => item.id === record.id);
  const reason = index >= 0
    ? `Antes de editar o cadastro de ${record.name}`
    : `Antes de cadastrar ${record.name}`;

  applyImportantChange(reason, () => {
    if (index >= 0) records[index] = record;
    else records.unshift(record);
  });
  clearForm();
  toast("Cadastro salvo com segurança.");
}

function clearForm() {
  $("clientForm").reset();
  $("recordId").value = "";
  $("status").value = "Lead";
  $("paymentType").value = "1x";
  $("dueDate2Wrap").classList.add("hidden");
  $("formTitle").textContent = "Cadastrar lead/cliente";
}

function fillForm(record) {
  setActiveTab("records");
  $("recordId").value = record.id;
  $("name").value = record.name || "";
  $("documentNumber").value = formatDoc(record.documentNumber || "");
  $("phone").value = record.phone || "";
  $("email").value = record.email || "";
  $("plan").value = record.plan || "";
  $("value").value = record.value ? String(record.value).replace(".", ",") : "";
  $("status").value = record.status || "Lead";
  $("paymentType").value = record.paymentType || "1x";
  $("firstContactDate").value = record.firstContactDate || "";
  $("startDate").value = record.startDate || "";
  $("dueDate").value = record.dueDate || "";
  $("dueDate2").value = record.dueDate2 || "";
  $("notes").value = record.notes || "";
  toggleDue2();
  $("formTitle").textContent = "Editar cadastro";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  if (!window.confirm(`Mover "${record.name}" para a lixeira?`)) return;

  applyImportantChange(`Antes de mover ${record.name} para a lixeira`, () => {
    trash.unshift({ ...record, deletedAt: new Date().toISOString() });
    trash = trash.slice(0, 20);
    records = records.filter((item) => item.id !== id);
  });
  toast("Cadastro movido para a lixeira.");
}

function restoreFromTrash(id) {
  const record = trash.find((item) => item.id === id);
  if (!record) return;
  const duplicate = duplicateMatch(record);
  if (duplicate) {
    toast(`Não foi possível restaurar: já existe um cadastro com o mesmo ${duplicate.field}.`);
    return;
  }

  applyImportantChange(`Antes de restaurar ${record.name} da lixeira`, () => {
    records.unshift(normalizeRecord({ ...record, deletedAt: null }));
    trash = trash.filter((item) => item.id !== id);
  });
  toast("Cadastro restaurado.");
}

function clearTrash() {
  if (!trash.length) {
    toast("Lixeira já está vazia.");
    return;
  }
  if (!window.confirm("Esvaziar a lixeira definitivamente? Uma versão anterior será criada antes.")) return;

  applyImportantChange("Antes de esvaziar a lixeira", () => {
    trash = [];
  });
  toast("Lixeira esvaziada.");
}

function markAsClient(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  applyImportantChange(`Antes de converter ${record.name} em cliente`, () => {
    record.status = "Ativo";
    record.startDate = record.startDate || todayStr();
    record.dueDate = record.dueDate || addOneMonth(todayStr());
  });
  toast("Lead convertido em cliente ativo.");
}

function registerPayment(id, installment) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  const amount = record.paymentType === "2x"
    ? (installment === 1
      ? Math.round((record.value * 0.60) * 100) / 100
      : Math.round((record.value * 0.40) * 100) / 100)
    : record.value;
  const previousDueDate = installment === 2 ? record.dueDate2 : record.dueDate;

  applyImportantChange(`Antes de registrar pagamento de ${record.name}`, () => {
    record.lastPaidDate = todayStr();
    record.paymentHistory = record.paymentHistory || [];
    record.paymentHistory.unshift({
      paidAt: todayStr(),
      amount,
      installment: record.paymentType === "2x" ? `${installment}ª parcela` : "Mensal",
      previousDueDate,
      nextDueDate: installment === 2 || record.paymentType === "1x"
        ? addOneMonth(previousDueDate || todayStr())
        : record.dueDate2
    });

    if (record.paymentType === "1x") {
      record.dueDate = addOneMonth(record.dueDate || todayStr());
    } else if (installment === 2) {
      record.dueDate = addOneMonth(record.dueDate || todayStr());
      record.dueDate2 = addOneMonth(record.dueDate2 || todayStr());
    }
  });

  toast(
    record.paymentType === "2x" && installment === 1
      ? "1ª parcela registrada. A 2ª parcela continua pendente."
      : "Pagamento registrado."
  );
}

function whatsappUrl(phone, message) {
  return `https://wa.me/55${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function openCharge(id, installment = 1) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const due = installment === 2 ? record.dueDate2 : record.dueDate;
  const installmentText = record.paymentType === "2x" ? ` da ${installment}ª parcela` : "";
  const difference = daysBetween(due);
  const message = difference < 0
    ? `Olá, tudo bem? Passando para lembrar que o pagamento${installmentText} referente aos serviços da AXIS 1 venceu em ${formatDate(due)}. Pode me confirmar, por gentileza, a previsão de regularização?`
    : `Olá, tudo bem? Passando para lembrar que o pagamento${installmentText} referente aos serviços da AXIS 1 vence em ${formatDate(due)}. Qualquer dúvida estou à disposição.`;
  window.open(whatsappUrl(record.phone, message), "_blank");
}

function openFollowUp(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const day = Math.max(1, daysBetween(record.firstContactDate) * -1);
  const messages = {
    1: `Olá, ${record.name}! Conseguiu dar uma olhada na proposta da AXIS 1? Se fizer sentido, posso te orientar no melhor caminho para começar.`,
    3: `Olá, ${record.name}! Passando só para reforçar: a proposta da AXIS 1 foi pensada para posicionar melhor sua marca e atrair mais clientes com estratégia.`,
    5: `Olá, ${record.name}! Estou organizando a agenda da semana. Se quiser avançar com a proposta, consigo deixar tudo encaminhado para você.`,
    7: `Olá, ${record.name}! Vou encerrar seu atendimento por aqui para não ficar te incomodando. Se quiser retomar depois, é só me chamar.`
  };
  const targetDay = [7, 5, 3, 1].find((value) => day >= value) || 1;
  window.open(whatsappUrl(record.phone, messages[targetDay]), "_blank");
}

function paymentMonthTotal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return records.reduce((sum, record) => sum + (record.paymentHistory || []).reduce((historySum, item) => {
    const date = new Date(`${item.paidAt}T12:00:00`);
    return date.getFullYear() === year && date.getMonth() === month
      ? historySum + (Number(item.amount) || 0)
      : historySum;
  }, 0), 0);
}

function isPaymentRegisteredThisCycle(record, installment) {
  const due = installment === 2 ? record.dueDate2 : record.dueDate;
  if (!due) return false;
  return (record.paymentHistory || []).some((item) => (
    item.previousDueDate === due
    && String(item.installment).includes(record.paymentType === "2x" ? `${installment}` : "Mensal")
  ));
}

function backupPayload() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    records: cloneData(records),
    trash: cloneData(trash),
    monthlyGoal,
    snapshots: cloneData(getSnapshots())
  };
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(backupPayload(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup-crm-axis1-v3-${todayStr()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast("Backup completo exportado.");
}

function parseBackup(data) {
  const extracted = extractRecords(data);
  if (!Array.isArray(extracted)) throw new Error("Formato de backup inválido");
  const objectData = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const backupData = objectData.backup && typeof objectData.backup === "object"
    ? objectData.backup
    : {};
  const metadata = { ...backupData, ...objectData };

  return {
    schemaVersion: Number(metadata.schemaVersion) || 1,
    exportedAt: metadata.exportedAt || null,
    records: migrateArray(extracted),
    trash: migrateArray(Array.isArray(metadata.trash) ? metadata.trash : []),
    monthlyGoal: parseMoney(metadata.monthlyGoal ?? metadata.metaMensal ?? 0),
    snapshots: Array.isArray(metadata.snapshots)
      ? metadata.snapshots.map(normalizeSnapshot).slice(0, MAX_SNAPSHOTS)
      : []
  };
}

function prepareImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      pendingImport = {
        fileName: file.name,
        backup: parseBackup(JSON.parse(reader.result))
      };
      const count = pendingImport.backup.records.length;
      $("importFileInfo").textContent = `${file.name} • ${count} cadastro(s) encontrado(s)`;
      $("importDialog").showModal();
    } catch {
      pendingImport = null;
      toast("Não foi possível importar. O arquivo é inválido ou incompatível.");
    } finally {
      $("importBackupInput").value = "";
    }
  };
  reader.onerror = () => {
    $("importBackupInput").value = "";
    toast("Não foi possível ler o arquivo selecionado.");
  };
  reader.readAsText(file);
}

function mergePaymentHistory(current = [], incoming = []) {
  const merged = [];
  const seen = new Set();
  [...current, ...incoming].forEach((item) => {
    const key = [
      item.paidAt,
      Number(item.amount) || 0,
      item.installment,
      item.previousDueDate,
      item.nextDueDate
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged.sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
}

function mergeMostComplete(current, incoming) {
  const merged = { ...current, id: current.id };
  const textFields = [
    "documentNumber", "phone", "email", "plan",
    "firstContactDate", "startDate", "dueDate", "dueDate2", "notes"
  ];

  textFields.forEach((field) => {
    if (!merged[field]) merged[field] = incoming[field] || "";
  });
  if ((incoming.name || "").length > (merged.name || "").length) merged.name = incoming.name;
  if ((incoming.notes || "").length > (merged.notes || "").length) merged.notes = incoming.notes;
  if (!merged.value) merged.value = incoming.value || 0;
  if (
    merged.paymentType === "1x"
    && incoming.paymentType === "2x"
    && incoming.dueDate2
    && !current.dueDate2
  ) {
    merged.paymentType = "2x";
  }
  if (
    merged.status === "Lead"
    && incoming.status === "Ativo"
    && (incoming.startDate || incoming.dueDate)
    && !current.startDate
    && !current.dueDate
  ) {
    merged.status = "Ativo";
  }
  merged.lastPaidDate = [current.lastPaidDate, incoming.lastPaidDate].filter(Boolean).sort().pop() || null;
  merged.paymentHistory = mergePaymentHistory(current.paymentHistory, incoming.paymentHistory);
  merged.deletedAt = current.deletedAt || incoming.deletedAt || null;
  return normalizeRecord(merged);
}

function isMeaningfulRecord(record) {
  return Boolean(record.name || record.phone || record.documentNumber || record.email);
}

function mergeRecordCollections(currentRecords, importedRecords, stats) {
  const mergedRecords = currentRecords.map((record) => cloneData(record));

  importedRecords.forEach((incoming) => {
    if (!isMeaningfulRecord(incoming)) {
      stats.ignored += 1;
      return;
    }

    const duplicate = duplicateMatch(incoming, mergedRecords);
    if (!duplicate) {
      const idExists = mergedRecords.some((record) => record.id === incoming.id);
      mergedRecords.unshift({ ...incoming, id: idExists ? uid() : incoming.id });
      stats.imported += 1;
      return;
    }

    const index = mergedRecords.findIndex((record) => record.id === duplicate.record.id);
    const combined = mergeMostComplete(mergedRecords[index], incoming);
    if (JSON.stringify(combined) === JSON.stringify(mergedRecords[index])) {
      stats.ignored += 1;
    } else {
      mergedRecords[index] = combined;
      stats.merged += 1;
    }
  });

  return mergedRecords;
}

function mergeTrashCollections(currentTrash, importedTrash) {
  const mergedTrash = currentTrash.map((record) => cloneData(record));
  importedTrash.forEach((incoming) => {
    const duplicate = mergedTrash.find((record) => (
      record.id === incoming.id
      || (incoming.phone && record.phone === incoming.phone)
      || (incoming.documentNumber && record.documentNumber === incoming.documentNumber)
      || (incoming.email && record.email === incoming.email)
    ));
    if (!duplicate) {
      mergedTrash.push(incoming);
      return;
    }
    const index = mergedTrash.findIndex((record) => record.id === duplicate.id);
    mergedTrash[index] = mergeMostComplete(duplicate, incoming);
    mergedTrash[index].deletedAt = duplicate.deletedAt || incoming.deletedAt || new Date().toISOString();
  });
  return mergedTrash.slice(0, 20);
}

function combineSnapshots(...groups) {
  const seen = new Set();
  const combined = [];
  groups.flat().forEach((snapshot) => {
    const normalized = normalizeSnapshot(snapshot);
    const signature = normalized.id || `${normalized.createdAt}|${normalized.reason}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    combined.push(normalized);
  });
  return combined
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, MAX_SNAPSHOTS);
}

function closeImportDialog() {
  if ($("importDialog").open) $("importDialog").close();
  pendingImport = null;
}

function performImport(mode) {
  if (!pendingImport) return;
  const { backup } = pendingImport;
  if (
    mode === "replace"
    && !window.confirm("Substituir todos os dados atuais pelo backup? Uma versão do estado atual será salva antes.")
  ) return;

  const stats = { imported: 0, ignored: 0, merged: 0 };
  const safetySnapshot = pushSnapshot(
    mode === "replace" ? "Antes de substituir os dados por um backup" : "Antes de mesclar um backup"
  );
  const currentSnapshots = getSnapshots();

  if (mode === "replace") {
    records = cloneData(backup.records);
    trash = cloneData(backup.trash);
    monthlyGoal = backup.monthlyGoal;
    stats.imported = records.length;
    setSnapshots(combineSnapshots(safetySnapshot, backup.snapshots));
  } else {
    records = mergeRecordCollections(records, backup.records, stats);
    trash = mergeTrashCollections(trash, backup.trash);
    if (!monthlyGoal && backup.monthlyGoal) monthlyGoal = backup.monthlyGoal;
    setSnapshots(combineSnapshots(currentSnapshots, backup.snapshots));
  }

  persistData();
  loadGoal();
  render();
  closeImportDialog();
  toast(`Importação concluída: ${stats.imported} importado(s), ${stats.ignored} ignorado(s) e ${stats.merged} mesclado(s).`);
}

function restoreSnapshot(id) {
  const target = getSnapshots().find((snapshot) => snapshot.id === id);
  if (!target) {
    toast("Essa versão não está mais disponível.");
    return;
  }
  const date = formatDateTime(target.createdAt);
  if (!window.confirm(`Restaurar a versão de ${date}?\nMotivo: ${target.reason}`)) return;

  pushSnapshot(`Antes de restaurar a versão de ${date}`);
  records = migrateArray(target.data.records);
  trash = migrateArray(target.data.trash);
  monthlyGoal = parseMoney(target.data.monthlyGoal);
  persistData();
  loadGoal();
  render();
  if ($("snapshotsDialog").open) $("snapshotsDialog").close();
  toast("Versão anterior restaurada com sucesso.");
}

function loadGoal() {
  $("monthlyGoal").value = monthlyGoal ? String(monthlyGoal).replace(".", ",") : "";
}

function saveGoal() {
  const nextGoal = parseMoney($("monthlyGoal").value);
  if (nextGoal === monthlyGoal) {
    toast("A meta mensal já está atualizada.");
    return;
  }
  applyImportantChange("Antes de alterar a meta mensal", () => {
    monthlyGoal = nextGoal;
  });
  loadGoal();
  toast("Meta mensal salva.");
}

function toggleDue2() {
  $("dueDate2Wrap").classList.toggle("hidden", $("paymentType").value !== "2x");
}

function setActiveTab(tabName) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
  });
}

function getFilteredRecords() {
  const query = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  return records.filter((record) => {
    const matchesStatus = status === "Todos" || record.status === status;
    const text = [
      record.name,
      record.documentNumber,
      record.plan,
      record.phone,
      record.email,
      record.notes
    ].join(" ").toLowerCase();
    return matchesStatus && text.includes(query);
  });
}

function buildAlerts() {
  const alerts = [];
  records.forEach((record) => {
    if (record.status === "Ativo") {
      const dues = record.paymentType === "2x"
        ? [{ number: 1, date: record.dueDate }, { number: 2, date: record.dueDate2 }]
        : [{ number: 1, date: record.dueDate }];

      dues.forEach((due) => {
        if (!due.date || isPaymentRegisteredThisCycle(record, due.number)) return;
        const difference = daysBetween(due.date);
        const label = record.paymentType === "2x" ? `${due.number}ª parcela` : "mensalidade";
        if (difference < 0) {
          alerts.push({
            urgent: true,
            type: "Cobrança vencida",
            text: `${record.name} — ${label} venceu em ${formatDate(due.date)}`,
            action: () => openCharge(record.id, due.number),
            label: "Cobrar"
          });
        } else if (difference === 0) {
          alerts.push({
            urgent: true,
            type: "Vence hoje",
            text: `${record.name} — ${label} vence hoje`,
            action: () => openCharge(record.id, due.number),
            label: "Cobrar"
          });
        } else if (difference >= 1 && difference <= 3) {
          alerts.push({
            urgent: false,
            type: `Vence em ${difference} dia(s)`,
            text: `${record.name} — ${label} vence em ${formatDate(due.date)}`,
            action: () => openCharge(record.id, due.number),
            label: "Cobrar"
          });
        }
      });
    }

    if (record.status === "Lead" && record.firstContactDate) {
      const day = daysBetween(record.firstContactDate) * -1;
      if ([1, 3, 5, 7].includes(day)) {
        alerts.push({
          urgent: false,
          type: `Follow-up dia ${day}`,
          text: `${record.name} precisa de follow-up`,
          action: () => openFollowUp(record.id),
          label: "Follow-up"
        });
      }
    }
  });
  return alerts;
}

function renderAlerts() {
  const container = $("alertsList");
  const alerts = buildAlerts();
  if (!alerts.length) {
    container.innerHTML = '<div class="alert-item"><span>Nenhum alerta pendente agora.</span></div>';
    return;
  }

  container.innerHTML = "";
  alerts.forEach((alert) => {
    const element = document.createElement("div");
    element.className = `alert-item ${alert.urgent ? "urgent" : ""}`;
    element.innerHTML = `
      <div>
        <strong>${escapeHtml(alert.type)}</strong><br>
        <span>${escapeHtml(alert.text)}</span>
      </div>
      <button class="btn btn-primary btn-small" type="button">${escapeHtml(alert.label)}</button>
    `;
    element.querySelector("button").onclick = alert.action;
    container.appendChild(element);
  });
}

function renderMetrics() {
  const active = records.filter((record) => record.status === "Ativo");
  const leads = records.filter((record) => record.status === "Lead");
  const activeRevenue = active.reduce((sum, record) => sum + (Number(record.value) || 0), 0);
  const received = paymentMonthTotal();
  const overdue = records.filter((record) => (
    record.status === "Ativo"
    && (
      (record.dueDate && daysBetween(record.dueDate) < 0 && !isPaymentRegisteredThisCycle(record, 1))
      || (
        record.paymentType === "2x"
        && record.dueDate2
        && daysBetween(record.dueDate2) < 0
        && !isPaymentRegisteredThisCycle(record, 2)
      )
    )
  )).length;

  $("receivedMonth").textContent = formatMoney(received);
  $("remainingGoal").textContent = formatMoney(Math.max(monthlyGoal - received, 0));
  $("activeRevenue").textContent = formatMoney(activeRevenue);
  $("activeCount").textContent = active.length;
  $("leadCount").textContent = leads.length;
  $("overdueCount").textContent = overdue;
}

function renderTable() {
  const body = $("recordsTable");
  const data = getFilteredRecords();
  if (!data.length) {
    body.innerHTML = '<tr><td colspan="9">Nenhum cadastro encontrado.</td></tr>';
    return;
  }

  body.innerHTML = "";
  data.forEach((record) => {
    const overdue = record.status === "Ativo" && (
      (record.dueDate && daysBetween(record.dueDate) < 0 && !isPaymentRegisteredThisCycle(record, 1))
      || (
        record.paymentType === "2x"
        && record.dueDate2
        && daysBetween(record.dueDate2) < 0
        && !isPaymentRegisteredThisCycle(record, 2)
      )
    );
    const row = document.createElement("tr");
    if (overdue) row.classList.add("row-overdue");
    const paymentText = record.paymentType === "2x"
      ? `2x (${formatMoney(Math.round((record.value * 0.60) * 100) / 100)} + ${formatMoney(Math.round((record.value * 0.40) * 100) / 100)})`
      : "Mensal / 1x";
    const dueText = record.paymentType === "2x"
      ? `1ª: ${formatDate(record.dueDate)}<br>2ª: ${formatDate(record.dueDate2)}`
      : formatDate(record.dueDate);
    const actions = [
      '<button class="btn btn-secondary btn-small" type="button" data-action="edit">Editar</button>',
      '<button class="btn btn-secondary btn-small" type="button" data-action="history">Histórico</button>'
    ];

    if (record.status === "Lead") {
      actions.push(
        '<button class="btn btn-primary btn-small" type="button" data-action="follow">Follow-up</button>',
        '<button class="btn btn-warning btn-small" type="button" data-action="client">Virou cliente</button>'
      );
    }
    if (record.status === "Ativo") {
      if (record.paymentType === "2x") {
        actions.push(
          '<button class="btn btn-primary btn-small" type="button" data-action="paid1">Pago 1</button>',
          '<button class="btn btn-primary btn-small" type="button" data-action="paid2">Pago 2</button>',
          '<button class="btn btn-warning btn-small" type="button" data-action="charge1">Cobrar 1</button>',
          '<button class="btn btn-warning btn-small" type="button" data-action="charge2">Cobrar 2</button>'
        );
      } else {
        actions.push(
          '<button class="btn btn-primary btn-small" type="button" data-action="paid">Pago</button>',
          '<button class="btn btn-warning btn-small" type="button" data-action="charge">Cobrar</button>'
        );
      }
    }
    actions.push('<button class="btn btn-danger btn-small" type="button" data-action="delete">Excluir</button>');

    row.innerHTML = `
      <td>
        <strong>${escapeHtml(record.name || "-")}</strong><br>
        <span class="muted">${escapeHtml(record.phone || "")}${record.email ? ` • ${escapeHtml(record.email)}` : ""}</span>
      </td>
      <td>${record.documentNumber ? escapeHtml(formatDoc(record.documentNumber)) : "-"}</td>
      <td>${escapeHtml(record.plan || "-")}</td>
      <td>${escapeHtml(formatMoney(record.value))}</td>
      <td>
        <span class="badge ${escapeHtml(record.status)}">${escapeHtml(record.status)}</span>
        ${overdue ? '<br><span class="badge overdue">atrasado</span>' : ""}
      </td>
      <td>${escapeHtml(paymentText)}</td>
      <td>${dueText}</td>
      <td>${escapeHtml(formatDate(record.lastPaidDate))}</td>
      <td><div class="actions">${actions.join("")}</div></td>
    `;

    row.querySelector('[data-action="edit"]').onclick = () => fillForm(record);
    row.querySelector('[data-action="history"]').onclick = () => showHistory(record.id);
    row.querySelector('[data-action="delete"]').onclick = () => deleteRecord(record.id);
    const actionMap = {
      follow: () => openFollowUp(record.id),
      client: () => markAsClient(record.id),
      paid: () => registerPayment(record.id, 1),
      paid1: () => registerPayment(record.id, 1),
      paid2: () => registerPayment(record.id, 2),
      charge: () => openCharge(record.id, 1),
      charge1: () => openCharge(record.id, 1),
      charge2: () => openCharge(record.id, 2)
    };
    Object.entries(actionMap).forEach(([action, handler]) => {
      const button = row.querySelector(`[data-action="${action}"]`);
      if (button) button.onclick = handler;
    });
    body.appendChild(row);
  });
}

function showHistory(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const content = $("historyContent");
  const history = record.paymentHistory || [];
  if (!history.length) {
    content.innerHTML = `<p class="muted">Nenhum pagamento registrado para ${escapeHtml(record.name)}.</p>`;
  } else {
    content.innerHTML = history.map((item) => `
      <div class="history-row">
        <div>
          <strong>${escapeHtml(item.installment)}</strong><br>
          <span class="muted">Pago em ${escapeHtml(formatDate(item.paidAt))} | Vencimento: ${escapeHtml(formatDate(item.previousDueDate))}</span>
        </div>
        <strong>${escapeHtml(formatMoney(item.amount))}</strong>
      </div>
    `).join("");
  }
  $("historyDialog").showModal();
}

function renderTrash() {
  const container = $("trashList");
  if (!trash.length) {
    container.innerHTML = '<div class="trash-item"><span>Lixeira vazia.</span></div>';
    return;
  }

  container.innerHTML = "";
  trash.forEach((record) => {
    const element = document.createElement("div");
    element.className = "trash-item";
    element.innerHTML = `
      <div>
        <strong>${escapeHtml(record.name || "-")}</strong><br>
        <span>${escapeHtml(record.plan || "-")} • excluído em ${escapeHtml(formatDateTime(record.deletedAt || Date.now()))}</span>
      </div>
      <button class="btn btn-warning btn-small" type="button">Restaurar</button>
    `;
    element.querySelector("button").onclick = () => restoreFromTrash(record.id);
    container.appendChild(element);
  });
}

function renderSnapshotSummary() {
  const snapshots = getSnapshots();
  $("snapshotSummary").textContent = snapshots.length
    ? `${snapshots.length} versão(ões) disponível(is)`
    : "Nenhuma versão anterior";
}

function renderSnapshots() {
  const container = $("snapshotsList");
  const snapshots = getSnapshots();
  if (!snapshots.length) {
    container.innerHTML = '<div class="snapshot-item"><span>Nenhuma versão anterior encontrada.</span></div>';
    return;
  }

  container.innerHTML = snapshots.map((snapshot) => `
    <div class="snapshot-item">
      <div>
        <strong>${escapeHtml(formatDateTime(snapshot.createdAt))}</strong>
        <span>${escapeHtml(snapshot.reason)}</span>
        <small>${snapshot.data.records.length} cadastro(s) • ${snapshot.data.trash.length} item(ns) na lixeira</small>
      </div>
      <button class="btn btn-warning btn-small" type="button" data-snapshot-id="${escapeHtml(snapshot.id)}">Restaurar</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-snapshot-id]").forEach((button) => {
    button.onclick = () => restoreSnapshot(button.dataset.snapshotId);
  });
}

function openSnapshotsDialog() {
  renderSnapshots();
  $("snapshotsDialog").showModal();
}

function render() {
  renderMetrics();
  renderAlerts();
  renderTable();
  renderTrash();
  renderSnapshotSummary();
}

$("clientForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const record = recordFromForm();
  const error = validateRecord(record);
  if (error) {
    toast(error);
    return;
  }
  upsertRecord(record);
});

$("plan").addEventListener("change", () => {
  const plan = $("plan").value;
  if (planValues[plan] && !$("value").value) {
    $("value").value = String(planValues[plan]).replace(".", ",");
  }
});
$("paymentType").addEventListener("change", toggleDue2);
$("documentNumber").addEventListener("blur", () => {
  $("documentNumber").value = formatDoc($("documentNumber").value);
});
$("phone").addEventListener("blur", () => {
  $("phone").value = normalizePhone($("phone").value);
});
$("email").addEventListener("blur", () => {
  $("email").value = normalizeEmail($("email").value);
});
$("clearFormBtn").onclick = clearForm;
$("exportBackupBtn").onclick = exportBackup;
$("importBackupInput").onchange = (event) => prepareImport(event.target.files[0]);
$("restoreSnapshotBtn").onclick = openSnapshotsDialog;
$("saveGoalBtn").onclick = saveGoal;
$("searchInput").oninput = renderTable;
$("statusFilter").onchange = renderTable;
$("closeHistoryBtn").onclick = () => $("historyDialog").close();
$("closeSnapshotsBtn").onclick = () => $("snapshotsDialog").close();
$("closeImportBtn").onclick = closeImportDialog;
$("replaceImportBtn").onclick = () => performImport("replace");
$("mergeImportBtn").onclick = () => performImport("merge");
$("clearTrashBtn").onclick = clearTrash;
document.querySelectorAll("[data-tab]").forEach((button) => {
  button.onclick = () => setActiveTab(button.dataset.tab);
});

function importLeadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawLead = params.get("importLead");
  if (!rawLead) return;

  try {
    let parsed;
    try {
      parsed = JSON.parse(rawLead);
    } catch {
      parsed = JSON.parse(decodeURIComponent(rawLead));
    }
    const lead = normalizeRecord({
      ...parsed,
      status: "Lead",
      paymentType: "1x",
      value: parsed.value || 0,
      notes: parsed.notes || "Origem: Proposta AXIS 1"
    });

    if (!lead.name || lead.phone.length < 10 || lead.phone.length > 11) {
      throw new Error("Lead sem nome ou telefone válido");
    }
    if (lead.email && !validateEmail(lead.email)) throw new Error("E-mail inválido");
    if (lead.documentNumber) {
      const validDocument = (
        (lead.documentNumber.length === 11 && validateCpf(lead.documentNumber))
        || (lead.documentNumber.length === 14 && validateCnpj(lead.documentNumber))
      );
      if (!validDocument) throw new Error("Documento inválido");
    }

    const duplicate = duplicateMatch(lead);
    if (duplicate) {
      window.alert(`Esse lead já existe no CRM pelo mesmo ${duplicate.field}.`);
      return;
    }

    applyImportantChange(`Antes de importar o lead ${lead.name} pela URL`, () => {
      records.unshift(lead);
    });
    window.history.replaceState({}, document.title, window.location.pathname);
    setActiveTab("records");
    window.alert("Lead importado automaticamente no CRM.");
  } catch (error) {
    console.error(error);
    window.alert("Erro ao importar lead. Confira os dados recebidos.");
  }
}

persistData();
loadGoal();
toggleDue2();
render();
importLeadFromUrl();
