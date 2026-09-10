# Plano de migração para valores em centavos

## Objetivo

Armazenar valores monetários como inteiros em centavos no SQLite, mantendo a API e a
interface exibindo reais com duas casas decimais. A mudança reduz erros de soma e
comparação causados pela representação binária de números decimais.

## Colunas afetadas

Todas as colunas monetárias abaixo precisam ser migradas juntas:

- `categorias.limite`;
- `despesas.valor`;
- `orcamento.valor` (legado, mantido para referência);
- `orcamento_mensal.valor`;
- `entradas.valor`;
- `despesas_recorrentes.valor`.

## Estratégia segura

1. Criar backup criptografado e validar sua integridade.
2. Colocar a aplicação em manutenção durante a migração.
3. Criar tabelas temporárias com as colunas monetárias como `INTEGER`.
4. Copiar os dados usando `Math.round(valor * 100)`.
5. Conferir quantidade de registros, totais por usuário e valores extremos.
6. Substituir as tabelas somente depois de todas as conferências passarem.
7. Atualizar a API para converter reais recebidos em centavos antes de persistir e
   converter centavos para reais nas respostas.
8. Executar os testes de API, relatórios, orçamento, entradas e recorrentes.
9. Fazer uma segunda conferência dos totais antes/depois.

## Invariantes obrigatórias

- nenhum registro pode ser perdido;
- nenhum valor pode mudar além do arredondamento para duas casas;
- `SUM(valor)` em centavos deve preservar os totais financeiros;
- o saldo deve continuar sendo entradas menos despesas;
- pagamentos de recorrentes e avanço de parcelas não podem mudar;
- uma migração repetida não pode converter os valores novamente;
- o backup anterior deve permanecer disponível para rollback.

## Rollback

Se qualquer conferência falhar, interromper a migração, restaurar o banco anterior a
partir do backup validado e subir novamente o backend. A chave de criptografia deve
estar disponível no armazenamento seguro, separada do backup.

## Critério para produção

A migração só será aplicada depois que a rotina for testada em uma cópia do banco de
produção e todos os totais forem comparados automaticamente. A preparação atual não
altera o banco nem muda o formato da API.
