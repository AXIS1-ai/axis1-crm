const SCHEMA_VERSION = 5;
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
const RECEIPT_COUNTER_KEY = "axis1_crm_v3_receipt_counters";
const FINANCIAL_REPORTS_KEY = "axis1_crm_v3_financial_reports";
const PERSISTENCE_JOURNAL_KEY = "axis1_crm_v5_persistence_journal";
const PERSISTENCE_KEYS = [
  STORAGE_KEY,
  TRASH_KEY,
  GOAL_KEY,
  RECEIPT_COUNTER_KEY,
  FINANCIAL_REPORTS_KEY,
  SNAPSHOT_KEY
];
const MAX_SNAPSHOTS = 10;
const AXIS_WHATSAPP = "(16) 99742-4912";
const RECEIPT_MESSAGE = "MENSAGEM AUTOMÁTICA GERADA PELO SISTEMA INTELIGENTE AXIS1 - Olá, tudo bem? Segue o recibo referente ao pagamento do serviço contratado com a AXIS 1. Qualquer dúvida, ficamos à disposição.";
const RECEIPT_LEGAL_TEXT = "Declaramos para os devidos fins que recebemos o valor acima referente aos serviços descritos neste recibo.";
const COLLECTION_MESSAGES = {
  upcoming: "Olá, tudo bem? Passando para lembrar que o pagamento referente ao serviço contratado com a AXIS 1 vence em breve. Qualquer dúvida, ficamos à disposição.",
  overdue: "Olá, tudo bem? Identificamos que o pagamento referente ao serviço contratado com a AXIS 1 ainda está em aberto. Pode nos confirmar, por favor, a previsão de regularização?",
  partial: "Olá, tudo bem? Identificamos o recebimento parcial do pagamento referente ao serviço contratado com a AXIS 1. O saldo restante permanece em aberto. Qualquer dúvida, ficamos à disposição."
};

const COMMERCIAL_STAGES = [
  "Novo lead",
  "Em contato",
  "Diagnóstico feito",
  "Proposta enviada",
  "Aguardando resposta",
  "Fechado",
  "Perdido"
];

const FOLLOW_UP_MESSAGES = {
  "Novo lead": "Olá, tudo bem? Vi seu interesse e queria entender melhor o momento da sua empresa para te orientar da forma mais estratégica.",
  "Em contato": "Olá, tudo bem? Estou retomando nosso contato para avançarmos no diagnóstico e entender como a AXIS 1 pode apoiar sua empresa.",
  "Diagnóstico feito": "Olá, tudo bem? Com base no nosso diagnóstico, organizei um caminho estratégico para sua empresa. Posso te apresentar os próximos passos?",
  "Proposta enviada": "Olá, tudo bem? Passando para saber se conseguiu avaliar a proposta e se ficou alguma dúvida sobre os próximos passos.",
  "Aguardando resposta": "Oi, tudo bem? Estou retomando nosso contato para saber se ainda faz sentido avançarmos com a estratégia para sua empresa.",
  "Fechado": "Olá, tudo bem? Está tudo encaminhado para iniciarmos sua estratégia com a AXIS 1. Se precisar de qualquer orientação, estou à disposição.",
  "Perdido": "Olá, tudo bem? Caso o momento da sua empresa tenha mudado, podemos retomar a conversa e avaliar um novo caminho estratégico."
};

const HOT_FOLLOW_UP_MESSAGE = "Olá, tudo bem? Pelo que conversamos, acredito que já temos um bom caminho para iniciar sua estratégia. Posso te explicar o próximo passo?";

const planValues = {
  "Essencial": 399.90,
  "Estratégico": 549.90,
  "Autoridade": 969.90,
  "Autoridade + Landing Page": 1119.99,
  "Autoridade + Site": 1219.90
};

const $ = (id) => document.getElementById(id);
let persistenceWarning = "";
let storageLoadError = false;

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    persistenceWarning = `Não foi possível ler os dados locais (${key}). O CRM não sobrescreveu o conteúdo em memória. Detalhe: ${error.message || "erro de armazenamento"}`;
    throw error;
  }
}

function safeStorageSet(key, value) {
  const serialized = String(value);
  localStorage.setItem(key, serialized);
  if (localStorage.getItem(key) !== serialized) {
    throw new Error(`A conferência da gravação falhou para ${key}.`);
  }
}

function safeStorageRemove(key) {
  localStorage.removeItem(key);
  if (localStorage.getItem(key) !== null) {
    throw new Error(`Não foi possível concluir a limpeza de ${key}.`);
  }
}

function recoverPersistenceJournal() {
  let raw;
  try {
    raw = localStorage.getItem(PERSISTENCE_JOURNAL_KEY);
  } catch (error) {
    persistenceWarning = `Não foi possível verificar a recuperação local. Nenhuma alteração nova será salva. Detalhe: ${error.message || "erro de armazenamento"}`;
    return false;
  }
  if (!raw) return true;

  try {
    const journal = JSON.parse(raw);
    if (!journal || journal.schemaVersion !== SCHEMA_VERSION || !journal.previous || typeof journal.previous !== "object") {
      throw new Error("diário de recuperação inválido");
    }
    PERSISTENCE_KEYS.forEach((key) => {
      const previous = journal.previous[key];
      if (previous === null || typeof previous === "string") {
        localStorage.setItem(key, previous === null ? "" : previous);
        if (localStorage.getItem(key) !== (previous === null ? "" : previous)) {
          throw new Error(`não foi possível recuperar ${key}`);
        }
        if (previous === null) {
          localStorage.removeItem(key);
          if (localStorage.getItem(key) !== null) throw new Error(`não foi possível limpar ${key}`);
        }
      }
    });
    localStorage.removeItem(PERSISTENCE_JOURNAL_KEY);
    if (localStorage.getItem(PERSISTENCE_JOURNAL_KEY) !== null) throw new Error("não foi possível limpar o diário");
    persistenceWarning = "Uma gravação interrompida foi revertida para a última versão íntegra.";
    return true;
  } catch (error) {
    persistenceWarning = `A recuperação automática não foi concluída. Não faça novas alterações; exporte ou preserve os dados locais antes de tentar novamente. Detalhe: ${error.message || "diário inválido"}`;
    return false;
  }
}

const persistenceReady = recoverPersistenceJournal();

