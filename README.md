# CRM AXIS 1 v3 — Etapa 2

Aplicação em HTML, CSS e JavaScript puro, sem dependências externas. Os dados continuam armazenados no `localStorage` do navegador.

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

## Atualização recomendada

1. Exporte um backup da versão atual.
2. Substitua `index.html`, `style.css`, `script.js` e `README.md`.
3. Abra o CRM e confirme os dados existentes.
4. Teste um pagamento e gere um recibo.
5. Exporte um novo backup no formato da Etapa 2.
