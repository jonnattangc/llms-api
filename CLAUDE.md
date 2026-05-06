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

This is an Express 5 API (Node 24, TypeScript ESM) that proxies requests to multiple LLM providers under a unified interface.

**Request flow:** `server.ts` → `routes/index.ts` → `routes/llm-<provider>.routes.ts` → `services/<provider>.service.ts`

All routes follow the same pattern:
- `GET /llm/<provider>` — lists available models for that provider
- `POST /llm/<provider>/:model` — sends a prompt; body is `{ type?, data: { prompt, assistantType? } }`
- Response is always `{ result: string }`

The `assistantType` field doubles as a system instruction: if set to `'chat'` (default), a hardcoded fun-assistant prompt is used; any other string is passed directly as the system instruction to the model.

**Providers and their SDKs:**

| Provider | Service file | SDK used |
|---|---|---|
| Gemini | `gemini.service.ts` | `@google/generative-ai` |
| OpenAI | `openai.service.ts` | `openai` (Responses API) |
| DeepSeek | `deepseek.service.ts` | `openai` with custom `baseURL` |
| Kimi | `kimi.service.ts` | `openai` with custom `baseURL` |

DeepSeek and Kimi reuse the OpenAI SDK via OpenAI-compatible endpoints.

**Gemini special case:** When `assistantType !== 'chat'`, `gemini.service.ts` fetches data from a Google Sheet (via `credentials.json` + `SHEETS_SPREADSHEET_ID`) and injects it into the prompt as context before calling the model.

## Environment variables

Required (one per provider used):
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `KIMI_API_KEY`

For the Gemini Sheets integration:
- `SHEETS_SPREADSHEET_ID`
- `credentials.json` — Google service account key file, mounted via Docker volume from `../envs/credentials-excel.json`

In Docker, env vars come from `../envs/llms.env`. The container exposes port `8065`.

## TypeScript notes

- Module system: `"module": "nodenext"` — imports must use `.ts` extensions explicitly (e.g. `import foo from './foo.ts'`)
- `ts-node` runs with `esm: true`
- Strict mode enabled; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are active
