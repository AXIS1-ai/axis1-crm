# Esquema atual de armazenamento — CRM AXIS 1

Documento de referência da versão recebida em `axis1-crm-main-original.zip`. O código usa `SCHEMA_VERSION = 5`. Este documento descreve o formato observado; não altera nem migra os dados.

## Chaves `localStorage`

| Chave | Conteúdo atual | Leitura / gravação |
|---|---|---|
| `axis1_crm_v2_insano` | Array de cadastros normalizados. Cada registro inclui dados de contato, status e etapa comercial, vencimentos, pagamentos, saldos abertos, recibos e históricos. | Consultada também como primeira chave em `LEGACY_KEYS`; gravada por `persistData()`. |
| `axis1_crm_v2_trash` | Array de cadastros excluídos, incluindo `deletedAt`; limitado a 20 durante exclusão/restauração/mesclagem. | `loadTrash()` / `persistData()`. |
| `axis1_crm_v2_goal` | Meta mensal como texto numérico. | `readGoal()` / `persistData()`. |
| `axis1_crm_v2_snapshots` | Array de snapshots; até 10. Cada item contém `id`, `createdAt`, `reason`, `schemaVersion` e `data`. | `getSnapshots()` / `setSnapshots()`. Snapshot `data` inclui `records`, `trash`, `monthlyGoal`, `financialReports` e `receiptCounters`. |
| `axis1_crm_v3_receipt_counters` | Objeto de contadores anuais de recibos, por ano. | `readReceiptCounters()` / `persistData()`. |
| `axis1_crm_v3_financial_reports` | Array de resumos financeiros exportados; mesclagem limita a 36 itens. | `readFinancialReports()` / `persistData()`. |

### Chaves antigas consultadas

`findInitialData()` tenta, em ordem: `axis1_crm_v2_insano`, `axis1_crm_definitivo_v1`, `axis1_crm_integrado_v1`, `axis1_crm_records`, `axis1_crm_clientes`, `axis1_clientes`, `crmAxis1`, `clientesAxis1`, `axis1-crm` e `crm`. A função extrai arrays ou propriedades reconhecidas, normaliza registros em memória e retorna o primeiro conjunto não vazio. O carregamento não apaga explicitamente as chaves antigas.

## Formato lógico dos registros

Registro atual: `id`, `name`, `company`, `documentNumber`, `phone`, `email`, `plan`, `value`, `status`, `paymentType`, `firstContactDate`, `startDate`, `dueDate`, `dueDate2`, `notes`, `leadSource`, `leadTemperature`, `commercialStage`, `nextAction`, `nextContactDate`, `lossReason`, `commercialHistory`, `lastPaidDate`, `paymentHistory`, `openBalances`, `partialPayments`, `receipts`, `financialHistory`, `financialStatus`, `canceledAt` e `deletedAt`.

Pagamento: `id`, `paidAt`, `amount`, `installment`, `previousDueDate`, `nextDueDate`, `paymentMethod`, `referencePeriod`, `notes`, `expectedAmount`, `cycleId`, `isPartial`, `balanceRemaining`, `balanceDueDate`, `paymentStatus`, `receiptNumber`, `receiptGeneratedAt` e `receiptData`.

Saldo em aberto: `id`, `cycleId`, `installment`, `label`, `dueDate`, `referencePeriod`, `expectedAmount`, `paidAmount`, `remainingAmount`, `balanceDueDate` e `updatedAt`.

Item de histórico: `id`, `createdAt`, `type`, `description`, `value`, `actor` e `metadata`. Recibos armazenam `id`, `receiptNumber`, `paymentId`, `generatedAt` e `data`.

## Formato de backup

O objeto exportado inclui `schemaVersion`, `exportedAt`, `records`, `trash`, `monthlyGoal`, `snapshots`, `receiptCounters` e `financialReports`. Importação também aceita arrays antigos e aliases reconhecidos por `extractRecords()` e `parseBackup()`.

## Fluxo de persistência observado

No código original da Etapa 1, `persistData()` gravava cinco chaves em operações separadas: `STORAGE_KEY`, `TRASH_KEY`, `GOAL_KEY`, `RECEIPT_COUNTER_KEY` e `FINANCIAL_REPORTS_KEY`. Snapshots eram gravados separadamente por `setSnapshots()` em `SNAPSHOT_KEY`. `applyImportantChange()` chamava `pushSnapshot()`, executava a mutação, persistia e renderizava. A Etapa 2 adiciona recuperação coordenada sem mudar esses valores nem seus formatos. Todas as chaves continuam sujeitas à quota da mesma origem do navegador.

## Proteção adicionada na Etapa 2

O schema de dados e as seis chaves originais permanecem intactos. Uma chave auxiliar, `axis1_crm_v5_persistence_journal`, registra temporariamente os valores anteriores durante a gravação coordenada. Cada valor escrito é relido para conferência; o payload passa por verificações estruturais antes de ser salvo. Em falha, o código tenta restaurar as seis chaves e verifica a restauração. Se a página for interrompida com o diário presente, a inicialização tenta restaurar o estado anterior antes de carregar os registros. A chave auxiliar é removida após gravação confirmada ou recuperação concluída.

Erros de leitura, JSON inválido ou recuperação incompleta bloqueiam novas gravações para evitar que valores padrão substituam dados potencialmente recuperáveis. A chave auxiliar não muda o formato dos cadastros, snapshots ou backups.

## Referências no código

- Constantes e chaves: `script.js:1–20`.
- Normalização de registros e pagamentos: `script.js:244–436`.
- Leitura e normalização de armazenamento: `script.js:582–661`.
- Snapshot e persistência: `script.js:672–704`.
- Backup e importação: `script.js:1901–1950` e `script.js:2187–2244`.