function uid(prefix = "axis") {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
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

function monthYear(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${months[date.getMonth()]}/${date.getFullYear()}`;
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

function normalizeTemperature(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "frio") return "Frio";
  if (normalized === "quente") return "Quente";
  return "Morno";
}

function normalizeCommercialStage(value, status = "Lead") {
  const found = COMMERCIAL_STAGES.find((stage) => stage.toLowerCase() === String(value || "").trim().toLowerCase());
  if (found) return found;
  return status === "Lead" ? "Novo lead" : "Fechado";
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

function normalizeTimelineItem(item = {}, prefix = "event", fallbackDescription = "") {
  const createdAt = item.createdAt || item.date || item.data || new Date().toISOString();
  const type = String(item.type || item.action || item.acao || "Registro");
  const description = String(item.description || item.descricao || fallbackDescription || type);
  return {
    id: String(item.id || `${prefix}-${stableHash(`${createdAt}|${type}|${description}`)}`),
    createdAt,
    type,
    description,
    value: parseMoney(item.value ?? item.valor ?? 0),
    actor: String(item.actor || item.usuario || "Sistema"),
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {}
  };
}

function normalizeReceiptData(data = {}) {
  if (!data || typeof data !== "object") return null;
  return {
    receiptNumber: String(data.receiptNumber || data.number || ""),
    generatedAt: data.generatedAt || data.createdAt || "",
    clientName: String(data.clientName || ""),
    company: String(data.company || ""),
    documentNumber: normalizeDocument(data.documentNumber || ""),
    service: String(data.service || ""),
    amount: parseMoney(data.amount || 0),
    paymentMethod: String(data.paymentMethod || "Não informado"),
    paymentDate: data.paymentDate || "",
    referencePeriod: String(data.referencePeriod || ""),
    notes: String(data.notes || ""),
    axisWhatsapp: String(data.axisWhatsapp || AXIS_WHATSAPP),
    legalText: String(data.legalText || RECEIPT_LEGAL_TEXT)
  };
}

function normalizePaymentItem(item = {}, recordId = "", index = 0) {
  const paidAt = item.paidAt || item.data || item.date || todayStr();
  const amount = parseMoney(item.amount ?? item.valor ?? item.value ?? 0);
  const installment = String(item.installment || item.parcela || "Mensal");
  const previousDueDate = item.previousDueDate || item.vencimentoAnterior || "";
  const nextDueDate = item.nextDueDate || item.proximoVencimento || "";
  const signature = `${recordId}|${paidAt}|${amount}|${installment}|${previousDueDate}|${index}`;
  const receiptData = normalizeReceiptData(item.receiptData || item.dadosRecibo);
  const expectedAmount = parseMoney(item.expectedAmount ?? item.valorEsperado ?? amount);
  const balanceRemaining = Math.max(parseMoney(item.balanceRemaining ?? item.saldoRestante ?? 0), 0);
  return {
    id: String(item.id || item.paymentId || `payment-${stableHash(signature)}`),
    paidAt,
    amount,
    installment,
    previousDueDate,
    nextDueDate,
    paymentMethod: String(item.paymentMethod || item.formaPagamentoRecebida || item.metodo || "Não informado"),
    referencePeriod: String(item.referencePeriod || item.periodoReferencia || monthYear(previousDueDate || paidAt)),
    notes: String(item.notes || item.observacoes || ""),
    expectedAmount,
    cycleId: String(item.cycleId || `cycle-${stableHash(`${recordId}|${previousDueDate || paidAt}|${installment}`)}`),
    isPartial: Boolean(item.isPartial ?? item.pagamentoParcial ?? balanceRemaining > 0),
    balanceRemaining,
    balanceDueDate: item.balanceDueDate || item.vencimentoSaldo || "",
    paymentStatus: String(item.paymentStatus || (balanceRemaining > 0 ? "Parcial" : "Quitado")),
    receiptNumber: String(item.receiptNumber || item.numeroRecibo || receiptData?.receiptNumber || ""),
    receiptGeneratedAt: item.receiptGeneratedAt || item.dataGeracaoRecibo || receiptData?.generatedAt || "",
    receiptData
  };
}

function normalizeOpenBalance(item = {}, recordId = "", index = 0) {
  const installment = Number(item.installment || item.parcela || 1);
  const dueDate = item.dueDate || item.vencimento || "";
  const expectedAmount = parseMoney(item.expectedAmount ?? item.valorEsperado ?? 0);
  const paidAmount = parseMoney(item.paidAmount ?? item.valorPago ?? 0);
  const remainingAmount = Math.max(
    parseMoney(item.remainingAmount ?? item.saldoRestante ?? expectedAmount - paidAmount),
    0
  );
  return {
    id: String(item.id || `balance-${stableHash(`${recordId}|${installment}|${dueDate}|${index}`)}`),
    cycleId: String(item.cycleId || `cycle-${stableHash(`${recordId}|${dueDate}|${installment}`)}`),
    installment,
    label: String(item.label || (installment === 2 ? "2ª parcela" : "Mensal")),
    dueDate,
    referencePeriod: String(item.referencePeriod || monthYear(dueDate)),
    expectedAmount,
    paidAmount,
    remainingAmount,
    balanceDueDate: item.balanceDueDate || item.vencimentoSaldo || dueDate,
    updatedAt: item.updatedAt || ""
  };
}

function normalizeReceipt(item = {}) {
  const data = normalizeReceiptData(item.data || item.receiptData || item);
  const receiptNumber = String(item.receiptNumber || item.number || data?.receiptNumber || "");
  return {
    id: String(item.id || `receipt-${stableHash(receiptNumber || `${item.paymentId}|${item.generatedAt}`)}`),
    receiptNumber,
    paymentId: String(item.paymentId || ""),
    generatedAt: item.generatedAt || data?.generatedAt || "",
    data
  };
}

function uniqueTimeline(items = [], prefix) {
  const seen = new Set();
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeTimelineItem(item, prefix))
    .filter((item) => {
      const signature = item.id || `${item.createdAt}|${item.type}|${item.description}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function uniqueReceipts(items = []) {
  const byNumber = new Map();
  items.filter(Boolean).map(normalizeReceipt).forEach((receipt) => {
    const key = receipt.receiptNumber || receipt.id;
    if (!byNumber.has(key)) byNumber.set(key, receipt);
  });
  return [...byNumber.values()];
}

function normalizeRecord(record = {}) {
  const recordId = String(record.id || uid());
  const status = normalizeStatus(record.status || record.situacao || record.tipo);
  const paymentType = record.paymentType || record.tipoPagamento || record.formaPagamento || record.forma_pagamento || "1x";
  const value = parseMoney(record.value ?? record.valor ?? record.valorMensal ?? record.valor_mensal ?? record.investimento ?? 0);
  const rawFirstPercent = Number(record.installment1Percent ?? record.percentualParcela1 ?? 60);
  const rawSecondPercent = Number(record.installment2Percent ?? record.percentualParcela2 ?? 40);
  const splitIsValid = Number.isInteger(rawFirstPercent)
    && Number.isInteger(rawSecondPercent)
    && rawFirstPercent > 0
    && rawSecondPercent > 0
    && rawFirstPercent + rawSecondPercent === 100;
  const history = Array.isArray(record.paymentHistory)
    ? record.paymentHistory
    : (Array.isArray(record.historicoPagamentos) ? record.historicoPagamentos : []);
  const paymentHistory = history
    .filter((item) => item && typeof item === "object")
    .map((item, index) => normalizePaymentItem(item, recordId, index));
  const commercialHistory = uniqueTimeline(
    record.commercialHistory || record.historicoComercial || [],
    "commercial"
  );
  const financialHistory = uniqueTimeline(
    record.financialHistory || record.historicoFinanceiro || [],
    "financial"
  );
  const derivedReceipts = paymentHistory
    .filter((item) => item.receiptNumber)
    .map((item) => ({
      receiptNumber: item.receiptNumber,
      paymentId: item.id,
      generatedAt: item.receiptGeneratedAt,
      data: item.receiptData
    }));
  const openBalances = (record.openBalances || record.saldosAbertos || [])
    .filter((item) => item && typeof item === "object")
    .map((item, index) => normalizeOpenBalance(item, recordId, index))
    .filter((item) => item.remainingAmount > 0);

  return {
    id: recordId,
    name: String(record.name || record.nome || record.cliente || record.contatoNome || record.razaoSocial || record.razao_social || record.empresa || "").trim(),
    company: String(record.company || record.empresa || record.nomeEmpresa || "").trim(),
    documentNumber: normalizeDocument(record.documentNumber || record.cnpj || record.cpf || record.cpfCnpj || record.cpf_cnpj || record.documento || ""),
    phone: normalizePhone(record.phone || record.telefone || record.whatsapp || record.celular || record.contato || ""),
    email: normalizeEmail(record.email || record.e_mail || record.mail || ""),
    plan: String(record.plan || record.plano || record.planoContratado || record.plano_contratado || record.servico || "").trim(),
    value,
    status,
    paymentType: String(paymentType).includes("2") ? "2x" : "1x",
    installment1Percent: splitIsValid ? rawFirstPercent : 60,
    installment2Percent: splitIsValid ? rawSecondPercent : 40,
    firstContactDate: record.firstContactDate || record.primeiroContato || record.primeiro_contato || record.dataPrimeiroContato || record.data_primeiro_contato || record.contactDate || "",
    startDate: record.startDate || record.dataInicio || record.data_inicio || record.inicio || "",
    dueDate: record.dueDate || record.vencimento || record.proximoVencimento || record.proximo_vencimento || record.dataVencimento || "",
    dueDate2: record.dueDate2 || record.vencimento2 || record.segundoVencimento || record.segundo_vencimento || "",
    notes: String(record.notes || record.observacoes || record.obs || record.anotacoes || "").trim(),
    leadSource: String(record.leadSource || record.origemLead || record.origem || "").trim(),
    leadTemperature: normalizeTemperature(record.leadTemperature || record.temperaturaLead || record.temperatura),
    commercialStage: normalizeCommercialStage(record.commercialStage || record.etapaComercial || record.etapa, status),
    nextAction: String(record.nextAction || record.proximaAcao || "").trim(),
    nextContactDate: record.nextContactDate || record.dataProximoContato || "",
    lossReason: String(record.lossReason || record.motivoPerda || "").trim(),
    commercialHistory,
    lastPaidDate: record.lastPaidDate || record.ultimoPagamento || record.ultimo_pagamento || null,
    paymentHistory,
    openBalances,
    partialPayments: paymentHistory.filter((item) => item.isPartial),
    receipts: uniqueReceipts([...(record.receipts || record.recibos || []), ...derivedReceipts]),
    financialHistory,
    financialStatus: String(record.financialStatus || record.statusFinanceiro || ""),
    canceledAt: record.canceledAt || record.canceladoEm || null,
    deletedAt: record.deletedAt || record.excluidoEm || null
  };
}

function migrateArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").map(normalizeRecord);
}

function expectedInstallmentAmount(record, installment = 1) {
  const total = Number(record.value) || 0;
  if (record.paymentType !== "2x") return total;
  const firstPercent = Number(record.installment1Percent) || 60;
  const totalCents = Math.round(total * 100);
  const firstCents = Math.round(totalCents * firstPercent / 100);
  return (installment === 1 ? firstCents : totalCents - firstCents) / 100;
}

function paymentMatchesInstallment(payment, record, installment) {
  if (record.paymentType !== "2x") return String(payment.installment).includes("Mensal");
  return String(payment.installment).includes(String(installment));
}

function currentDueEntries(record) {
  if (record.status !== "Ativo") return [];
  if (record.paymentType === "2x") {
    return [
      { installment: 1, label: "1ª parcela", dueDate: record.dueDate },
      { installment: 2, label: "2ª parcela", dueDate: record.dueDate2 }
    ];
  }
  return [{ installment: 1, label: "Mensal", dueDate: record.dueDate }];
}

function getRecordReceivables(record) {
  return currentDueEntries(record)
    .filter((entry) => entry.dueDate)
    .map((entry) => {
      const openBalance = (record.openBalances || []).find((balance) => (
        balance.installment === entry.installment
        && (balance.dueDate === entry.dueDate || balance.cycleId === `cycle-${stableHash(`${record.id}|${entry.dueDate}|${entry.installment}`)}`)
      ));
      const payments = (record.paymentHistory || []).filter((payment) => (
        payment.previousDueDate === entry.dueDate
        && paymentMatchesInstallment(payment, record, entry.installment)
      ));
      // A obrigação já aberta conserva o valor definido quando o saldo foi criado,
      // mesmo que o percentual padrão do cliente seja alterado depois.
      const expectedAmount = openBalance?.expectedAmount
        ?? expectedInstallmentAmount(record, entry.installment);
      const paidAmount = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      const remainingAmount = openBalance
        ? openBalance.remainingAmount
        : Math.max(expectedAmount - paidAmount, 0);
      const dueDate = openBalance?.balanceDueDate || entry.dueDate;
      return {
        id: openBalance?.id || `receivable-${stableHash(`${record.id}|${entry.dueDate}|${entry.installment}`)}`,
        cycleId: openBalance?.cycleId || `cycle-${stableHash(`${record.id}|${entry.dueDate}|${entry.installment}`)}`,
        recordId: record.id,
        installment: entry.installment,
        label: entry.label,
        originalDueDate: entry.dueDate,
        dueDate,
        referencePeriod: openBalance?.referencePeriod || monthYear(entry.dueDate),
        expectedAmount,
        paidAmount,
        remainingAmount,
        isPartial: remainingAmount > 0 && paidAmount > 0
      };
    })
    .filter((receivable) => receivable.remainingAmount > 0);
}

function getFinancialStatus(record) {
  if (record.status === "Cancelado") return "Cancelado";
  if (record.status !== "Ativo") return "Em dia";
  const receivables = getRecordReceivables(record);
  if (!currentDueEntries(record).some((entry) => entry.dueDate)) return "Pendente";
  if (receivables.some((item) => item.isPartial)) return "Parcialmente pago";
  if (receivables.some((item) => daysBetween(item.dueDate) < 0)) return "Em atraso";
  if (receivables.some((item) => daysBetween(item.dueDate) === 0)) return "Pendente";
  return "Em dia";
}

function allOpenReceivables() {
  return records.flatMap((record) => getRecordReceivables(record).map((receivable) => ({
    ...receivable,
    record,
    financialStatus: getFinancialStatus(record)
  })));
}

function buildFinancialCycles(record) {
  const cycles = new Map();
  (record.paymentHistory || []).forEach((payment) => {
    const key = payment.cycleId || `cycle-${stableHash(`${record.id}|${payment.previousDueDate || payment.paidAt}|${payment.installment}`)}`;
    const existing = cycles.get(key) || {
      cycleId: key,
      recordId: record.id,
      record,
      installment: payment.installment,
      dueDate: payment.previousDueDate || payment.paidAt,
      referencePeriod: payment.referencePeriod || monthYear(payment.previousDueDate || payment.paidAt),
      expectedAmount: 0,
      paidAmount: 0,
      payments: []
    };
    existing.expectedAmount = Math.max(
      existing.expectedAmount,
      Number(payment.expectedAmount) || Number(payment.amount) || 0
    );
    existing.paidAmount += Number(payment.amount) || 0;
    existing.payments.push(payment);
    cycles.set(key, existing);
  });
  getRecordReceivables(record).forEach((receivable) => {
    const existing = cycles.get(receivable.cycleId) || {
      cycleId: receivable.cycleId,
      recordId: record.id,
      record,
      installment: receivable.label,
      dueDate: receivable.originalDueDate,
      referencePeriod: receivable.referencePeriod,
      expectedAmount: receivable.expectedAmount,
      paidAmount: receivable.paidAmount,
      payments: []
    };
    existing.expectedAmount = Math.max(existing.expectedAmount, receivable.expectedAmount);
    existing.paidAmount = Math.max(existing.paidAmount, receivable.paidAmount);
    existing.balanceDueDate = receivable.dueDate;
    cycles.set(receivable.cycleId, existing);
  });
  return [...cycles.values()].map((cycle) => ({
    ...cycle,
    openAmount: Math.max(cycle.expectedAmount - cycle.paidAmount, 0),
    isPartial: cycle.paidAmount > 0 && cycle.paidAmount < cycle.expectedAmount,
    isPaid: cycle.expectedAmount > 0 && cycle.paidAmount >= cycle.expectedAmount
  }));
}

function allFinancialCycles() {
  return records.flatMap(buildFinancialCycles);
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
    let raw;
    try {
      raw = safeStorageGet(key);
    } catch {
      return [];
    }
    if (!raw) continue;
    try {
      const extracted = extractRecords(JSON.parse(raw));
      if (Array.isArray(extracted) && extracted.length) return migrateArray(extracted);
      if (key === STORAGE_KEY && Array.isArray(extracted)) return [];
      if (key === STORAGE_KEY) {
        storageLoadError = true;
        persistenceWarning = "A estrutura dos cadastros locais é inválida. O CRM bloqueou novas gravações para preservar os dados.";
        return [];
      }
    } catch {
      // Tenta a próxima chave legada.
      storageLoadError = true;
      persistenceWarning = `Os dados locais em ${key} estão ilegíveis. O CRM bloqueou novas gravações para preservar o conteúdo.`;
    }
  }
  return [];
}

function loadTrash() {
  try {
    return migrateArray(JSON.parse(safeStorageGet(TRASH_KEY) || "[]"));
  } catch {
    storageLoadError = true;
    persistenceWarning = "A lixeira local está ilegível. O CRM bloqueou novas gravações para preservar os dados.";
    return [];
  }
}

function readGoal() {
  try {
    const raw = safeStorageGet(GOAL_KEY);
    const parsed = parseMoney(raw || 0);
    if (raw && !Number.isFinite(Number(String(raw).replace(",", ".")))) throw new Error("meta inválida");
    return parsed;
  } catch {
    storageLoadError = true;
    persistenceWarning = "A meta mensal local está ilegível. O CRM bloqueou novas gravações para preservar os dados.";
    return 0;
  }
}

