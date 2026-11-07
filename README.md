# AI Gateway's tool loop replays Gemini 3 function calls without their thought signatures

When a Gemini 3 model calls a gateway-executed tool (`gateway.tools.parallelSearch` or `gateway.tools.exaSearch`), AI Gateway runs the search and calls the model again with the results. In that second call, the model's own function call goes back without its thought signature. The gateway's Google provider then injects `skip_thought_signature_validator`, which Google says "should be a last resort as it will negatively impact model performance", and every such call returns this warning. It happens inside a single `generateText` call, with no messages persisted or rebuilt by the application.

## Reproduction

You need Node 22 or newer and an AI Gateway key (`AI_GATEWAY_API_KEY`) or a Vercel OIDC token (`VERCEL_OIDC_TOKEN`). Each `repro` run costs about half a cent (one search plus a few hundred Gemini tokens). `control` costs well under a tenth of a cent.

```sh
npm ci
AI_GATEWAY_API_KEY=... npm run repro
AI_GATEWAY_API_KEY=... npm run control
```

`npm run repro` makes one `generateText` call with `google/gemini-3.8-flash` and `gateway.tools.parallelSearch({ maxResults: 3 })`. It exits 1 when a thought signature warning comes back:

```
model: google/gemini-3.8-flash
steps: 1, model calls: vertex (leg 0), vertex (leg 1)
tool call web_search (executed by gateway) came back signed under: googleVertex, vertex
thought signature warnings: 1
  Replayed 1 `functionCall` part(s) for a Gemini 3 model without a `thoughtSignature` (tools: `web_search`). Injected the documented `skip_thought_signature_validator` sentinel to keep the request from failing with HTTP 400. The likely cause is application code that drops `providerOptions.google.thoughtSignature` when persisting or serializing assistant tool-call messages. See https://ai.google.dev/gemini-api/docs/thought-signatures.
answer: Argentina won the 2022 FIFA World Cup final, defeating France 4–2 on penalties after a 3–3 draw.
FAIL: a function call was replayed to Gemini 3 without its thought signature
```

`TOOL=exa npm run repro` runs the same check with `gateway.tools.exaSearch`.

`npm run control` uses the same model and gateway with a tool the client executes, so the AI SDK runs the loop. The signature survives:

```
model: google/gemini-3.8-flash
steps: 2, model calls: vertex, vertex
tool call get_weather (executed by client) came back signed under: googleVertex, vertex
thought signature warnings: 0
answer: It is currently sunny and 22°C in Lisbon.
OK: every function call was replayed with its thought signature
```

## Expected

The gateway replays each function call to Gemini with the thought signature the model returned for it, as the AI SDK's own loop does, and the call returns no warning.

## Actual

- The client sends a single request. The warning arrives in the gateway response's `warnings` (`doGenerate` in `packages/gateway/src/gateway-language-model.ts` passes `responseBody.warnings` through). Its text comes from `convertToGoogleMessages` in `packages/google/src/convert-to-google-messages.ts`, which injects the sentinel when an assistant `tool-call` part for a Gemini 3 model has no `thoughtSignature` in its `providerOptions`. The gateway runs that code when it builds the prompt for the leg after the search.
- The gateway has the signature. The search's `tool-call` part it returns to the client carries `providerMetadata.google.thoughtSignature` on the Google route, and `googleVertex`/`vertex` on the Vertex route. It just isn't sent back as that part's `providerOptions` in the next leg. The AI SDK's own loop does that (`toResponseMessages` in `packages/ai/src/generate-text/to-response-messages.ts` sets `providerOptions: part.providerMetadata`), which is why `control` passes.
- With two searches in a row, the last leg replays both calls unsigned ("Replayed 2").
- It happens on the Google and Vertex routes, with `parallelSearch` and `exaSearch`. I saw it with our own provider keys (BYOK) and didn't test the gateway's own credentials.
- `streamText` logs no warning. That doesn't show the signature survives: the AI SDK reads a streamed step's warnings from its `stream-start` event, which probably arrives before the leg that replays the call.

## Environment

- `ai` 7.0.164 (latest), `@ai-sdk/gateway` 4.0.137 (latest)
- Node 24.22.0, npm 11.19.1, macOS 27.2
- Checked on 7 Nov 2026
