# CRM AXIS 1 v3 — Etapa 1

Aplicação em HTML, CSS e JavaScript puro, sem dependências externas. Os dados continuam armazenados no `localStorage` do navegador.

## Melhorias desta etapa

- snapshots completos criados antes de alterações importantes;
- histórico com até 10 versões anteriores e restauração individual;
- backup com `schemaVersion`, `exportedAt`, `records`, `trash`, `monthlyGoal` e `snapshots`;
- importação compatível com backups antigos;
- opções para substituir ou mesclar dados;
- prevenção de duplicados por telefone, CPF/CNPJ ou e-mail;
- normalização e validação real de CPF e CNPJ;
- proteção de textos renderizados na interface;
- organização em Dashboard, Cadastros e Backup e Segurança.

## Atualização recomendada

1. Abra a versão atual do CRM.
2. Exporte um backup antes de publicar os novos arquivos.
3. Substitua `index.html`, `style.css`, `script.js` e `README.md`.
4. Abra o CRM e confirme se os cadastros existentes foram carregados.
5. Exporte um novo backup no formato v3.

As chaves anteriores do `localStorage` continuam reconhecidas para preservar a base existente.
