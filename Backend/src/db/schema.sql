-- Schema do banco de dados - Controle de Despesas
-- SQLite

-- Usuários (login será implementado depois, mas a tabela já existe)
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categorias (cada categoria pertence a um usuário e tem um limite de orçamento)
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  icone TEXT NOT NULL DEFAULT 'circle',
  cor TEXT NOT NULL DEFAULT '#c8f000',
  limite REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Despesas (cada despesa pertence a um usuário e a uma categoria)
CREATE TABLE IF NOT EXISTS despesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  categoria_id INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
);

-- Orçamento total definido manualmente pelo usuário (independente da soma
-- dos limites de categoria — o usuário decide quanto tem pra gastar no mês)
-- Tabela antiga, mantida só pra migração automática pro orcamento_mensal
-- (ver db/index.js). Não é mais lida nem escrita por nenhuma rota.
CREATE TABLE IF NOT EXISTS orcamento (
  usuario_id INTEGER PRIMARY KEY,
  valor REAL NOT NULL DEFAULT 0,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Orçamento total por mês. A chave inclui o mês, então um mês novo sempre
-- começa sem linha (valor 0 na prática, via garantirOrcamento) — resolve o
-- problema do valor "disponível" ficar preso no valor do mês anterior.
CREATE TABLE IF NOT EXISTS orcamento_mensal (
  usuario_id INTEGER NOT NULL,
  mes TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, mes),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Entradas de dinheiro extra além do orçamento base do mês (ex: bônus,
-- freela, reembolso). Cada entrada soma automaticamente no orçamento do
-- mês da sua data e fica guardada com origem/descrição pra consulta.
CREATE TABLE IF NOT EXISTS entradas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  origem TEXT NOT NULL,
  descricao TEXT,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_entradas_usuario_data ON entradas(usuario_id, data DESC);

-- Despesas recorrentes/fixas (luz, água, internet...): funciona como uma
-- anotação permanente pra não esquecer contas fixas — não fica presa a
-- nenhum mês e não é apagada sozinha. O campo pago_mes guarda em qual mês
-- (YYYY-MM) ela foi marcada como paga, então o checkbox "paga este mês"
-- reseta sozinho quando o mês vira, sem precisar de nenhum job/migração.
-- pago_mes guarda em qual mês (YYYY-MM) foi marcada como paga, então o
-- checkbox "paga este mês" reseta sozinho quando o mês vira, sem precisar
-- de nenhum job/migração.
--
-- parcela_total + parcela_mes_inicio controlam prestações (ex: geladeira em
-- 12x): quando parcela_total é definido, "valor" é o valor de CADA parcela,
-- e a parcela atual (1/12, 2/12...) é CALCULADA a partir da diferença entre
-- o mês corrente e parcela_mes_inicio — não é um contador salvo, então
-- avança sozinha quando o mês vira, do mesmo jeito que pago_mes.
CREATE TABLE IF NOT EXISTS despesas_recorrentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL,
  dia_vencimento INTEGER,
  observacao TEXT,
  pago_mes TEXT,
  pago_em TEXT,
  parcela_total INTEGER,
  parcela_mes_inicio TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recorrentes_usuario ON despesas_recorrentes(usuario_id);

-- Índices para consultas mais rápidas filtrando por usuário
CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON categorias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_despesas_usuario ON despesas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);
-- Índice composto: cobre a consulta mais comum do sistema (filtrar despesas
-- de um usuário e ordenar por data), usada em quase toda tela do app.
CREATE INDEX IF NOT EXISTS idx_despesas_usuario_data ON despesas(usuario_id, data DESC);

-- Tokens temporários de uso único: confirmação de email no cadastro e
-- recuperação de senha esquecida. Cada token vale só pra um propósito
-- (coluna "tipo"), expira sozinho e não pode ser reutilizado (coluna "usado").
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('verificacao_email', 'recuperacao_senha')),
  expira_em TEXT NOT NULL,
  usado INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_usuario ON tokens(usuario_id);
