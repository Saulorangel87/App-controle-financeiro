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
CREATE TABLE IF NOT EXISTS orcamento (
  usuario_id INTEGER PRIMARY KEY,
  valor REAL NOT NULL DEFAULT 0,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices para consultas mais rápidas filtrando por usuário
CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON categorias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_despesas_usuario ON despesas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);