function readReceiptCounters() {
  try {
    const parsed = JSON.parse(safeStorageGet(RECEIPT_COUNTER_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    storageLoadError = true;
    persistenceWarning = "Os contadores de recibos estão ilegíveis. O CRM bloqueou novas gravações para preservar os dados.";
    return {};
  }
}

function readFinancialReports() {
  try {
    const parsed = JSON.parse(safeStorageGet(FINANCIAL_REPORTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    storageLoadError = true;
    persistenceWarning = "Os relatórios financeiros locais estão ilegíveis. O CRM bloqueou novas gravações para preservar os dados.";
    return [];
  }
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
      monthlyGoal: parseMoney(source.monthlyGoal ?? source.metaMensal ?? 0),
      financialReports: Array.isArray(source.financialReports) ? source.financialReports : [],
      receiptCounters: source.receiptCounters && typeof source.receiptCounters === "object"
        ? source.receiptCounters
        : {}
    }
  };
}

function getSnapshots() {
  try {
    const parsed = JSON.parse(safeStorageGet(SNAPSHOT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeSnapshot).slice(0, MAX_SNAPSHOTS) : [];
  } catch {
    storageLoadError = true;
    persistenceWarning = "Os snapshots locais estão ilegíveis. O CRM bloqueou novas gravações para preservar os dados.";
    return [];
  }
}

function setSnapshots(snapshots) {
  if (!persistenceReady || storageLoadError) throw new Error(persistenceWarning || "Armazenamento indisponível.");
  const nextSnapshots = JSON.stringify(snapshots.map(normalizeSnapshot).slice(0, MAX_SNAPSHOTS));
  safeStorageSet(SNAPSHOT_KEY, nextSnapshots);
}

let records = findInitialData();
let trash = loadTrash();
let monthlyGoal = readGoal();
let receiptCounters = readReceiptCounters();
let financialReports = readFinancialReports();
let pendingImport = null;

function captureState() {
  return cloneData({ records, trash, monthlyGoal, receiptCounters, financialReports });
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
  if (!persistenceReady || storageLoadError) throw new Error(persistenceWarning || "Armazenamento indisponível.");
  const next = {
    [STORAGE_KEY]: JSON.stringify(records),
    [TRASH_KEY]: JSON.stringify(trash),
    [GOAL_KEY]: String(monthlyGoal || 0),
    [RECEIPT_COUNTER_KEY]: JSON.stringify(receiptCounters),
    [FINANCIAL_REPORTS_KEY]: JSON.stringify(financialReports),
    [SNAPSHOT_KEY]: safeStorageGet(SNAPSHOT_KEY)
  };
  validatePersistencePayload(next);

  const previous = {};
  PERSISTENCE_KEYS.forEach((key) => { previous[key] = safeStorageGet(key); });
  const journal = JSON.stringify({ schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), previous });
  safeStorageSet(PERSISTENCE_JOURNAL_KEY, journal);

  try {
    [STORAGE_KEY, TRASH_KEY, GOAL_KEY, RECEIPT_COUNTER_KEY, FINANCIAL_REPORTS_KEY].forEach((key) => {
      safeStorageSet(key, next[key]);
    });
    safeStorageRemove(PERSISTENCE_JOURNAL_KEY);
    persistenceWarning = "";
  } catch (error) {
    let rollbackError = null;
    PERSISTENCE_KEYS.forEach((key) => {
      try {
        if (previous[key] === null) {
          localStorage.removeItem(key);
          if (localStorage.getItem(key) !== null) throw new Error(`Não foi possível restaurar ${key}.`);
        } else {
          safeStorageSet(key, previous[key]);
        }
      } catch (restoreError) {
        rollbackError = rollbackError || restoreError;
      }
    });
    if (!rollbackError) {
      try { safeStorageRemove(PERSISTENCE_JOURNAL_KEY); } catch (cleanupError) { rollbackError = cleanupError; }
    }
    persistenceWarning = rollbackError
      ? `Falha ao salvar e ao restaurar completamente o estado anterior. Preserve os dados locais e não repita a operação. Erro: ${rollbackError.message || "armazenamento indisponível"}`
      : `A gravação falhou; o estado anterior foi restaurado. A operação não foi concluída. Erro: ${error.message || "armazenamento indisponível"}`;
    throw new Error(persistenceWarning);
  }
}

function validatePersistencePayload(payload) {
  const parseJsonArray = (key) => {
    const parsed = JSON.parse(payload[key]);
    if (!Array.isArray(parsed)) throw new Error(`Dados inválidos em ${key}: era esperado um array.`);
    if (parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
      throw new Error(`Dados inválidos em ${key}: há itens que não são objetos.`);
    }
    return parsed;
  };
  const storedRecords = parseJsonArray(STORAGE_KEY);
  const storedTrash = parseJsonArray(TRASH_KEY);
  const storedReports = parseJsonArray(FINANCIAL_REPORTS_KEY);
  const counters = JSON.parse(payload[RECEIPT_COUNTER_KEY]);
  const snapshots = payload[SNAPSHOT_KEY] ? JSON.parse(payload[SNAPSHOT_KEY]) : [];
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) throw new Error("Contador de recibos inválido.");
  if (!Array.isArray(snapshots)) throw new Error("Snapshots inválidos.");
  if (!Number.isFinite(parseMoney(payload[GOAL_KEY]))) throw new Error("Meta mensal inválida.");
  [...storedRecords, ...storedTrash].forEach((record) => {
    if (!record.id || !Array.isArray(record.paymentHistory) || !Array.isArray(record.financialHistory)) {
      throw new Error("Há um cadastro sem identificador ou com histórico inválido.");
    }
  });
  storedReports.forEach((report) => {
    if (!report.id && (report.year === undefined || report.month === undefined)) throw new Error("Há um relatório sem identificador de competência.");
  });
}

function applyImportantChange(reason, mutate) {
  if (!persistenceReady || storageLoadError) {
    toast(persistenceWarning || "Armazenamento indisponível. Nenhuma alteração foi salva.");
    return false;
  }
  const previousState = captureState();
  const previousSnapshots = getSnapshots();
  try {
    pushSnapshot(reason, previousState);
    mutate();
    persistData();
    render();
    return true;
  } catch (error) {
    records = migrateArray(previousState.records);
    trash = migrateArray(previousState.trash);
    monthlyGoal = parseMoney(previousState.monthlyGoal);
    receiptCounters = cloneData(previousState.receiptCounters || {});
    financialReports = cloneData(previousState.financialReports || []);
    try { setSnapshots(previousSnapshots); } catch { /* mantém o diário para recuperação no próximo carregamento */ }
    render();
    toast(error.message || "Não foi possível salvar. A alteração foi desfeita.");
    return false;
  }
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("show"), 4200);
}

function addCommercialHistory(record, type, description) {
  record.commercialHistory = record.commercialHistory || [];
  record.commercialHistory.unshift(normalizeTimelineItem({
    id: uid("commercial"),
    createdAt: new Date().toISOString(),
    type,
    description
  }, "commercial"));
}

function addFinancialHistory(record, type, description, value = 0, metadata = {}, actor = "Sistema") {
  record.financialHistory = record.financialHistory || [];
  record.financialHistory.unshift(normalizeTimelineItem({
    id: uid("financial"),
    createdAt: new Date().toISOString(),
    type,
    description,
    value,
    metadata,
    actor
  }, "financial"));
}

function recordFromForm() {
  const selectedPlan = $("plan").value;
  let value = parseMoney($("value").value);
  if (!value && planValues[selectedPlan]) value = planValues[selectedPlan];
  const existing = records.find((record) => record.id === $("recordId").value);

  const normalized = normalizeRecord({
    id: $("recordId").value || uid(),
    name: $("name").value,
    company: $("company").value,
    documentNumber: $("documentNumber").value,
    phone: $("phone").value,
    email: $("email").value,
    plan: selectedPlan,
    value,
    status: $("status").value,
    paymentType: $("paymentType").value,
    installment1Percent: Number($("installment1Percent").value),
    installment2Percent: Number($("installment2Percent").value),
    firstContactDate: $("firstContactDate").value,
    startDate: $("startDate").value,
    dueDate: $("dueDate").value,
    dueDate2: $("dueDate2").value,
    notes: $("notes").value,
    leadSource: $("leadSource").value,
    leadTemperature: $("leadTemperature").value,
    commercialStage: $("commercialStage").value,
    nextAction: $("nextAction").value,
    nextContactDate: $("nextContactDate").value,
    lossReason: $("lossReason").value,
    commercialHistory: existing?.commercialHistory || [],
    lastPaidDate: existing?.lastPaidDate || null,
    paymentHistory: existing?.paymentHistory || [],
    openBalances: existing?.openBalances || [],
    receipts: existing?.receipts || [],
    financialHistory: existing?.financialHistory || [],
    financialStatus: existing?.financialStatus || "",
    canceledAt: existing?.canceledAt || null
  });
  normalized.installment1Percent = Number($("installment1Percent").value);
  normalized.installment2Percent = Number($("installment2Percent").value);
  return normalized;
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
  if (!record.name) return "Informe o nome do contato.";

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
  if (!["Lead", "Ativo", "Pausado", "Cancelado"].includes(record.status)) {
    return "Selecione o tipo de cadastro.";
  }
  if (!COMMERCIAL_STAGES.includes(record.commercialStage)) {
    return "Selecione a etapa comercial.";
  }
  if (record.paymentType === "2x") {
    const firstPercent = Number(record.installment1Percent);
    const secondPercent = Number(record.installment2Percent);
    if (!Number.isInteger(firstPercent) || !Number.isInteger(secondPercent)
      || firstPercent < 1 || secondPercent < 1 || firstPercent + secondPercent !== 100) {
      return "As porcentagens das parcelas devem ser números inteiros positivos cuja soma seja exatamente 100% (ex.: 60% + 40%).";
    }
  }
  if (record.commercialStage === "Perdido" && !record.lossReason) {
    return "Informe o motivo da perda.";
  }

  const duplicate = duplicateMatch(record, records, record.id);
  if (duplicate) {
    return `Já existe um cadastro com o mesmo ${duplicate.field}: ${duplicate.record.name || "sem nome"}.`;
  }
  return "";
}

function commercialChanges(existing, updated) {
  const labels = {
    leadSource: "origem",
    leadTemperature: "temperatura",
    commercialStage: "etapa comercial",
    nextAction: "próxima ação",
    nextContactDate: "data do próximo contato",
    lossReason: "motivo de perda"
  };
  return Object.keys(labels)
    .filter((field) => String(existing[field] || "") !== String(updated[field] || ""))
    .map((field) => labels[field]);
}

function upsertRecord(record) {
  const index = records.findIndex((item) => item.id === record.id);
  const existing = index >= 0 ? records[index] : null;
  const reason = existing
    ? `Antes de editar o cadastro de ${record.name}`
    : `Antes de cadastrar ${record.name}`;

  if (existing) {
    const changes = commercialChanges(existing, record);
    if (existing.commercialStage !== record.commercialStage) {
      addCommercialHistory(
        record,
        "Mudança de etapa",
        `Etapa alterada de ${existing.commercialStage} para ${record.commercialStage}.`
      );
    }
    const otherChanges = changes.filter((label) => label !== "etapa comercial");
    if (otherChanges.length) {
      addCommercialHistory(
        record,
        "Edição comercial",
        `Campos atualizados: ${otherChanges.join(", ")}.`
      );
    }
    if (existing.plan !== record.plan || Number(existing.value) !== Number(record.value)) {
      addFinancialHistory(
        record,
        "Plano ou valor alterado",
        `Plano/valor alterado de ${existing.plan || "não informado"} (${formatMoney(existing.value)}) para ${record.plan || "não informado"} (${formatMoney(record.value)}).`,
        Number(record.value) || 0,
        {
          previousPlan: existing.plan,
          previousValue: existing.value,
          newPlan: record.plan,
          newValue: record.value
        }
      );
    }
    if (existing.dueDate !== record.dueDate || existing.dueDate2 !== record.dueDate2) {
      addFinancialHistory(
        record,
        "Vencimento alterado",
        `Vencimento atualizado de ${formatDate(existing.dueDate)}${existing.dueDate2 ? ` / ${formatDate(existing.dueDate2)}` : ""} para ${formatDate(record.dueDate)}${record.dueDate2 ? ` / ${formatDate(record.dueDate2)}` : ""}.`,
        0,
        {
          previousDueDate: existing.dueDate,
          previousDueDate2: existing.dueDate2,
          newDueDate: record.dueDate,
          newDueDate2: record.dueDate2
        }
      );
    }
    if (existing.status !== "Cancelado" && record.status === "Cancelado") {
      record.canceledAt = new Date().toISOString();
      addFinancialHistory(record, "Cliente cancelado", "Cadastro marcado como cancelado.", 0);
    }
  } else {
    addCommercialHistory(record, "Cadastro criado", `Cadastro incluído na etapa ${record.commercialStage}.`);
  }

  if (!applyImportantChange(reason, () => {
    record.financialStatus = getFinancialStatus(record);
    if (index >= 0) records[index] = record;
    else records.unshift(record);
  })) return;
  clearForm();
  toast("Cadastro salvo com segurança.");
}

function clearForm() {
  $("clientForm").reset();
  $("recordId").value = "";
  $("status").value = "Lead";
  $("paymentType").value = "1x";
  $("installment1Percent").value = "60";
  $("installment2Percent").value = "40";
  $("leadTemperature").value = "Morno";
  $("commercialStage").value = "Novo lead";
  $("dueDate2Wrap").classList.add("hidden");
  $("lossReasonWrap").classList.add("hidden");
  $("formTitle").textContent = "Cadastrar lead/cliente";
}

function fillForm(record) {
  setActiveTab("records");
  $("recordId").value = record.id;
  $("name").value = record.name || "";
  $("company").value = record.company || "";
  $("documentNumber").value = formatDoc(record.documentNumber || "");
  $("phone").value = record.phone || "";
  $("email").value = record.email || "";
  $("plan").value = record.plan || "";
  $("value").value = record.value ? String(record.value).replace(".", ",") : "";
  $("status").value = record.status || "Lead";
  $("paymentType").value = record.paymentType || "1x";
  $("installment1Percent").value = String(record.installment1Percent ?? 60);
  $("installment2Percent").value = String(record.installment2Percent ?? 40);
  $("firstContactDate").value = record.firstContactDate || "";
  $("startDate").value = record.startDate || "";
  $("dueDate").value = record.dueDate || "";
  $("dueDate2").value = record.dueDate2 || "";
  $("notes").value = record.notes || "";
  $("leadSource").value = record.leadSource || "";
  $("leadTemperature").value = record.leadTemperature || "Morno";
  $("commercialStage").value = record.commercialStage || "Novo lead";
  $("nextAction").value = record.nextAction || "";
  $("nextContactDate").value = record.nextContactDate || "";
  $("lossReason").value = record.lossReason || "";
  toggleDue2();
  toggleLossReason();
  $("formTitle").textContent = "Editar cadastro";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  if (!window.confirm(`Mover "${record.name}" para a lixeira?`)) return;

  if (!applyImportantChange(`Antes de mover ${record.name} para a lixeira`, () => {
    trash.unshift({ ...record, deletedAt: new Date().toISOString() });
    trash = trash.slice(0, 20);
    records = records.filter((item) => item.id !== id);
  })) return;
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

  if (!applyImportantChange(`Antes de restaurar ${record.name} da lixeira`, () => {
    records.unshift(normalizeRecord({ ...record, deletedAt: null }));
    trash = trash.filter((item) => item.id !== id);
  })) return;
  toast("Cadastro restaurado.");
}

function clearTrash() {
  if (!trash.length) {
    toast("Lixeira já está vazia.");
    return;
  }
  if (!window.confirm("Esvaziar a lixeira definitivamente? Uma versão anterior será criada antes.")) return;

  if (!applyImportantChange("Antes de esvaziar a lixeira", () => {
    trash = [];
  })) return;
  toast("Lixeira esvaziada.");
}

