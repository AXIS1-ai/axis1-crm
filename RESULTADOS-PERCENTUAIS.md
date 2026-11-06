# Personalização das parcelas — entrega

## Alterações

- `index.html`: campos de percentual da 1ª e 2ª parcelas no formulário de cadastro/edição; aparecem somente para pagamento 2x.
- `script.js`: padrão 60/40, validação de soma igual a 100%, cálculo em centavos e preservação do valor de saldos já abertos.
- `README.md`: documentação da funcionalidade.
- `tests/regression.test.mjs`: testes automatizados adicionais, com dados sintéticos.

Os percentuais são campos opcionais do próprio cadastro. Cadastros sem esses campos, inclusive os antigos, continuam usando 60/40. O formato principal permanece no schema 5; não houve migração. Histórico de pagamentos, valores pagos e recibos existentes não são recalculados nem alterados.

## Verificações

- `node --check script.js`: aprovado.
- `node --test tests/regression.test.mjs`: 21 testes aprovados, 0 falhas.
- Divisões verificadas: 50/50, 60/40, 70/30 e 80/20, sobre valores inteiros e fracionários, incluindo R$ 0,01; as parcelas somadas preservam o total mensal em centavos.
- Verificados: padrão legado 60/40, rejeição de soma inválida, preservação de pagamento/recibo existentes, saldo parcial aberto após alteração percentual e transporte dos novos campos em backup/restauração.
- Também passaram os testes de regressão existentes para pagamentos, recibos, relatórios, pipeline, snapshots, lixeira, importação/exportação e recuperação de falha de persistência.

Não foi feita validação visual manual em navegador nesta execução. A cópia integral anterior da Etapa 2 está incluída em `backup-versao-anterior-etapa-2.zip` e não foi modificada.
