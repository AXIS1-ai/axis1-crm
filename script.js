const WHATSAPP_NUMBER = "5516997424912";
const CRM_URL = "https://axis1-ai.github.io/axis1-crm/";
let selectedPlan = "Essencial";

const planCards = document.querySelectorAll(".plan-card");
const selectedPlanLabel = document.getElementById("selectedPlanLabel");
const leadForm = document.getElementById("leadForm");
const successMessage = document.getElementById("successMessage");

function onlyDigits(value){ return String(value || "").replace(/\D/g, ""); }

function formatDocument(value){
  const d = onlyDigits(value);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}

function validatePhone(phone){
  const d = onlyDigits(phone);
  return d.length >= 10 && d.length <= 11;
}

function validateEmail(email){
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateDocument(doc){
  const d = onlyDigits(doc);
  if (!d) return true;
  return d.length === 11 || d.length === 14;
}

planCards.forEach(card => {
  card.addEventListener("click", () => {
    planCards.forEach(item => item.classList.remove("active"));
    card.classList.add("active");
    selectedPlan = card.dataset.plan;
    selectedPlanLabel.textContent = selectedPlan;
    document.querySelector(".form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.getElementById("leadDocument").addEventListener("blur", (event) => {
  event.target.value = formatDocument(event.target.value);
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("leadName").value.trim();
  const phone = document.getElementById("leadPhone").value.trim();
  const email = document.getElementById("leadEmail").value.trim();
  const documentNumber = document.getElementById("leadDocument").value.trim();

  if (!name){ alert("Preencha seu nome ou empresa."); return; }
  if (!validatePhone(phone)){ alert("Preencha um WhatsApp válido com DDD."); return; }
  if (!validateEmail(email)){ alert("Preencha um e-mail válido."); return; }
  if (!validateDocument(documentNumber)){ alert("Preencha um CPF/CNPJ válido ou deixe em branco."); return; }

  const crmData = {
    name,
    phone: onlyDigits(phone),
    email,
    documentNumber: onlyDigits(documentNumber),
    plan: selectedPlan,
    status: "Lead",
    firstContactDate: new Date().toISOString().slice(0, 10),
    notes: "Origem: Proposta AXIS 1",
    origin: "Proposta AXIS 1"
  };

  const encodedCRM = encodeURIComponent(JSON.stringify(crmData));
  const crmLink = `${CRM_URL}?importLead=${encodedCRM}`;

  const message = `NOVO LEAD — AXIS 1

Nome/Empresa: ${name}
WhatsApp: ${phone}
E-mail: ${email || "Não informado"}
CNPJ/CPF: ${documentNumber || "Não informado"}
Plano escolhido: ${selectedPlan}

Origem: Proposta AXIS 1

IMPORTAR NO CRM:
${crmLink}`;

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  successMessage.classList.remove("hidden");
  window.open(whatsappUrl, "_blank");
});