function markAsClient(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;

  if (!applyImportantChange(`Antes de converter ${record.name} em cliente`, () => {
    const previousStage = record.commercialStage;
    record.status = "Ativo";
    record.commercialStage = "Fechado";
    record.startDate = record.startDate || todayStr();
    record.dueDate = record.dueDate || addOneMonth(todayStr());
    record.lossReason = "";
    addCommercialHistory(
      record,
      "Lead convertido em cliente",
      `Lead convertido em cliente ativo; etapa alterada de ${previousStage} para Fechado.`
    );
  })) return;
  toast("Lead convertido em cliente ativo.");
}

function moveCommercialStage(id, direction) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const currentIndex = COMMERCIAL_STAGES.indexOf(record.commercialStage);
  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= COMMERCIAL_STAGES.length) return;
  const nextStage = COMMERCIAL_STAGES[targetIndex];
  if (nextStage === "Perdido") {
    openLossDialog(id);
    return;
  }

  if (!applyImportantChange(`Antes de alterar a etapa de ${record.name}`, () => {
    const previousStage = record.commercialStage;
    record.commercialStage = nextStage;
    if (nextStage !== "Perdido") record.lossReason = "";
    addCommercialHistory(
      record,
      "Mudança de etapa",
      `Etapa alterada de ${previousStage} para ${nextStage}.`
    );
  })) return;
  toast(`Etapa alterada para ${nextStage}.`);
}

function openLossDialog(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  $("lossForm").reset();
  $("lossRecordId").value = id;
  $("lossReasonOtherWrap").classList.add("hidden");
  $("lossDialog").showModal();
}

function markAsLost(id, reason) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  if (!applyImportantChange(`Antes de marcar ${record.name} como perdido`, () => {
    const previousStage = record.commercialStage;
    record.commercialStage = "Perdido";
    record.lossReason = reason;
    addCommercialHistory(
      record,
      "Lead marcado como perdido",
      `Etapa alterada de ${previousStage} para Perdido. Motivo: ${reason}.`
    );
  })) return;
  if ($("lossDialog").open) $("lossDialog").close();
  toast("Lead marcado como perdido.");
}

