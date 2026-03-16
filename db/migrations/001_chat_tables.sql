-- db/migrations/001_chat_tables.sql
-- Run this in Supabase SQL Editor

-- ─── Chat sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT        PRIMARY KEY,
  user_id     TEXT,
  title       TEXT        NOT NULL DEFAULT 'Nova conversa',
  summary     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- ─── Chat messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content      TEXT        NOT NULL,
  source_type  TEXT        NOT NULL DEFAULT 'none'
                           CHECK (source_type IN ('knowledge', 'database', 'hybrid', 'fallback', 'none')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ─── Chat feedback ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID        NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating IN (1, -1)),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Domain tables (if they don't exist yet) ─────────────────────────────────
-- Adjust columns to match your existing schema if these tables already exist.

CREATE TABLE IF NOT EXISTS candidatos (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo       TEXT        NOT NULL,
  email               TEXT,
  telefone            TEXT,
  status              TEXT        NOT NULL DEFAULT 'Novo',
  substatus           TEXT,
  profissao           TEXT,
  area_profissional   TEXT,
  nivel_alemao        TEXT,
  pais_origem         TEXT,
  proxima_etapa       TEXT,
  ultima_atualizacao  TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidatos_nome ON candidatos USING gin(to_tsvector('portuguese', nome_completo));

CREATE TABLE IF NOT EXISTS documentos_candidato (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID  NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
  nome_documento  TEXT  NOT NULL,
  status          TEXT  NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'enviado', 'aprovado', 'rejeitado')),
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empregadores (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT  NOT NULL,
  pais             TEXT,
  cidade           TEXT,
  setor            TEXT,
  status_parceria  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID        NOT NULL REFERENCES candidatos(id),
  employer_id   UUID        NOT NULL REFERENCES empregadores(id),
  status        TEXT        NOT NULL DEFAULT 'Em análise',
  data_match    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS (enable when using auth) ─────────────────────────────────────────────
-- ALTER TABLE chat_sessions  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_feedback  ENABLE ROW LEVEL SECURITY;
