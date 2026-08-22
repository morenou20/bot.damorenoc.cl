# bot.damorenoc.cl

Microservicio de IA aislado que sirve el chatbot público de `damorenoc.cl`
(Matty) y las traducciones i18n del sitio. Habla con **OpenCode Zen**
(modelo principal `big-pickle`) mediante una cadena de fallback de modelos.

Diseñado para **no tener acceso** a PostgreSQL ni valkey: solo recibe texto
sanitizado desde la API y devuelve texto. Toda la lógica de perfiles,
personalización y persistencia vive en `api.damorenoc.cl`.

## Stack

- Node.js + TypeScript (compilado con `tsc`, sin framework pesado)
- Fastify mínimo
- Vitest (tests unitarios) + Biome (lint/format)

## Endpoints

Todos requieren `Authorization: Bearer <BOT_INTERNAL_KEY>` excepto los probes:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/healthz` | Liveness (`{ ok: true }`) |
| GET | `/readyz` | Readiness |
| POST | `/v1/chat` | Chat conversacional; body `{ messages, system??, model? }` → `{ text, model }` |
| POST | `/v1/json` | Igual pero exige salida JSON válida del modelo |

## Cadena de fallback de modelos

Si el modelo principal responde `429` (cuota) o error 5xx, se reintenta
automáticamente con los siguientes de la lista hasta agotarla; el error final
viaja explícito para que la API caiga a Gemini.

## Variables de entorno

Ver `.env.example`:

- `HOST` / `PORT` — bind del servidor (`0.0.0.0:8080` dentro del contenedor)
- `BOT_INTERNAL_KEY` — token que presenta la API de damorenoc.cl
- `OPENCODE_API_KEY` — clave de OpenCode Zen
- `OPENCODE_BASE_URL` — por defecto `https://opencode.ai/zen/v1`
- `OPENCODE_MODEL` — por defecto `big-pickle`
- `REQUEST_TIMEOUT_MS` / `MAX_OUTPUT_TOKENS`

## Desarrollo

```bash
npm ci
npm run dev        # tsx watch
npm test           # vitest run
npm run lint       # biome check src/ test/
npm run build && npm start
```

## Despliegue (as-built, servidor LAN)

Código en `/opt/bot.damorenoc.cl`, imagen `localhost/bot-damorenoc:latest`,
contenedor `bot-damorenoc` publicado solo en loopback:

```bash
podman build -t localhost/bot-damorenoc:latest .
podman run -d --name bot-damorenoc --restart always \
  -p 127.0.0.1:18010:8080 \
  --env-file .env \
  localhost/bot-damorenoc:latest
```

La API lo consume vía `BOT_API_URL=http://127.0.0.1:18010` (variable en el
`.env` de la API). Verificación rápida:

```bash
curl -fsS http://127.0.0.1:18010/healthz
curl -fsS -X POST http://127.0.0.1:18010/v1/chat \
  -H "Authorization: Bearer $BOT_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"ping"}]}'
```