function followUpMessage(record) {
  if (record.leadTemperature === "Quente" && !["Fechado", "Perdido"].includes(record.commercialStage)) {
    return HOT_FOLLOW_UP_MESSAGE;
  }
  return FOLLOW_UP_MESSAGES[record.commercialStage] || FOLLOW_UP_MESSAGES["Novo lead"];
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

async function copyFollowUp(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const copied = await copyText(followUpMessage(record));
  if (!copied) {
    toast("Não foi possível copiar a mensagem.");
    return;
  }
  if (!applyImportantChange(`Antes de registrar follow-up de ${record.name}`, () => {
    addCommercialHistory(
      record,
      "Follow-up copiado",
      `Mensagem de follow-up da etapa ${record.commercialStage} copiada.`
    );
  })) return;
  toast("Mensagem de follow-up copiada.");
}

function whatsappUrl(phone, message) {
  return `https://wa.me/55${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function openPipelineWhatsApp(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  window.open(whatsappUrl(record.phone, followUpMessage(record)), "_blank", "noopener");
  applyImportantChange(`Antes de registrar abertura do WhatsApp de ${record.name}`, () => {
    addCommercialHistory(
      record,
      "WhatsApp aberto",
      `WhatsApp aberto com mensagem da etapa ${record.commercialStage}.`
    );
  });
}

function openFollowUp(id) {
  openPipelineWhatsApp(id);
}

function openCharge(id, installment = 1) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const receivable = getRecordReceivables(record).find((item) => item.installment === installment);
  const messageType = receivable?.isPartial
    ? "partial"
    : (receivable && daysBetween(receivable.dueDate) < 0 ? "overdue" : "upcoming");
  const message = COLLECTION_MESSAGES[messageType];
  window.open(whatsappUrl(record.phone, message), "_blank", "noopener");
  applyImportantChange(`Antes de registrar cobrança de ${record.name}`, () => {
    addFinancialHistory(
      record,
      "Cobrança enviada",
      `WhatsApp aberto com mensagem de ${messageType === "partial" ? "pagamento parcial" : (messageType === "overdue" ? "pagamento vencido" : "vencimento próximo")}.`,
      receivable?.remainingAmount || 0,
      { messageType, receivableId: receivable?.id || "", channel: "WhatsApp" }
    );
  });
}

async function copyCollectionMessage(recordId, receivableId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;
  const receivable = getRecordReceivables(record).find((item) => item.id === receivableId)
    || getRecordReceivables(record)[0];
  const messageType = receivable?.isPartial
    ? "partial"
    : (receivable && daysBetween(receivable.dueDate) < 0 ? "overdue" : "upcoming");
  const copied = await copyText(COLLECTION_MESSAGES[messageType]);
  if (!copied) {
    toast("Não foi possível copiar a mensagem de cobrança.");
    return;
  }
  if (!applyImportantChange(`Antes de registrar mensagem de cobrança de ${record.name}`, () => {
    addFinancialHistory(
      record,
      "Mensagem de cobrança copiada",
      `Mensagem de ${messageType === "partial" ? "pagamento parcial" : (messageType === "overdue" ? "pagamento vencido" : "vencimento próximo")} copiada.`,
      receivable?.remainingAmount || 0,
      { messageType, receivableId: receivable?.id || "", channel: "Cópia" }
    );
  })) return;
  toast("Mensagem de cobrança copiada.");
}

function openFinanceWhatsApp(recordId, receivableId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;
  const receivable = getRecordReceivables(record).find((item) => item.id === receivableId)
    || getRecordReceivables(record)[0];
  const messageType = receivable?.isPartial
    ? "partial"
    : (receivable && daysBetween(receivable.dueDate) < 0 ? "overdue" : "upcoming");
  window.open(whatsappUrl(record.phone, COLLECTION_MESSAGES[messageType]), "_blank", "noopener");
  applyImportantChange(`Antes de registrar cobrança de ${record.name}`, () => {
    addFinancialHistory(
      record,
      "Cobrança enviada",
      `WhatsApp aberto com mensagem de ${messageType === "partial" ? "pagamento parcial" : (messageType === "overdue" ? "pagamento vencido" : "vencimento próximo")}.`,
      receivable?.remainingAmount || 0,
      { messageType, receivableId: receivable?.id || "", channel: "WhatsApp" }
    );
  });
}

function defaultPaymentAmount(record, installment) {
  return expectedInstallmentAmount(record, installment);
}

function openPaymentDialog(id, installment = 1, receivableId = "") {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const receivables = getRecordReceivables(record);
  const receivable = receivables.find((item) => item.id === receivableId)
    || receivables.find((item) => item.installment === installment);
  const due = receivable?.originalDueDate || (installment === 2 ? record.dueDate2 : record.dueDate);
  const expectedAmount = receivable?.expectedAmount || defaultPaymentAmount(record, installment);
  const remainingAmount = receivable?.remainingAmount ?? expectedAmount;
  $("paymentForm").reset();
  $("paymentRecordId").value = id;
  $("paymentInstallment").value = installment;
  $("paymentCycleId").value = receivable?.cycleId || `cycle-${stableHash(`${record.id}|${due}|${installment}`)}`;
  $("paymentAmount").value = String(remainingAmount || 0).replace(".", ",");
  $("paymentMethod").value = "Pix";
  $("paymentDate").value = todayStr();
  $("paymentReference").value = receivable?.referencePeriod || monthYear(due || todayStr());
  $("paymentBalanceDueDate").value = receivable?.dueDate || due || todayStr();
  $("paymentBalanceSummary").innerHTML = `
    <div><span>Valor esperado</span><strong>${escapeHtml(formatMoney(expectedAmount))}</strong></div>
    <div><span>Já recebido</span><strong>${escapeHtml(formatMoney(receivable?.paidAmount || 0))}</strong></div>
    <div><span>Saldo atual</span><strong>${escapeHtml(formatMoney(remainingAmount))}</strong></div>
  `;
  $("paymentDialog").showModal();
}

function registerPayment(id, installment, details) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const previousDueDate = installment === 2 ? record.dueDate2 : record.dueDate;
  const currentReceivable = getRecordReceivables(record).find((item) => (
    item.cycleId === details.cycleId || item.installment === installment
  ));
  const expectedAmount = currentReceivable?.expectedAmount || expectedInstallmentAmount(record, installment);
  const paidBefore = currentReceivable?.paidAmount || 0;
  const openBefore = currentReceivable?.remainingAmount ?? expectedAmount;
  if (details.amount > openBefore + 0.009) {
    toast(`O valor informado supera o saldo em aberto de ${formatMoney(openBefore)}.`);
    return;
  }
  const balanceRemaining = Math.max(openBefore - details.amount, 0);
  const isPartial = balanceRemaining > 0.009;
  const payment = normalizePaymentItem({
    id: uid("payment"),
    paidAt: details.paidAt,
    amount: details.amount,
    installment: record.paymentType === "2x" ? `${installment}ª parcela` : "Mensal",
    previousDueDate,
    nextDueDate: installment === 2 || record.paymentType === "1x"
      ? addOneMonth(previousDueDate || details.paidAt)
      : record.dueDate2,
    paymentMethod: details.paymentMethod,
    referencePeriod: details.referencePeriod,
    notes: details.notes,
    expectedAmount,
    cycleId: details.cycleId,
    isPartial,
    balanceRemaining,
    balanceDueDate: isPartial ? details.balanceDueDate : "",
    paymentStatus: isPartial ? "Parcial" : "Quitado"
  }, record.id);

  if (!applyImportantChange(`Antes de registrar pagamento de ${record.name}`, () => {
    record.lastPaidDate = details.paidAt;
    record.paymentHistory = record.paymentHistory || [];
    record.paymentHistory.unshift(payment);
    addFinancialHistory(
      record,
      isPartial ? "Pagamento parcial registrado" : "Pagamento registrado",
      `${payment.installment} de ${formatMoney(payment.amount)} recebida via ${payment.paymentMethod}, referência ${payment.referencePeriod}.${isPartial ? ` Saldo restante: ${formatMoney(balanceRemaining)}, com vencimento em ${formatDate(details.balanceDueDate)}.` : ""}`,
      payment.amount,
      {
        paymentId: payment.id,
        cycleId: payment.cycleId,
        expectedAmount,
        paidBefore,
        balanceRemaining,
        balanceDueDate: details.balanceDueDate,
        paymentMethod: payment.paymentMethod
      }
    );

    record.openBalances = record.openBalances || [];
    record.openBalances = record.openBalances.filter((balance) => balance.cycleId !== payment.cycleId);
    if (isPartial) {
      record.openBalances.push(normalizeOpenBalance({
        id: currentReceivable?.id || uid("balance"),
        cycleId: payment.cycleId,
        installment,
        label: payment.installment,
        dueDate: previousDueDate,
        referencePeriod: payment.referencePeriod,
        expectedAmount,
        paidAmount: paidBefore + payment.amount,
        remainingAmount: balanceRemaining,
        balanceDueDate: details.balanceDueDate || previousDueDate,
        updatedAt: new Date().toISOString()
      }, record.id));
    } else if (record.paymentType === "1x") {
      record.dueDate = addOneMonth(record.dueDate || details.paidAt);
    } else if (installment === 2) {
      record.dueDate = addOneMonth(record.dueDate || details.paidAt);
      record.dueDate2 = addOneMonth(record.dueDate2 || details.paidAt);
    }
    record.financialStatus = getFinancialStatus(record);
  })) return;

  if ($("paymentDialog").open) $("paymentDialog").close();
  toast(
    isPartial
      ? `Pagamento parcial registrado. Saldo restante: ${formatMoney(balanceRemaining)}.`
      : record.paymentType === "2x" && installment === 1
      ? "1ª parcela registrada. A 2ª parcela continua pendente."
      : "Pagamento registrado. O recibo já pode ser gerado."
  );
  showHistory(id);
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

function dateInPeriod(dateStr, year, monthIndex) {
  if (!dateStr) return false;
  const date = new Date(`${dateStr}T12:00:00`);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(year)
    && date.getMonth() === Number(monthIndex);
}

function buildMonthlyFinancialReport(year, monthIndex) {
  const cycles = allFinancialCycles().filter((cycle) => dateInPeriod(cycle.dueDate, year, monthIndex));
  const payments = records.flatMap((record) => (record.paymentHistory || [])
    .filter((payment) => dateInPeriod(payment.paidAt, year, monthIndex))
    .map((payment) => ({ ...payment, record })));
  const expected = cycles.reduce((sum, cycle) => sum + (Number(cycle.expectedAmount) || 0), 0);
  const received = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const open = cycles.reduce((sum, cycle) => sum + (Number(cycle.openAmount) || 0), 0);
  const overdueCycles = cycles.filter((cycle) => (
    cycle.openAmount > 0 && daysBetween(cycle.balanceDueDate || cycle.dueDate) < 0
  ));
  const overdue = overdueCycles.reduce((sum, cycle) => sum + cycle.openAmount, 0);
  const paidClientIds = new Set(cycles.filter((cycle) => cycle.isPaid).map((cycle) => cycle.recordId));
  const pendingClientIds = new Set(cycles.filter((cycle) => (
    cycle.openAmount > 0 && daysBetween(cycle.balanceDueDate || cycle.dueDate) >= 0
  )).map((cycle) => cycle.recordId));
  const defaultClientIds = new Set(overdueCycles.map((cycle) => cycle.recordId));
  const receiptCount = payments.filter((payment) => payment.receiptNumber).length;
  const partialCount = payments.filter((payment) => payment.isPartial).length;
  const canceledCount = records.filter((record) => (
    record.status === "Cancelado"
    && record.canceledAt
    && dateInPeriod(String(record.canceledAt).slice(0, 10), year, monthIndex)
  )).length;

  return {
    id: `finance-report-${year}-${String(Number(monthIndex) + 1).padStart(2, "0")}`,
    year: Number(year),
    month: Number(monthIndex),
    generatedAt: new Date().toISOString(),
    expected,
    received,
    open,
    overdue,
    paidCount: paidClientIds.size,
    pendingCount: pendingClientIds.size,
    defaultCount: defaultClientIds.size,
    receiptCount,
    partialCount,
    canceledCount,
    payments
  };
}

function currentFinancialMetrics() {
  const now = new Date();
  const report = buildMonthlyFinancialReport(now.getFullYear(), now.getMonth());
  const receivables = allOpenReceivables();
  const activeRevenue = records
    .filter((record) => record.status === "Ativo")
    .reduce((sum, record) => sum + (Number(record.value) || 0), 0);
  const openAmount = receivables.reduce((sum, item) => sum + item.remainingAmount, 0);
  const overdueItems = receivables.filter((item) => daysBetween(item.dueDate) < 0);
  const overdueAmount = overdueItems.reduce((sum, item) => sum + item.remainingAmount, 0);
  const defaultCount = new Set(overdueItems.map((item) => item.recordId)).size;
  const next7 = receivables
    .filter((item) => daysBetween(item.dueDate) >= 0 && daysBetween(item.dueDate) <= 7)
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  const next30 = receivables
    .filter((item) => daysBetween(item.dueDate) >= 0 && daysBetween(item.dueDate) <= 30)
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  return {
    activeRevenue,
    expectedMonth: report.expected,
    receivedMonth: report.received,
    openAmount,
    overdueAmount,
    defaultCount,
    next7,
    next30,
    upcomingCount: receivables.filter((item) => {
      const difference = daysBetween(item.dueDate);
      return difference >= 0 && difference <= 7;
    }).length
  };
}

function initializeFinancePeriodFilters() {
  const monthSelect = $("financeReportMonth");
  const yearSelect = $("financeReportYear");
  if (monthSelect.options.length) return;
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  months.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = month;
    monthSelect.appendChild(option);
  });
  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 4; year <= currentYear + 2; year += 1) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }
  monthSelect.value = new Date().getMonth();
  yearSelect.value = currentYear;
}

function selectedMonthlyReport() {
  return buildMonthlyFinancialReport(
    Number($("financeReportYear").value),
    Number($("financeReportMonth").value)
  );
}

function financeDueFilterMatch(item, filter) {
  if (filter === "Todos") return true;
  if (item.missingDue) return filter === "Sem vencimento";
  const difference = daysBetween(item.dueDate);
  if (filter === "Hoje") return difference === 0;
  if (filter === "7dias") return difference >= 0 && difference <= 7;
  if (filter === "30dias") return difference >= 0 && difference <= 30;
  if (filter === "Vencidos") return difference < 0;
  return false;
}

function filteredFinanceItems() {
  const dueFilter = $("financeDueFilter").value;
  const statusFilter = $("financeStatusFilter").value;
  const receivables = allOpenReceivables();
  const missingDue = records
    .filter((record) => record.status === "Ativo" && !currentDueEntries(record).some((entry) => entry.dueDate))
    .map((record) => ({
      id: `missing-${record.id}`,
      recordId: record.id,
      record,
      missingDue: true,
      dueDate: "",
      remainingAmount: 0,
      label: "Sem vencimento",
      financialStatus: getFinancialStatus(record)
    }));
  return [...receivables, ...missingDue].filter((item) => (
    financeDueFilterMatch(item, dueFilter)
    && (statusFilter === "Todos" || item.financialStatus === statusFilter)
  ));
}

function financialStatusClass(status) {
  return String(status || "").toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function renderFinanceSummary() {
  const metrics = currentFinancialMetrics();
  $("financeActiveRevenue").textContent = formatMoney(metrics.activeRevenue);
  $("financeExpectedMonth").textContent = formatMoney(metrics.expectedMonth);
  $("financeReceivedMonth").textContent = formatMoney(metrics.receivedMonth);
  $("financeOpenAmount").textContent = formatMoney(metrics.openAmount);
  $("financeOverdueAmount").textContent = formatMoney(metrics.overdueAmount);
  $("financeDefaultCount").textContent = metrics.defaultCount;
  $("financeNext7").textContent = formatMoney(metrics.next7);
  $("financeNext30").textContent = formatMoney(metrics.next30);
}

function financeItemMarkup(item, overdueOnly = false) {
  const record = item.record;
  const difference = item.missingDue ? Number.NaN : daysBetween(item.dueDate);
  const dateLabel = item.missingDue
    ? "Sem vencimento cadastrado"
    : (difference < 0 ? `${Math.abs(difference)} dia(s) em atraso` : formatDate(item.dueDate));
  return `
    <article class="finance-item ${difference < 0 ? "is-overdue" : ""}">
      <div class="finance-item-main">
        <div>
          <span class="financial-status ${financialStatusClass(item.financialStatus)}">${escapeHtml(item.financialStatus)}</span>
          <h3>${escapeHtml(record.name || "-")}</h3>
          ${record.company ? `<p>${escapeHtml(record.company)}</p>` : ""}
          <small>${escapeHtml(record.phone || "-")}</small>
        </div>
        <div class="finance-item-values">
          <strong>${escapeHtml(formatMoney(item.remainingAmount))}</strong>
          <span>${escapeHtml(item.label || "")}</span>
          <small>${escapeHtml(dateLabel)}</small>
        </div>
      </div>
      <div class="finance-item-actions">
        ${!item.missingDue ? `
          <button class="btn btn-secondary btn-small" type="button" data-finance-action="whatsapp" data-record-id="${escapeHtml(record.id)}" data-receivable-id="${escapeHtml(item.id)}">WhatsApp</button>
          <button class="btn btn-ghost btn-small" type="button" data-finance-action="copy" data-record-id="${escapeHtml(record.id)}" data-receivable-id="${escapeHtml(item.id)}">Copiar cobrança</button>
          <button class="btn btn-primary btn-small" type="button" data-finance-action="payment" data-record-id="${escapeHtml(record.id)}" data-receivable-id="${escapeHtml(item.id)}" data-installment="${item.installment || 1}">Registrar pagamento</button>
        ` : ""}
        <button class="btn btn-warning btn-small" type="button" data-finance-action="history" data-record-id="${escapeHtml(record.id)}">${overdueOnly ? "Pagamentos e recibos" : "Histórico"}</button>
      </div>
    </article>
  `;
}

function bindFinanceActions(container) {
  container.querySelectorAll("[data-finance-action]").forEach((button) => {
    const action = button.dataset.financeAction;
    const recordId = button.dataset.recordId;
    const receivableId = button.dataset.receivableId;
    if (action === "whatsapp") button.onclick = () => openFinanceWhatsApp(recordId, receivableId);
    if (action === "copy") button.onclick = () => copyCollectionMessage(recordId, receivableId);
    if (action === "payment") {
      button.onclick = () => openPaymentDialog(recordId, Number(button.dataset.installment) || 1, receivableId);
    }
    if (action === "history") button.onclick = () => showHistory(recordId);
  });
}

function renderFinanceLists() {
  const dueContainer = $("financeDueList");
  const items = filteredFinanceItems();
  dueContainer.innerHTML = items.length
    ? items.map((item) => financeItemMarkup(item)).join("")
    : '<div class="finance-empty">Nenhum vencimento encontrado para os filtros selecionados.</div>';
  bindFinanceActions(dueContainer);

  const overdueContainer = $("financeOverdueList");
  const overdueItems = allOpenReceivables()
    .filter((item) => daysBetween(item.dueDate) < 0)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  overdueContainer.innerHTML = overdueItems.length
    ? overdueItems.map((item) => financeItemMarkup(item, true)).join("")
    : '<div class="finance-empty">Nenhum cliente inadimplente.</div>';
  bindFinanceActions(overdueContainer);
}

function renderMonthlyReport() {
  const report = selectedMonthlyReport();
  $("reportExpected").textContent = formatMoney(report.expected);
  $("reportReceived").textContent = formatMoney(report.received);
  $("reportOpen").textContent = formatMoney(report.open);
  $("reportOverdue").textContent = formatMoney(report.overdue);
  $("reportPaidCount").textContent = report.paidCount;
  $("reportPendingCount").textContent = report.pendingCount;
  $("reportDefaultCount").textContent = report.defaultCount;
  $("reportReceiptCount").textContent = report.receiptCount;
  $("reportPartialCount").textContent = report.partialCount;
  $("reportCanceledCount").textContent = report.canceledCount;
  const body = $("financeReportTable");
  body.innerHTML = report.payments.length
    ? report.payments.map((payment) => `
      <tr>
        <td>${escapeHtml(payment.record.name || "-")}${payment.record.company ? `<br><span class="muted">${escapeHtml(payment.record.company)}</span>` : ""}</td>
        <td>${escapeHtml(formatDate(payment.paidAt))}</td>
        <td>${escapeHtml(formatMoney(payment.amount))}</td>
        <td>${escapeHtml(payment.paymentMethod || "Não informado")}</td>
        <td><span class="financial-status ${payment.isPartial ? "parcialmente-pago" : "em-dia"}">${payment.isPartial ? "Parcial" : "Quitado"}</span></td>
        <td>${payment.receiptNumber ? escapeHtml(payment.receiptNumber) : "-"}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="6">Nenhum pagamento registrado no período.</td></tr>';
}

function renderFinance() {
  renderFinanceSummary();
  renderFinanceLists();
  renderMonthlyReport();
}

function buildPrintableFinancialReport(report) {
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const rows = report.payments.length
    ? report.payments.map((payment) => `
      <tr>
        <td>${escapeHtml(payment.record.name || "-")}</td>
        <td>${escapeHtml(formatDate(payment.paidAt))}</td>
        <td>${escapeHtml(formatMoney(payment.amount))}</td>
        <td>${escapeHtml(payment.paymentMethod || "Não informado")}</td>
        <td>${payment.isPartial ? "Parcial" : "Quitado"}</td>
        <td>${escapeHtml(payment.receiptNumber || "-")}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="6">Nenhum pagamento registrado no período.</td></tr>';
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Financeiro AXIS 1</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#17181c;background:#f4f4f2}.page{max-width:980px;margin:30px auto;background:#fff;padding:42px;box-shadow:0 10px 40px rgba(0,0,0,.1)}header{background:#0d0f14;color:#fff;padding:28px;border-left:8px solid #ff6a00}.brand{color:#ff6a00;font-weight:900;letter-spacing:.15em}h1{margin:10px 0 4px}.period{color:#c7c8cc}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.card{border:1px solid #ddd;padding:14px}.card span{display:block;color:#666;font-size:11px;text-transform:uppercase}.card strong{display:block;margin-top:8px;font-size:18px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}th{background:#f0f0ee;color:#555;text-transform:uppercase}footer{margin-top:28px;color:#777;font-size:11px}@media print{body{background:#fff}.page{margin:0;max-width:none;box-shadow:none}.no-print{display:none}}@media(max-width:700px){.summary{grid-template-columns:repeat(2,1fr)}.page{padding:20px}}
</style></head><body><main class="page">
<header><div class="brand">AXIS 1</div><h1>Relatório Financeiro Mensal</h1><div class="period">${monthNames[report.month]} de ${report.year}</div></header>
<section class="summary">
<div class="card"><span>Total previsto</span><strong>${formatMoney(report.expected)}</strong></div>
<div class="card"><span>Total recebido</span><strong>${formatMoney(report.received)}</strong></div>
<div class="card"><span>Em aberto</span><strong>${formatMoney(report.open)}</strong></div>
<div class="card"><span>Em atraso</span><strong>${formatMoney(report.overdue)}</strong></div>
<div class="card"><span>Clientes pagos</span><strong>${report.paidCount}</strong></div>
<div class="card"><span>Pendentes</span><strong>${report.pendingCount}</strong></div>
<div class="card"><span>Inadimplentes</span><strong>${report.defaultCount}</strong></div>
<div class="card"><span>Recibos</span><strong>${report.receiptCount}</strong></div>
<div class="card"><span>Pagamentos parciais</span><strong>${report.partialCount}</strong></div>
<div class="card"><span>Cancelados</span><strong>${report.canceledCount}</strong></div>
</section>
<table><thead><tr><th>Cliente</th><th>Data</th><th>Valor</th><th>Forma</th><th>Status</th><th>Recibo</th></tr></thead><tbody>${rows}</tbody></table>
<footer>Relatório gerado pelo CRM AXIS 1 em ${formatDateTime(report.generatedAt)}. Documento preparado para impressão.</footer>
</main></body></html>`;
}

function exportMonthlyFinancialReport() {
  const report = selectedMonthlyReport();
  const reportSnapshot = {
    ...report,
    payments: report.payments.map((payment) => ({
      id: payment.id,
      recordId: payment.record.id,
      clientName: payment.record.name,
      paidAt: payment.paidAt,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      isPartial: payment.isPartial,
      receiptNumber: payment.receiptNumber
    }))
  };
  if (!applyImportantChange("Antes de registrar exportação do relatório financeiro", () => {
    financialReports = mergeFinancialReports([reportSnapshot], financialReports);
  })) return;
  const blob = new Blob([buildPrintableFinancialReport(report)], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio-financeiro-axis1-${report.year}-${String(report.month + 1).padStart(2, "0")}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast("Relatório financeiro exportado em formato imprimível.");
}

function isPaymentRegisteredThisCycle(record, installment) {
  const due = installment === 2 ? record.dueDate2 : record.dueDate;
  if (!due) return false;
  return (record.paymentHistory || []).some((item) => (
    item.previousDueDate === due
    && String(item.installment).includes(record.paymentType === "2x" ? `${installment}` : "Mensal")
  ));
}

function scanReceiptMax(year) {
  const pattern = new RegExp(`^AXIS1-REC-${year}-(\\d{4,})$`);
  let max = Number(receiptCounters[year]) || 0;
  [...records, ...trash].forEach((record) => {
    [
      ...(record.receipts || []).map((receipt) => receipt.receiptNumber),
      ...(record.paymentHistory || []).map((payment) => payment.receiptNumber)
    ].filter(Boolean).forEach((number) => {
      const match = String(number).match(pattern);
      if (match) max = Math.max(max, Number(match[1]) || 0);
    });
  });
  return max;
}

function nextReceiptNumber(dateStr = todayStr()) {
  const year = String(dateStr || todayStr()).slice(0, 4);
  const next = scanReceiptMax(year) + 1;
  receiptCounters[year] = next;
  return `AXIS1-REC-${year}-${String(next).padStart(4, "0")}`;
}

function buildReceiptData(record, payment, receiptNumber, generatedAt) {
  return normalizeReceiptData({
    receiptNumber,
    generatedAt,
    clientName: record.name,
    company: record.company,
    documentNumber: record.documentNumber,
    service: record.plan || "Serviços AXIS 1",
    amount: payment.amount,
    paymentMethod: payment.paymentMethod || "Não informado",
    paymentDate: payment.paidAt,
    referencePeriod: payment.referencePeriod || monthYear(payment.previousDueDate || payment.paidAt),
    notes: payment.notes || record.notes || "",
    axisWhatsapp: AXIS_WHATSAPP,
    legalText: RECEIPT_LEGAL_TEXT
  });
}

function findPayment(recordId, paymentId) {
  const record = records.find((item) => item.id === recordId);
  const payment = record?.paymentHistory?.find((item) => item.id === paymentId);
  return { record, payment };
}

function ensureReceipt(record, payment) {
  if (payment.receiptNumber && payment.receiptData) {
    return payment.receiptData;
  }
  const generatedAt = new Date().toISOString();
  const receiptNumber = payment.receiptNumber || nextReceiptNumber(payment.paidAt);
  const data = buildReceiptData(record, payment, receiptNumber, generatedAt);
  payment.receiptNumber = receiptNumber;
  payment.receiptGeneratedAt = payment.receiptGeneratedAt || generatedAt;
  payment.receiptData = data;
  record.receipts = uniqueReceipts([
    ...(record.receipts || []),
    {
      receiptNumber,
      paymentId: payment.id,
      generatedAt: payment.receiptGeneratedAt,
      data
    }
  ]);
  return data;
}

function pdfLatin1(value) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\xFF]/g, "?");
}

