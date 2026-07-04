-- ============================================================================
-- HUISHOEK — 0069: assistent chat-persistentie (AI-4, plan 24 ronde C)
-- ============================================================================
-- 0068 zette de tabellen; deze migratie maakt ze klaar voor de conversatielijst:
-- updated_at op conversations (sortering "recentste gesprek boven") + index.
-- De edge function bumpt updated_at bij elke beurt (server-side schrijfpad).

alter table public.assistant_conversations
  add column if not exists updated_at timestamptz not null default now();

create index if not exists assistant_conversations_recent_idx
  on public.assistant_conversations(created_by, updated_at desc);
