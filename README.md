# LLMs API

API unificada que actúa como proxy hacia múltiples proveedores de modelos de lenguaje (LLMs), exponiendo una interfaz consistente independiente del proveedor.

> Desarrollado con **Node 24**, **TypeScript ESM** y **Express 5**. Desplegado vía Docker en el puerto `8065`.

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Flujo de petición](#flujo-de-petición)
- [Proveedores y modelos](#proveedores-y-modelos)
- [Referencia de endpoints](#referencia-de-endpoints)
- [Variables de entorno](#variables-de-entorno)
- [Instalación y ejecución](#instalación-y-ejecución)

---

## Arquitectura

```mermaid
graph TD
    Client["Cliente HTTP"]

    subgraph API["LLMs API — Express 5"]
        Server["server.ts\nCORS · JSON · Puerto 8065"]
        Router["routes/index.ts\n/llm"]

        subgraph Routes["Rutas por proveedor"]
            R1["llm-gemini.routes.ts"]
            R2["llm-openai.routes.ts"]
            R3["llm-deepseek.routes.ts"]
            R4["llm-kimi.routes.ts"]
        end

        subgraph Services["Servicios"]
            S1["gemini.service.ts"]
            S2["openai.service.ts"]
            S3["deepseek.service.ts"]
            S4["kimi.service.ts"]
            S5["sheets.service.ts\n(utilitario compartido)"]
        end
    end

    subgraph Providers["Proveedores externos"]
        P1["Google Gemini API"]
        P2["OpenAI API"]
        P3["DeepSeek API"]
        P4["Moonshot / Kimi API"]
        P5["Google Sheets API"]
    end

    Client -->|"POST /llm/&lt;provider&gt;/:model"| Server
    Server --> Router
    Router --> R1 & R2 & R3 & R4
    R1 --> S1
    R2 --> S2
    R3 --> S3
    R4 --> S4
    S1 & S2 & S3 & S4 -->|"assistantType ≠ chat"| S5
    S1 --> P1
    S2 --> P2
    S3 --> P3
    S4 --> P4
    S5 --> P5
```

---

## Flujo de petición

### Modo `chat` (por defecto)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant R as Route
    participant S as Service
    participant P as Proveedor LLM

    C->>R: POST /llm/<provider>/:model
    Note over C,R: { data: { prompt, assistantType: "chat" } }
    R->>R: Valida que exista data.prompt
    R->>S: generateContent(prompt, model, "chat")
    S->>S: systemInstruction = "Eres un asistente divertido"
    S->>P: Envía prompt al modelo
    P-->>S: Respuesta del modelo
    S-->>R: texto generado
    R-->>C: { result: "..." }
```

### Modo con contexto de Google Sheets

Cuando `assistantType` es distinto de `"chat"`, el valor se usa como instrucción de sistema y el prompt se enriquece automáticamente con los datos de la planilla Google Sheets configurada.

```mermaid
sequenceDiagram
    participant C as Cliente
    participant R as Route
    participant S as Service
    participant SH as sheets.service
    participant GS as Google Sheets API
    participant P as Proveedor LLM

    C->>R: POST /llm/<provider>/:model
    Note over C,R: { data: { prompt, assistantType: "contabilidad" } }
    R->>S: generateContent(prompt, model, "contabilidad")
    S->>SH: buildSheetsPrompt(prompt)
    SH->>GS: spreadsheets.get (metadata)
    GS-->>SH: lista de hojas
    loop Por cada hoja
        SH->>GS: values.get (rango A:Z)
        GS-->>SH: filas de datos
    end
    SH-->>S: prompt enriquecido con contexto
    S->>P: systemInstruction="contabilidad" + prompt con datos
    P-->>S: Respuesta contextualizada
    S-->>R: texto generado
    R-->>C: { result: "..." }
```

---

## Proveedores y modelos

| Proveedor | Prefijo de ruta | Modelos disponibles | SDK |
|-----------|----------------|---------------------|-----|
| **Gemini** | `/llm/gemini` | `gemini-2.0-flash` · `gemini-2.0-flash-lite` · `gemini-2.5-pro-preview-05-06` | `@google/generative-ai` |
| **OpenAI** | `/llm/openai` | `gpt-4o` · `gpt-4o-mini` · `o4-mini` | `openai` (Responses API) |
| **DeepSeek** | `/llm/deepseek` | `deepseek-chat` · `deepseek-reasoner` | `openai` + baseURL custom |
| **Kimi** | `/llm/kimi` | `moonshot-v1-8k` · `moonshot-v1-32k` · `moonshot-v1-128k` | `openai` + baseURL custom |

---

## Referencia de endpoints

### `GET /`

Retorna el estado del servidor y los proveedores registrados.

**Respuesta**
```json
{
  "status": "ok",
  "providers": ["gemini", "openai", "kimi", "deepseek"]
}
```

---

### `GET /llm/{provider}`

Lista los modelos disponibles para el proveedor indicado.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `provider` | path | `gemini` \| `openai` \| `deepseek` \| `kimi` |

**Ejemplo — `GET /llm/gemini`**
```json
{
  "provider": "gemini",
  "models": ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-pro-preview-05-06"]
}
```

**Ejemplo — `GET /llm/openai`**
```json
{
  "provider": "openai",
  "models": ["gpt-4o", "gpt-4o-mini", "o4-mini"]
}
```

**Ejemplo — `GET /llm/deepseek`**
```json
{
  "provider": "deepseek",
  "models": ["deepseek-chat", "deepseek-reasoner"]
}
```

**Ejemplo — `GET /llm/kimi`**
```json
{
  "provider": "kimi",
  "models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]
}
```

---

### `POST /llm/{provider}/{model}`

Envía un prompt al modelo especificado y retorna la respuesta generada.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `provider` | path | `gemini` \| `openai` \| `deepseek` \| `kimi` |
| `model` | path | Identificador del modelo (ver tabla de modelos disponibles) |

**Cuerpo de la petición**

```jsonc
{
  "type": "encripted",       // opcional — reservado para futura lógica de desencriptado
  "data": {
    "prompt": "string",      // requerido — pregunta o instrucción para el modelo
    "assistantType": "string" // opcional — controla el comportamiento del asistente (ver abajo)
  }
}
```

**Campo `assistantType`**

| Valor | Comportamiento |
|-------|---------------|
| `"chat"` (default) | Usa instrucción de sistema predeterminada: *"Eres un asistente de chat, respondes de forma divertida"* |
| Cualquier otro string | El valor se usa directamente como instrucción de sistema. Además, el prompt se enriquece automáticamente con el contexto de la planilla Google Sheets configurada. |

**Respuesta exitosa — `200 OK`**
```json
{
  "result": "Texto generado por el modelo..."
}
```

**Error de validación — `400 Bad Request`**
```json
{
  "error": "El campo \"prompt\" es requerido."
}
```

**Error del proveedor — `500 Internal Server Error`**
```json
{
  "error": "Error al generar el contenido."
}
```

**Ejemplo — modo chat**
```bash
curl -X POST http://localhost:8065/llm/gemini/gemini-2.0-flash \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "prompt": "¿Cuál es la capital de Francia?"
    }
  }'
```

**Ejemplo — modo con contexto de planilla**
```bash
curl -X POST http://localhost:8065/llm/deepseek/deepseek-chat \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "prompt": "¿Cuánto se recaudó en total el mes pasado?",
      "assistantType": "Eres un asistente contable experto, responde de forma precisa y concisa."
    }
  }'
```

---

## Variables de entorno

Crea el archivo `../envs/llms.env` relativo a la raíz del repositorio (usado por Docker Compose):

```env
# Claves de proveedores (incluir solo las que se vayan a usar)
GEMINI_API_KEY=...
OPENAI_API_KEY=...
DEEPSEEK_API_KEY=...
KIMI_API_KEY=...

# Integración Google Sheets (requerido para assistantType != "chat")
SHEETS_SPREADSHEET_ID=...
```

Adicionalmente, coloca el archivo de cuenta de servicio de Google en `../envs/credentials-excel.json`. Docker lo monta en el contenedor como `credentials.json`.

---

## Instalación y ejecución

### Con Docker (recomendado)

```bash
docker compose up --build
```

La API quedará disponible en `http://localhost:8065`.

### Desarrollo local

```bash
cd app
npm install
npm run dev      # hot reload con ts-node
```

La API quedará disponible en `http://localhost:3000`.

### Otros comandos

```bash
npm start        # sin hot reload
npm run build    # type-check y compilación TypeScript
```