function pdfEscape(value) {
  return pdfLatin1(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function encodeLatin1(value) {
  const text = String(value);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xFF;
  }
  return bytes;
}

function wrapText(value, maxChars = 82) {
  const words = pdfLatin1(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function createReceiptPdf(data) {
  const commands = [];
  const rect = (x, y, width, height, fill) => {
    commands.push(`${fill} rg ${x} ${y} ${width} ${height} re f`);
  };
  const line = (x1, y1, x2, y2, color = "0.95 0.42 0") => {
    commands.push(`${color} RG 1.5 w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const text = (value, x, y, size = 10, font = "F1", color = "0.12 0.13 0.16") => {
    commands.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`);
  };
  const labelValue = (label, value, y) => {
    text(label.toUpperCase(), 58, y, 8, "F2", "0.42 0.44 0.49");
    text(value || "-", 58, y - 17, 11, "F1", "0.10 0.11 0.14");
  };

  rect(0, 0, 595, 842, "0.97 0.97 0.96");
  rect(0, 680, 595, 162, "0.045 0.05 0.065");
  rect(0, 680, 12, 162, "1 0.42 0");
  text("AXIS 1", 52, 784, 15, "F2", "1 0.42 0");
  text("RECIBO DE PAGAMENTO", 52, 742, 25, "F2", "1 1 1");
  text(data.receiptNumber, 52, 711, 11, "F1", "0.78 0.79 0.82");
  text(`Emitido em ${formatDateTime(data.generatedAt)}`, 366, 711, 9, "F1", "0.78 0.79 0.82");

  text("RECEBEMOS DE", 52, 640, 9, "F2", "1 0.42 0");
  text(data.clientName || "-", 52, 612, 18, "F2");
  if (data.company) text(data.company, 52, 592, 11, "F1", "0.32 0.34 0.38");
  if (data.documentNumber) text(`CPF/CNPJ: ${formatDoc(data.documentNumber)}`, 52, 573, 10, "F1", "0.32 0.34 0.38");
  line(52, 552, 543, 552, "0.84 0.84 0.82");

  labelValue("Serviço ou plano", data.service, 524);
  labelValue("Valor recebido", formatMoney(data.amount), 468);
  labelValue("Forma de pagamento", data.paymentMethod, 412);
  labelValue("Data do pagamento", formatDate(data.paymentDate), 356);
  labelValue("Período de referência", data.referencePeriod, 300);

  text("OBSERVAÇÕES", 310, 524, 8, "F2", "0.42 0.44 0.49");
  wrapText(data.notes || "Sem observações.", 42).slice(0, 7).forEach((item, index) => {
    text(item, 310, 507 - (index * 15), 10, "F1", "0.10 0.11 0.14");
  });

  rect(42, 122, 511, 98, "0.91 0.91 0.89");
  text("DECLARAÇÃO", 58, 194, 9, "F2", "1 0.42 0");
  wrapText(data.legalText, 78).slice(0, 3).forEach((item, index) => {
    text(item, 58, 171 - (index * 16), 10, "F1", "0.18 0.19 0.22");
  });
  text(`Contato AXIS 1: WhatsApp ${data.axisWhatsapp || AXIS_WHATSAPP}`, 58, 82, 10, "F2", "0.10 0.11 0.14");
  text("Documento gerado pelo CRM AXIS 1. Não substitui comprovante bancário.", 58, 58, 8, "F1", "0.45 0.46 0.49");

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${encodeLatin1(stream).length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  ];

  let output = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encodeLatin1(output).length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encodeLatin1(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([encodeLatin1(output)], { type: "application/pdf" });
}

function downloadReceiptBlob(data) {
  const blob = createReceiptPdf(data);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${data.receiptNumber || "recibo-axis1"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function generateReceipt(recordId, paymentId) {
  const { record, payment } = findPayment(recordId, paymentId);
  if (!record || !payment) return;
  let receiptData;
  if (!applyImportantChange(`Antes de gerar recibo para ${record.name}`, () => {
    receiptData = ensureReceipt(record, payment);
    addFinancialHistory(
      record,
      "Recibo gerado",
      `${receiptData.receiptNumber} • ${formatMoney(payment.amount)} • ${payment.paymentMethod} • ${payment.referencePeriod}.`
    );
  })) return;
  downloadReceiptBlob(receiptData);
  showHistory(recordId);
  toast(`Recibo ${receiptData.receiptNumber} gerado em PDF.`);
}

function downloadExistingReceipt(recordId, paymentId) {
  const { record, payment } = findPayment(recordId, paymentId);
  if (!record || !payment) return;
  if (!payment.receiptData) {
    generateReceipt(recordId, paymentId);
    return;
  }
  downloadReceiptBlob(payment.receiptData);
  toast(`Recibo ${payment.receiptNumber} baixado.`);
}

async function copyReceiptMessage() {
  const copied = await copyText(RECEIPT_MESSAGE);
  toast(copied ? "Mensagem do recibo copiada." : "Não foi possível copiar a mensagem.");
}

function backupPayload() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    records: cloneData(records),
    trash: cloneData(trash),
    monthlyGoal,
    snapshots: cloneData(getSnapshots()),
    receiptCounters: cloneData(receiptCounters),
    financialReports: cloneData(financialReports)
  };
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(backupPayload(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup-crm-axis1-v3-etapa-2-${todayStr()}.json`;
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
      : [],
    receiptCounters: metadata.receiptCounters && typeof metadata.receiptCounters === "object"
      ? metadata.receiptCounters
      : {},
    financialReports: Array.isArray(metadata.financialReports)
      ? metadata.financialReports
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
  const merged = current.map((item) => cloneData(item));
  incoming.forEach((incomingItem) => {
    const duplicateIndex = merged.findIndex((item) => (
      item.id === incomingItem.id
      || (
        item.paidAt === incomingItem.paidAt
        && Number(item.amount) === Number(incomingItem.amount)
        && item.installment === incomingItem.installment
        && item.previousDueDate === incomingItem.previousDueDate
      )
      || (item.receiptNumber && item.receiptNumber === incomingItem.receiptNumber)
    ));
    if (duplicateIndex < 0) {
      merged.push(incomingItem);
      return;
    }
    const currentItem = merged[duplicateIndex];
    merged[duplicateIndex] = {
      ...incomingItem,
      ...currentItem,
      paymentMethod: currentItem.paymentMethod !== "Não informado"
        ? currentItem.paymentMethod
        : incomingItem.paymentMethod,
      referencePeriod: currentItem.referencePeriod || incomingItem.referencePeriod,
      notes: (currentItem.notes || "").length >= (incomingItem.notes || "").length
        ? currentItem.notes
        : incomingItem.notes,
      expectedAmount: Math.max(
        Number(currentItem.expectedAmount) || 0,
        Number(incomingItem.expectedAmount) || 0
      ),
      cycleId: currentItem.cycleId || incomingItem.cycleId,
      isPartial: Boolean(currentItem.isPartial || incomingItem.isPartial),
      balanceRemaining: Math.max(
        Number(currentItem.balanceRemaining) || 0,
        Number(incomingItem.balanceRemaining) || 0
      ),
      balanceDueDate: currentItem.balanceDueDate || incomingItem.balanceDueDate,
      paymentStatus: currentItem.paymentStatus || incomingItem.paymentStatus,
      receiptNumber: currentItem.receiptNumber || incomingItem.receiptNumber,
      receiptGeneratedAt: currentItem.receiptGeneratedAt || incomingItem.receiptGeneratedAt,
      receiptData: currentItem.receiptData || incomingItem.receiptData
    };
  });
  return merged.sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
}

function mergeTimelines(current = [], incoming = [], prefix) {
  return uniqueTimeline([...current, ...incoming], prefix);
}

function mergeOpenBalances(current = [], incoming = []) {
  const balances = new Map();
  [...incoming, ...current].map((item, index) => normalizeOpenBalance(item, "", index)).forEach((balance) => {
    const key = balance.cycleId || balance.id;
    const existing = balances.get(key);
    if (!existing || String(balance.updatedAt) >= String(existing.updatedAt)) {
      balances.set(key, balance);
    }
  });
  return [...balances.values()].filter((balance) => balance.remainingAmount > 0);
}

function mergeMostComplete(current, incoming) {
  const merged = { ...current, id: current.id };
  const textFields = [
    "company", "documentNumber", "phone", "email", "plan",
    "firstContactDate", "startDate", "dueDate", "dueDate2", "notes",
    "leadSource", "nextAction", "nextContactDate", "lossReason"
  ];

  textFields.forEach((field) => {
    if (!merged[field]) merged[field] = incoming[field] || "";
  });
  if ((incoming.name || "").length > (merged.name || "").length) merged.name = incoming.name;
  if ((incoming.notes || "").length > (merged.notes || "").length) merged.notes = incoming.notes;
  if (!merged.value) merged.value = incoming.value || 0;
  if (merged.leadTemperature === "Morno" && incoming.leadTemperature !== "Morno") {
    merged.leadTemperature = incoming.leadTemperature;
  }
  if (
    merged.commercialStage === normalizeCommercialStage("", merged.status)
    && incoming.commercialStage !== normalizeCommercialStage("", incoming.status)
  ) {
    merged.commercialStage = incoming.commercialStage;
  }
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
  merged.openBalances = mergeOpenBalances(current.openBalances, incoming.openBalances);
  merged.commercialHistory = mergeTimelines(current.commercialHistory, incoming.commercialHistory, "commercial");
  merged.financialHistory = mergeTimelines(current.financialHistory, incoming.financialHistory, "financial");
  merged.receipts = uniqueReceipts([...(current.receipts || []), ...(incoming.receipts || [])]);
  merged.financialStatus = current.financialStatus || incoming.financialStatus || "";
  merged.canceledAt = current.canceledAt || incoming.canceledAt || null;
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

function mergeReceiptCounters(current, incoming) {
  const merged = { ...current };
  Object.entries(incoming || {}).forEach(([year, value]) => {
    merged[year] = Math.max(Number(merged[year]) || 0, Number(value) || 0);
  });
  return merged;
}

function mergeFinancialReports(current = [], incoming = []) {
  const reports = new Map();
  [...incoming, ...current].forEach((report) => {
    if (!report || typeof report !== "object") return;
    const key = report.id || `${report.year}-${report.month}`;
    if (!reports.has(key)) reports.set(key, report);
  });
  return [...reports.values()].slice(0, 36);
}

function closeImportDialog() {
  if ($("importDialog").open) $("importDialog").close();
  pendingImport = null;
}

function performImport(mode) {
  if (!pendingImport) return;
  if (!persistenceReady || storageLoadError) {
    toast(persistenceWarning || "Armazenamento indisponível. A importação não foi aplicada.");
    return;
  }
  const { backup } = pendingImport;
  if (
    mode === "replace"
    && !window.confirm("Substituir todos os dados atuais pelo backup? Uma versão do estado atual será salva antes.")
  ) return;

  const previousState = captureState();
  const previousSnapshots = getSnapshots();
  const stats = { imported: 0, ignored: 0, merged: 0 };
  try {
  const safetySnapshot = pushSnapshot(
    mode === "replace" ? "Antes de substituir os dados por um backup" : "Antes de mesclar um backup"
  );
  const currentSnapshots = getSnapshots();

  if (mode === "replace") {
    records = cloneData(backup.records);
    trash = cloneData(backup.trash);
    monthlyGoal = backup.monthlyGoal;
    receiptCounters = cloneData(backup.receiptCounters);
    financialReports = cloneData(backup.financialReports);
    stats.imported = records.length;
    setSnapshots(combineSnapshots(safetySnapshot, backup.snapshots));
  } else {
    records = mergeRecordCollections(records, backup.records, stats);
    trash = mergeTrashCollections(trash, backup.trash);
    if (!monthlyGoal && backup.monthlyGoal) monthlyGoal = backup.monthlyGoal;
    receiptCounters = mergeReceiptCounters(receiptCounters, backup.receiptCounters);
    financialReports = mergeFinancialReports(financialReports, backup.financialReports);
    setSnapshots(combineSnapshots(currentSnapshots, backup.snapshots));
  }

  persistData();
  loadGoal();
  render();
  closeImportDialog();
  toast(`Importação concluída: ${stats.imported} importado(s), ${stats.ignored} ignorado(s) e ${stats.merged} mesclado(s).`);
  } catch (error) {
    records = migrateArray(previousState.records);
    trash = migrateArray(previousState.trash);
    monthlyGoal = parseMoney(previousState.monthlyGoal);
    receiptCounters = cloneData(previousState.receiptCounters || {});
    financialReports = cloneData(previousState.financialReports || []);
    try { setSnapshots(previousSnapshots); } catch { /* diário permanece para recuperação na inicialização */ }
    render();
    toast(error.message || "A importação falhou e os dados anteriores foram restaurados.");
  }
}

function restoreSnapshot(id) {
  const target = getSnapshots().find((snapshot) => snapshot.id === id);
  if (!target) {
    toast("Essa versão não está mais disponível.");
    return;
  }
  const date = formatDateTime(target.createdAt);
  if (!window.confirm(`Restaurar a versão de ${date}?\nMotivo: ${target.reason}`)) return;
  if (!persistenceReady || storageLoadError) {
    toast(persistenceWarning || "Armazenamento indisponível. A restauração não foi aplicada.");
    return;
  }
  const previousState = captureState();
  const previousSnapshots = getSnapshots();
  try {
  pushSnapshot(`Antes de restaurar a versão de ${date}`);
  records = migrateArray(target.data.records);
  trash = migrateArray(target.data.trash);
  monthlyGoal = parseMoney(target.data.monthlyGoal);
  receiptCounters = cloneData(target.data.receiptCounters || {});
  financialReports = cloneData(target.data.financialReports || []);
  persistData();
  loadGoal();
  render();
  if ($("snapshotsDialog").open) $("snapshotsDialog").close();
  toast("Versão anterior restaurada com sucesso.");
  } catch (error) {
    records = migrateArray(previousState.records);
    trash = migrateArray(previousState.trash);
    monthlyGoal = parseMoney(previousState.monthlyGoal);
    receiptCounters = cloneData(previousState.receiptCounters || {});
    financialReports = cloneData(previousState.financialReports || []);
    try { setSnapshots(previousSnapshots); } catch { /* diário permanece para recuperação na inicialização */ }
    render();
    toast(error.message || "A restauração falhou e os dados anteriores foram restaurados.");
  }
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
  if (!applyImportantChange("Antes de alterar a meta mensal", () => {
    monthlyGoal = nextGoal;
  })) return;
  loadGoal();
  toast("Meta mensal salva.");
}

function toggleDue2() {
  const splitPayment = $("paymentType").value === "2x";
  $("dueDate2Wrap").classList.toggle("hidden", !splitPayment);
  $("installment1PercentWrap").classList.toggle("hidden", !splitPayment);
  $("installment2PercentWrap").classList.toggle("hidden", !splitPayment);
  $("installmentPercentHint").classList.toggle("hidden", !splitPayment);
}

function toggleLossReason() {
  $("lossReasonWrap").classList.toggle("hidden", $("commercialStage").value !== "Perdido");
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
  const source = $("sourceFilter").value;
  const temperature = $("temperatureFilter").value;
  const stage = $("stageFilter").value;
  const commercial = $("commercialFilter").value;
  const financialStatus = $("recordFinancialStatusFilter").value;
  const dueFilter = $("recordDueFilter").value;
  const paymentMethod = $("recordPaymentMethodFilter").value;
  const plan = $("recordPlanFilter").value;

  return records.filter((record) => {
    const matchesStatus = status === "Todos" || record.status === status;
    const matchesSource = source === "Todos" || record.leadSource === source;
    const matchesTemperature = temperature === "Todos" || record.leadTemperature === temperature;
    const matchesStage = stage === "Todos" || record.commercialStage === stage;
    const nextContactDifference = daysBetween(record.nextContactDate);
    const matchesCommercial = (
      commercial === "Todos"
      || (commercial === "Atrasados" && record.nextContactDate && nextContactDifference < 0)
      || (commercial === "Propostas" && record.commercialStage === "Proposta enviada")
      || (commercial === "Perdidos" && record.commercialStage === "Perdido")
      || (commercial === "Fechados" && record.commercialStage === "Fechado")
    );
    const calculatedFinancialStatus = getFinancialStatus(record);
    const receivables = getRecordReceivables(record);
    const matchesFinancialStatus = (
      financialStatus === "Todos" || calculatedFinancialStatus === financialStatus
    );
    const matchesDue = (
      dueFilter === "Todos"
      || (dueFilter === "7dias" && receivables.some((item) => {
        const difference = daysBetween(item.dueDate);
        return difference >= 0 && difference <= 7;
      }))
      || (dueFilter === "Vencidos" && receivables.some((item) => daysBetween(item.dueDate) < 0))
    );
    const matchesPaymentMethod = (
      paymentMethod === "Todos"
      || (record.paymentHistory || []).some((payment) => payment.paymentMethod === paymentMethod)
      || (paymentMethod === "Não informado" && !(record.paymentHistory || []).length)
    );
    const matchesPlan = plan === "Todos" || record.plan === plan;
    const text = [
      record.name,
      record.company,
      record.documentNumber,
      record.plan,
      record.phone,
      record.email,
      record.notes,
      record.leadSource,
      record.commercialStage,
      record.nextAction,
      record.lossReason
    ].join(" ").toLowerCase();
    return matchesStatus
      && matchesSource
      && matchesTemperature
      && matchesStage
      && matchesCommercial
      && matchesFinancialStatus
      && matchesDue
      && matchesPaymentMethod
      && matchesPlan
      && text.includes(query);
  });
}

function followUpState(dateStr) {
  if (!dateStr) return null;
  const difference = daysBetween(dateStr);
  if (difference < 0) return { className: "overdue", label: "Atrasado" };
  if (difference === 0) return { className: "today", label: "Hoje" };
  if (difference <= 3) return { className: "soon", label: `Em ${difference} dia(s)` };
  return null;
}

function buildAlerts() {
  const alerts = [];
  records.forEach((record) => {
    if (record.status === "Ativo") {
      getRecordReceivables(record).forEach((receivable) => {
        const difference = daysBetween(receivable.dueDate);
        const label = receivable.isPartial
          ? `saldo de ${receivable.label.toLowerCase()}`
          : (record.paymentType === "2x" ? receivable.label : "mensalidade");
        if (difference < 0) {
          alerts.push({
            urgent: true,
            type: "Cobrança vencida",
            text: `${record.name} — ${label} venceu em ${formatDate(receivable.dueDate)}`,
            action: () => openCharge(record.id, receivable.installment),
            label: "Cobrar"
          });
        } else if (difference === 0) {
          alerts.push({
            urgent: true,
            type: "Vence hoje",
            text: `${record.name} — ${label} vence hoje`,
            action: () => openCharge(record.id, receivable.installment),
            label: "Cobrar"
          });
        } else if (difference >= 1 && difference <= 3) {
          alerts.push({
            urgent: false,
            type: `Vence em ${difference} dia(s)`,
            text: `${record.name} — ${label} vence em ${formatDate(receivable.dueDate)}`,
            action: () => openCharge(record.id, receivable.installment),
            label: "Cobrar"
          });
        }
      });
    }

    if (!["Fechado", "Perdido"].includes(record.commercialStage) && record.nextContactDate) {
      const state = followUpState(record.nextContactDate);
      if (state && ["overdue", "today", "soon"].includes(state.className)) {
        alerts.push({
          urgent: state.className === "overdue",
          type: `Follow-up ${state.label.toLowerCase()}`,
          text: `${record.name} — ${record.nextAction || "retomar contato"}`,
          action: () => setActiveTab("pipeline"),
          label: "Ver pipeline"
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
  const metrics = currentFinancialMetrics();
  $("dashboardExpectedMonth").textContent = formatMoney(metrics.expectedMonth);
  $("receivedMonth").textContent = formatMoney(metrics.receivedMonth);
  $("dashboardOverdueAmount").textContent = formatMoney(metrics.overdueAmount);
  $("dashboardDefaultCount").textContent = metrics.defaultCount;
  $("dashboardUpcomingCount").textContent = metrics.upcomingCount;
  $("activeRevenue").textContent = formatMoney(metrics.activeRevenue);
  $("activeCount").textContent = active.length;
  $("leadCount").textContent = leads.length;
}

function renderPipelineSummary() {
  const open = records.filter((record) => (
    record.status === "Lead" && !["Fechado", "Perdido"].includes(record.commercialStage)
  ));
  $("pipelineOpenCount").textContent = open.length;
  $("pipelineHotCount").textContent = open.filter((record) => record.leadTemperature === "Quente").length;
  $("pipelineProposalCount").textContent = records.filter((record) => record.commercialStage === "Proposta enviada").length;
  $("pipelineOverdueCount").textContent = open.filter((record) => (
    record.nextContactDate && daysBetween(record.nextContactDate) < 0
  )).length;
  $("pipelineWonCount").textContent = records.filter((record) => record.commercialStage === "Fechado").length;
  $("pipelineLostCount").textContent = records.filter((record) => record.commercialStage === "Perdido").length;
}

function renderPipeline() {
  const board = $("pipelineBoard");
  board.innerHTML = "";
  COMMERCIAL_STAGES.forEach((stage) => {
    const stageRecords = records
      .filter((record) => record.commercialStage === stage)
      .sort((a, b) => String(a.nextContactDate || "9999").localeCompare(String(b.nextContactDate || "9999")));
    const column = document.createElement("section");
    column.className = "pipeline-column";
    column.innerHTML = `
      <header class="pipeline-column-head">
        <h3>${escapeHtml(stage)}</h3>
        <span>${stageRecords.length}</span>
      </header>
      <div class="pipeline-column-body"></div>
    `;
    const body = column.querySelector(".pipeline-column-body");
    if (!stageRecords.length) {
      body.innerHTML = '<div class="pipeline-empty">Nenhuma oportunidade.</div>';
    }

    stageRecords.forEach((record) => {
      const followState = followUpState(record.nextContactDate);
      const card = document.createElement("article");
      card.className = `pipeline-card temperature-${record.leadTemperature.toLowerCase()} ${followState ? `follow-${followState.className}` : ""}`;
      const stageIndex = COMMERCIAL_STAGES.indexOf(record.commercialStage);
      const estimated = record.value ? formatMoney(record.value) : (record.plan || "Sem valor estimado");
      card.innerHTML = `
        <div class="pipeline-card-head">
          <span class="temperature-badge ${record.leadTemperature.toLowerCase()}">${escapeHtml(record.leadTemperature)}</span>
          ${followState ? `<span class="follow-badge ${followState.className}">${escapeHtml(followState.label)}</span>` : ""}
        </div>
        <h4>${escapeHtml(record.name || "-")}</h4>
        ${record.company ? `<p class="pipeline-company">${escapeHtml(record.company)}</p>` : ""}
        <p class="pipeline-contact">${escapeHtml(record.phone || "-")}</p>
        <dl class="pipeline-details">
          <div><dt>Origem</dt><dd>${escapeHtml(record.leadSource || "Não informada")}</dd></div>
          <div><dt>Próxima ação</dt><dd>${escapeHtml(record.nextAction || "Não definida")}</dd></div>
          <div><dt>Próximo contato</dt><dd>${escapeHtml(formatDate(record.nextContactDate))}</dd></div>
          <div><dt>Potencial</dt><dd>${escapeHtml(estimated)}</dd></div>
          ${record.lossReason ? `<div><dt>Motivo</dt><dd>${escapeHtml(record.lossReason)}</dd></div>` : ""}
        </dl>
        <div class="pipeline-primary-actions">
          ${stageIndex > 0 ? '<button class="icon-action" type="button" data-action="back" title="Voltar etapa">←</button>' : ""}
          ${stageIndex < COMMERCIAL_STAGES.length - 2 ? '<button class="icon-action" type="button" data-action="advance" title="Avançar etapa">→</button>' : ""}
          <button class="icon-action" type="button" data-action="edit" title="Editar cadastro">Editar</button>
        </div>
        <div class="pipeline-secondary-actions">
          <button type="button" data-action="whatsapp">WhatsApp</button>
          <button type="button" data-action="copy">Copiar follow-up</button>
          <button type="button" data-action="commercial-history">Histórico</button>
          ${record.commercialStage !== "Perdido" ? '<button type="button" data-action="lost">Marcar perdido</button>' : ""}
          ${record.status === "Lead" ? '<button type="button" data-action="client">Converter em cliente</button>' : ""}
        </div>
      `;
      const actions = {
        back: () => moveCommercialStage(record.id, -1),
        advance: () => moveCommercialStage(record.id, 1),
        edit: () => fillForm(record),
        whatsapp: () => openPipelineWhatsApp(record.id),
        copy: () => copyFollowUp(record.id),
        "commercial-history": () => showCommercialHistory(record.id),
        lost: () => openLossDialog(record.id),
        client: () => markAsClient(record.id)
      };
      Object.entries(actions).forEach(([action, handler]) => {
        const button = card.querySelector(`[data-action="${action}"]`);
        if (button) button.onclick = handler;
      });
      body.appendChild(card);
    });
    board.appendChild(column);
  });
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
    const financialStatus = getFinancialStatus(record);
    const receivables = getRecordReceivables(record);
    const overdue = financialStatus === "Em atraso";
    const openAmount = receivables.reduce((sum, item) => sum + item.remainingAmount, 0);
    const row = document.createElement("tr");
    if (overdue) row.classList.add("row-overdue");
    const paymentText = record.paymentType === "2x"
      ? `2x ${record.installment1Percent}% + ${record.installment2Percent}% (${formatMoney(expectedInstallmentAmount(record, 1))} + ${formatMoney(expectedInstallmentAmount(record, 2))})`
      : "Mensal / 1x";
    const dueText = record.paymentType === "2x"
      ? `1ª: ${formatDate(record.dueDate)}<br>2ª: ${formatDate(record.dueDate2)}`
      : formatDate(record.dueDate);
    const actions = [
      '<button class="btn btn-secondary btn-small" type="button" data-action="edit">Editar</button>',
      '<button class="btn btn-secondary btn-small" type="button" data-action="history">Financeiro</button>',
      '<button class="btn btn-secondary btn-small" type="button" data-action="commercial-history">Comercial</button>'
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
        <strong>${escapeHtml(record.name || "-")}</strong>
        ${record.company ? `<br><span>${escapeHtml(record.company)}</span>` : ""}
        <br><span class="muted">${escapeHtml(record.phone || "")}${record.email ? ` • ${escapeHtml(record.email)}` : ""}</span>
      </td>
      <td>
        <span class="temperature-badge ${record.leadTemperature.toLowerCase()}">${escapeHtml(record.leadTemperature)}</span>
        <br><strong>${escapeHtml(record.commercialStage)}</strong>
        <br><span class="muted">${escapeHtml(record.leadSource || "Origem não informada")}</span>
      </td>
      <td>${escapeHtml(record.plan || "-")}<br><span class="muted">${escapeHtml(formatMoney(record.value))}</span></td>
      <td>
        <span class="badge ${escapeHtml(record.status)}">${escapeHtml(record.status)}</span>
        ${overdue ? '<br><span class="badge overdue">atrasado</span>' : ""}
      </td>
      <td>
        <span class="financial-status ${financialStatusClass(financialStatus)}">${escapeHtml(financialStatus)}</span>
        ${openAmount > 0 ? `<br><span class="muted">Aberto: ${escapeHtml(formatMoney(openAmount))}</span>` : ""}
      </td>
      <td>${escapeHtml(paymentText)}</td>
      <td>${dueText}</td>
      <td>${escapeHtml(formatDate(record.lastPaidDate))}</td>
      <td><div class="actions">${actions.join("")}</div></td>
    `;

    const actionMap = {
      edit: () => fillForm(record),
      history: () => showHistory(record.id),
      "commercial-history": () => showCommercialHistory(record.id),
      delete: () => deleteRecord(record.id),
      follow: () => openFollowUp(record.id),
      client: () => markAsClient(record.id),
      paid: () => openPaymentDialog(record.id, 1),
      paid1: () => openPaymentDialog(record.id, 1),
      paid2: () => openPaymentDialog(record.id, 2),
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
  const paymentsMarkup = !history.length
    ? `<p class="muted">Nenhum pagamento registrado para ${escapeHtml(record.name)}.</p>`
    : history.map((item) => {
      const hasReceipt = Boolean(item.receiptNumber && item.receiptData);
      return `
        <div class="history-row payment-history-row">
          <div class="payment-history-info">
            <strong>${escapeHtml(item.installment)}</strong>
            <span>Pago em ${escapeHtml(formatDate(item.paidAt))} • ${escapeHtml(item.paymentMethod || "Não informado")}</span>
            <span>Referência: ${escapeHtml(item.referencePeriod || "-")} • Vencimento: ${escapeHtml(formatDate(item.previousDueDate))}</span>
            <span>Status: ${escapeHtml(item.isPartial ? "Pagamento parcial" : "Quitado")}${item.balanceRemaining > 0 ? ` • Saldo: ${escapeHtml(formatMoney(item.balanceRemaining))} até ${escapeHtml(formatDate(item.balanceDueDate))}` : ""}</span>
            ${item.notes ? `<span>Observações: ${escapeHtml(item.notes)}</span>` : ""}
            ${hasReceipt ? `<span class="receipt-number">Recibo ${escapeHtml(item.receiptNumber)}</span>` : ""}
          </div>
          <div class="payment-history-value">
            <strong>${escapeHtml(formatMoney(item.amount))}</strong>
            <div class="receipt-actions">
              ${hasReceipt
                ? `
                  <button class="btn btn-secondary btn-small" type="button" data-receipt-action="download" data-payment-id="${escapeHtml(item.id)}">Baixar recibo</button>
                  <button class="btn btn-warning btn-small" type="button" data-receipt-action="regenerate" data-payment-id="${escapeHtml(item.id)}">Gerar novamente</button>
                  <button class="btn btn-ghost btn-small" type="button" data-receipt-action="copy-message">Copiar mensagem WhatsApp</button>
                `
                : `<button class="btn btn-primary btn-small" type="button" data-receipt-action="generate" data-payment-id="${escapeHtml(item.id)}">Gerar recibo em PDF</button>`
              }
            </div>
          </div>
        </div>
      `;
    }).join("");
  const financialHistory = record.financialHistory || [];
  const financialMarkup = financialHistory.length
    ? `
      <div class="history-section-title">
        <p class="section-kicker">Auditoria financeira</p>
        <h3>Histórico financeiro</h3>
      </div>
      <div class="timeline">
        ${financialHistory.map((item) => `
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div>
              <strong>${escapeHtml(item.type)}</strong>
              <small>${escapeHtml(formatDateTime(item.createdAt))}</small>
              <p>${escapeHtml(item.description)}</p>
              ${item.value ? `<small>Valor: ${escapeHtml(formatMoney(item.value))} • ${escapeHtml(item.actor || "Sistema")}</small>` : `<small>${escapeHtml(item.actor || "Sistema")}</small>`}
            </div>
          </div>
        `).join("")}
      </div>
    `
    : "";
  content.innerHTML = `${paymentsMarkup}${financialMarkup}`;

  content.querySelectorAll("[data-receipt-action]").forEach((button) => {
    const action = button.dataset.receiptAction;
    const paymentId = button.dataset.paymentId;
    if (action === "generate" || action === "regenerate") {
      button.onclick = () => generateReceipt(record.id, paymentId);
    }
    if (action === "download") {
      button.onclick = () => downloadExistingReceipt(record.id, paymentId);
    }
    if (action === "copy-message") {
      button.onclick = copyReceiptMessage;
    }
  });
  if (!$("historyDialog").open) $("historyDialog").showModal();
}

function showCommercialHistory(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  const content = $("commercialHistoryContent");
  const history = record.commercialHistory || [];
  if (!history.length) {
    content.innerHTML = `<p class="muted">Nenhuma ação comercial registrada para ${escapeHtml(record.name)}.</p>`;
  } else {
    content.innerHTML = history.map((item) => `
      <div class="timeline-item">
        <span class="timeline-dot"></span>
        <div>
          <strong>${escapeHtml(item.type)}</strong>
          <small>${escapeHtml(formatDateTime(item.createdAt))}</small>
          <p>${escapeHtml(item.description)}</p>
        </div>
      </div>
    `).join("");
  }
  if (!$("commercialHistoryDialog").open) $("commercialHistoryDialog").showModal();
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
  initializeFinancePeriodFilters();
  renderMetrics();
  renderAlerts();
  renderPipelineSummary();
  renderPipeline();
  renderFinance();
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

$("paymentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseMoney($("paymentAmount").value);
  if (amount <= 0) {
    toast("Informe um valor recebido maior que zero.");
    return;
  }
  const record = records.find((item) => item.id === $("paymentRecordId").value);
  const cycleId = $("paymentCycleId").value;
  const receivable = record?.paymentHistory
    ? getRecordReceivables(record).find((item) => item.cycleId === cycleId)
    : null;
  const remainingAmount = receivable?.remainingAmount
    ?? expectedInstallmentAmount(record || {}, Number($("paymentInstallment").value) || 1);
  const balanceDueDate = $("paymentBalanceDueDate").value;
  if (amount < remainingAmount - 0.009 && !balanceDueDate) {
    toast("Informe o vencimento do saldo restante para registrar um pagamento parcial.");
    return;
  }
  registerPayment(
    $("paymentRecordId").value,
    Number($("paymentInstallment").value) || 1,
    {
      amount,
      paymentMethod: $("paymentMethod").value,
      paidAt: $("paymentDate").value,
      referencePeriod: $("paymentReference").value.trim(),
      notes: $("paymentNotes").value.trim(),
      cycleId,
      balanceDueDate
    }
  );
});

$("lossForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = $("lossReasonSelect").value;
  const reason = selected === "Outro" ? $("lossReasonOther").value.trim() : selected;
  if (!reason) {
    toast("Informe o motivo da perda.");
    return;
  }
  markAsLost($("lossRecordId").value, reason);
});

$("plan").addEventListener("change", () => {
  const plan = $("plan").value;
  if (planValues[plan] && !$("value").value) {
    $("value").value = String(planValues[plan]).replace(".", ",");
  }
});
$("paymentType").addEventListener("change", toggleDue2);
$("commercialStage").addEventListener("change", toggleLossReason);
$("status").addEventListener("change", () => {
  if ($("status").value !== "Lead" && $("commercialStage").value === "Novo lead") {
    $("commercialStage").value = "Fechado";
    toggleLossReason();
  }
});
$("lossReasonSelect").addEventListener("change", () => {
  $("lossReasonOtherWrap").classList.toggle("hidden", $("lossReasonSelect").value !== "Outro");
});
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
$("newLeadFromPipelineBtn").onclick = () => {
  clearForm();
  setActiveTab("records");
  $("name").focus();
};
$("exportBackupBtn").onclick = exportBackup;
$("importBackupInput").onchange = (event) => prepareImport(event.target.files[0]);
$("restoreSnapshotBtn").onclick = openSnapshotsDialog;
$("saveGoalBtn").onclick = saveGoal;
[
  "searchInput",
  "statusFilter",
  "sourceFilter",
  "temperatureFilter",
  "stageFilter",
  "commercialFilter",
  "recordFinancialStatusFilter",
  "recordDueFilter",
  "recordPaymentMethodFilter",
  "recordPlanFilter"
].forEach((id) => {
  $(id).addEventListener(id === "searchInput" ? "input" : "change", renderTable);
});
$("financeDueFilter").addEventListener("change", renderFinanceLists);
$("financeStatusFilter").addEventListener("change", renderFinanceLists);
$("financeReportMonth").addEventListener("change", renderMonthlyReport);
$("financeReportYear").addEventListener("change", renderMonthlyReport);
$("exportFinanceReportBtn").onclick = exportMonthlyFinancialReport;
$("closeHistoryBtn").onclick = () => $("historyDialog").close();
$("closeCommercialHistoryBtn").onclick = () => $("commercialHistoryDialog").close();
$("closePaymentBtn").onclick = () => $("paymentDialog").close();
$("closeLossBtn").onclick = () => $("lossDialog").close();
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
      notes: parsed.notes || "Origem: Proposta AXIS 1",
      commercialStage: parsed.commercialStage || "Novo lead",
      leadTemperature: parsed.leadTemperature || "Morno"
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

    addCommercialHistory(lead, "Cadastro criado", "Lead importado automaticamente pela URL.");
    if (!applyImportantChange(`Antes de importar o lead ${lead.name} pela URL`, () => {
      records.unshift(lead);
    })) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    setActiveTab("pipeline");
    window.alert("Lead importado automaticamente no CRM.");
  } catch (error) {
    console.error(error);
    window.alert("Erro ao importar lead. Confira os dados recebidos.");
  }
}

try {
  persistData();
} catch (error) {
  persistenceWarning = error.message || "Não foi possível verificar a gravação inicial dos dados.";
}
loadGoal();
toggleDue2();
toggleLossReason();
render();
importLeadFromUrl();
if (persistenceWarning) toast(persistenceWarning);
