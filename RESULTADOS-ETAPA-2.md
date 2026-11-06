# CRM AXIS 1 — Proteção de persistência (Etapa 2)

## Cópia de segurança da versão de entrada

Antes da implementação, a versão completa da Etapa 1 foi copiada para `backup-original/axis1-crm-main/` e compactada em `axis1-crm-etapa-1-integral.zip`. O SHA-256 do ZIP de referência é `49988dc6ed50e6c325ccec0abdc4b9eaaef0906353fc508e264dc1e3935a5bf6`.

## Estratégia implementada

- Mantidas `SCHEMA_VERSION = 5`, as seis chaves de estado atuais e o formato já usado por registros, pagamentos, snapshots e backups.
- `persistData()` valida a estrutura dos payloads antes de gravar.
- Antes de alterar as cinco chaves geridas por `persistData()` e o snapshot atual, um diário temporário guarda os valores anteriores; depois de cada gravação, o valor é relido e comparado.
- Em erro, o código tenta restaurar e verificar o conteúdo anterior. Se houver interrupção, a próxima inicialização encontra o diário e tenta recuperar antes de carregar a base.
- Falhas de leitura, dados ilegíveis ou recuperação não concluída bloqueiam novas gravações para evitar sobrescrita com valores padrão.
- `applyImportantChange()`, importação, restauração de snapshot, recibo, meta e cadastro revertem o estado em memória e evitam mensagens de sucesso quando o salvamento falha.
- A falha de persistência na inicialização é mostrada sem impedir que a interface abra.

## Testes

Comando: `node --test tests/regression.test.mjs`.

Resultado: **17 aprovados, 0 falhos**. `node --check script.js` também passou.

Inclui regressão sintética de cadastros, Pipeline, lixeira, pagamentos parciais/totais, recibos, relatórios, backup legado, mesclagem e snapshots; além de gravação íntegra, gravação parcial com rollback, retomada a partir de diário interrompido, falha de leitura e payload inválido. Os testes financeiros reproduzem somente o comportamento pré-existente; nenhuma lógica financeira foi modificada.

## Arquivos alterados/criados

- Modificado: `script.js`.
- Modificado: `README.md`.
- Modificado: `SCHEMA-ARMAZENAMENTO.md`.
- Criado: `tests/regression.test.mjs` (suíte completa ampliada).
- Criado: `RESULTADOS-ETAPA-2.md`.
- Criada antes das alterações: cópia integral de segurança em `backup-original/` e `axis1-crm-etapa-1-integral.zip`.

## Limitações conhecidas

- `localStorage` não oferece transação nativa. O diário permite rollback após falha e recuperação após interrupção, mas se o navegador bloquear simultaneamente gravações e restauração, a recuperação automática pode falhar; o diário é preservado e a interface avisa para não continuar alterando dados.
- A chave auxiliar do diário usa a mesma quota/origem do armazenamento. Uma quota totalmente esgotada pode impedir a criação do diário antes de qualquer chave operacional ser alterada; nesse caso, a operação falha antes de modificar os dados existentes.
- Os testes usam `localStorage` sintético com erros injetados e não simulam desligamento físico do navegador, quota real, perfil privado ou falhas específicas de cada implementação de browser.
- Não foram feitas alterações na lógica de ciclos, previsões, relatórios financeiros, interface visual ou fluxos além das mensagens de falha necessárias.

## Compatibilidade

O ZIP original da Etapa 1 permanece dentro do pacote sem alteração. Os campos de negócio, backups antigos, snapshots e recibos continuam sendo lidos pelos mesmos normalizadores e funções existentes. A nova chave de diário é somente metadado temporário de recuperação e não muda o schema v5 dos dados.
