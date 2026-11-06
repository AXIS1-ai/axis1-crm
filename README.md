# CRM AXIS 1 v3 — Etapa 3

Aplicação em HTML, CSS e JavaScript puro, sem dependências externas. Os dados continuam armazenados no `localStorage` do navegador.

## Financeiro Avançado

- divisão da mensalidade em duas parcelas configurável por cliente, mantendo 60% + 40% como padrão;
- cálculo automático das parcelas a partir do valor mensal, com validação de soma exata de 100%;
- parcelas e saldos já registrados preservam os valores históricos quando a configuração do cliente muda;

- visão geral de receita prevista, recebida, em aberto e em atraso;
- status financeiro automático por cliente;
- pagamentos totais e parciais, com controle do saldo restante;
- vencimentos de hoje, próximos 7 e 30 dias, vencidos e sem data;
- seção de inadimplência com WhatsApp, cobrança, pagamento e recibos;
- histórico financeiro estruturado com valor, data, descrição e responsável;
- relatório mensal com exportação em arquivo profissional imprimível;
- filtros financeiros integrados aos Cadastros;
- indicadores financeiros resumidos no Dashboard.

## Pipeline Comercial

- sete etapas comerciais em colunas;
- origem, temperatura, próxima ação, próximo contato e motivo de perda;
- alertas para follow-ups atrasados, de hoje e dos próximos três dias;
- avanço e retorno rápido de etapa;
- mensagens de follow-up por etapa;
- ações de WhatsApp, conversão e perda;
- histórico comercial com data, tipo e descrição;
- filtros comerciais na aba Cadastros.

## Recibos de Pagamento

- registro detalhado do pagamento antes de confirmar;
- recibo profissional em PDF gerado localmente;
- número único no formato `AXIS1-REC-ANO-0001`;
- regeneração do mesmo pagamento sem trocar o número;
- dados do recibo preservados no pagamento, histórico financeiro e backup;
- mensagem pronta para envio manual por WhatsApp.

## Compatibilidade

Registros e pagamentos antigos são migrados automaticamente com valores padrão. As chaves anteriores do `localStorage`, snapshots, lixeira, backup universal, validações e fluxos da Etapa 1 permanecem compatíveis.

## Proteção de persistência

As gravações verificam a integridade do conteúdo, usam um diário temporário para recuperar gravações interrompidas e tentam restaurar os valores anteriores quando uma chave falha. Em caso de leitura inválida ou falha de recuperação, novas gravações ficam bloqueadas e o CRM informa o problema. O esquema v5 dos dados, os formatos de backup e as chaves operacionais existentes são preservados.

## Atualização recomendada

1. Exporte um backup da versão atual.
2. Substitua `index.html`, `style.css`, `script.js` e `README.md`.
3. Abra o CRM e confirme os dados existentes.
4. Teste um pagamento parcial, quite o saldo e gere os dois recibos.
5. Exporte um relatório mensal e um novo backup no formato da Etapa 3.
