# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `app/` directory:

```bash
# Development (with hot reload)
npm run dev

# Run without hot reload
npm start

# Type-check / compile
npm run build
```

Docker:
```bash
docker compose up --build
```

## Architecture

This is an Express 5 API (Node 24, TypeScript ESM) that proxies requests to multiple LLM providers under a unified interface, optionally enriching prompts with context from a RAG-API.

**Request flow:** `server.ts` → `routes/index.ts` → `routes/{llm,rag}.routes.ts` → `controllers/*.controller.ts` → `services/*` → `providers/*`

**Controllers are provider-agnostic** — they only validate, delegate and respond. No business logic in controllers or routes.

Endpoints (backward compatible — existing clients must keep working):
- `GET /llm/:provider` — lists models; `POST /llm/:provider/:model` — body `{ type?, data: { prompt, assistantType?, isRAG?, systemId? } }`, response `{ result }`
- `POST /rag/reload[?systemId=]` — blocking reload of all dynamic files; 429 + `Retry-After` while running and for `RAG_RELOAD_COOLDOWN_SECONDS` (default 10) afterwards (`services/rag-reload.service.ts`)

`assistantType`: `'chat'` (default) → the provider's `defaultInstruction` (Gemini formal, others fun); any other string is the system instruction.

**Providers** (`providers/`): every LLM implements `LlmProvider { name, models, defaultInstruction, generate({ model, system, prompt }) }` and is registered in `providers/index.ts`. OpenAI-compatible APIs (DeepSeek, Kimi, Grok, Mistral, Qwen, Groq, Ollama) use the `createOpenAICompatibleProvider` factory; OpenAI (Responses API, includes codex), Gemini and Claude (`@anthropic-ai/sdk`) are native. Clients are created lazily — a missing API key returns 503 on that provider only (`ProviderNotConfiguredError`), it must never crash the API. The model in the URL is passed through as-is (the models list is informative).

**RAG** (`services/chat.service.ts`): `useRag = isRAG ?? Boolean(systemId ?? RAG_SYSTEM_ID)` (absent `isRAG` keeps the pre-existing behavior). When used: `ensureFresh(systemId)` (`services/rag-sync.service.ts`) then `buildRagPrompt()` (`services/rag.service.ts`, RAG-API `GET /api/v1/systems/{systemId}/context`, header `X-API-Key`). Any RAG/sync failure is logged and the request continues. RAG-API spec: `http://192.168.1.71:5000/openapi.yaml`.

**Dynamic files registry** (MySQL schema `llm_manager`, DDL in `app/sql/001_rag_registry.sql` + `002_rag_sources_checksum.sql`, repos in `db/`): `rag_sources` (type, reference, system_id, remote_checksum) and `rag_files` (filename, md5sum, size_bytes, origin, system_id, rag_document_id, created_at, last_indexed_at, update_count, metadata JSON). Sync per source: before processing anything, `getChecksum()` = md5 of the whole source in one light call; equal to `remote_checksum` → nothing is downloaded (same for `/rag/reload`; on failure falls back to download; saved only when every file synced without errors) → `listFiles()` → per file md5 vs registry: new → index (`created`), different md5 → re-index (`updated`, `update_count+1`), same → no RAG call (`unchanged`); registry files missing from the source → deleted from RAG and registry. MySQL being down must not break requests.

**Sources** (`services/sources/`): each type implements `DynamicSource { getChecksum, listFiles }`. `google-sheet`: checksum = md5 of one `spreadsheets.get` (titles, merges, formatted values; xlsx export md5 is useless, it changes on every download); each tab is downloaded as CSV (export endpoint, `drive.readonly` scope, retries on 429) → split into blocks (XY-cut on empty rows/cols, merged cells count as filled; side-by-side tables become sections one below another) → Markdown records `- **Label:** value`, one blank line between records, no tables (`sheetToMarkdown`) → one file `<spreadsheet>_<tab>.md` (spaces → `_`). The whole spreadsheet is never uploaded (the RAG-API rejects `.xlsx`/`.csv`). `SHEETS_SPREADSHEET_ID` + `RAG_SYSTEM_ID` are auto-registered as a source at startup.

## Environment variables

Providers (only the ones used): `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `KIMI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `QWEN_API_KEY`, `GROQ_API_KEY`, `OLLAMA_BASE_URL` (optional).

RAG-API: `RAG_API_URL`, `RAG_SYSTEM_ID`, `RAG_API_KEY`, `RAG_API_KEYS` (optional JSON map `{ "<system_id>": "<api_key>" }`), `RAG_TOP_K` (optional, default 10), `RAG_RELOAD_COOLDOWN_SECONDS` (optional, default 10).

MySQL registry: `HOST_BD`, `PORT_BD`, `USER_BD`, `PASS_BD`, `SCHEMA_BD` (default `llm_manager`). Never commit credentials.

Sheets: `SHEETS_SPREADSHEET_ID`; `credentials.json` — Google service account key file, mounted via Docker volume from `../envs/credentials-excel.json`.

In Docker, env vars come from `../envs/llms.env`. The container exposes port `8065`.

## TypeScript notes

- Module system: `"module": "nodenext"` — imports must use `.ts` extensions explicitly (e.g. `import foo from './foo.ts'`)
- `ts-node` runs with `esm: true`
- Strict mode enabled; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are active
- No TypeScript parameter properties (`constructor(readonly x)`) — Node's type-stripping mode rejects them
