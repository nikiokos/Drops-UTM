# Operations Copilot — Design Spec

**Date:** 2026-06-28
**Status:** Approved, ready for implementation
**Branch:** `feat/live-data-and-utm-safety`

## Summary

A natural-language **Operations Copilot** for the DROPS UTM platform: a tool-using
Claude agent that answers operator questions over the system's live data and can
**propose** (never auto-execute) operational actions, gated behind human
confirmation. It is the second AI agent in the platform after the Pre-Flight
Authorization Agent, and reuses the existing `ClaudeService` + native-fetch
Anthropic pattern.

## Goals

- Let operators ask, in Greek or English, questions like:
  - «ποιες πτήσεις είναι σε CAUTION τώρα;»
  - "which drones are below 40% battery?"
  - «δείξε μου τα active conflicts και τι προτείνεις»
- Surface answers from **live data** via the existing read-only REST/service layer.
- Let the agent **propose actions** (authorize/abort flight, resolve conflict,
  confirm emergency) rendered as confirmation buttons — execution only on click.
- Keep safety: the agent never performs writes; existing endpoints keep their guards.

## Non-Goals (v1)

- No autonomous writes by the agent.
- No multi-session memory / persistence of chat history server-side (chat lives in
  client state for v1).
- No voice. No streaming token-by-token (a single response with a tool trace is fine).
- Not exposing all ~100 GET endpoints — a curated tool set only.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Architecture | **Tool-use loop** (Anthropic function calling) |
| UI placement | **Floating chat widget** on all dashboard pages |
| Scope v1 | **Read-only Q&A + propose actions** (confirm-gated) |
| Autonomy | Read tools autonomous; actions human-confirmed (mixed model) |
| Language | **Auto-detect** (answer in the language of the question) |

## Architecture

```
Floating widget (chat)  ──POST /copilot/chat──▶  CopilotService
   │  ▲                                              │
   │  │ JSON reply (+ toolTrace, proposedActions)    ▼
   │  │                                    Claude tool-use loop
   │  │                                              │
   │  │  ┌───────────────────────────────────────────┤
   │  │  │ read tools  → call internal services (auto)│
   │  │  │ action tools → emit PROPOSAL (no execute)  │
   │  └──┴───────────────────────────────────────────┘
   ▼
Action proposal → confirmation button → calls the EXISTING write endpoint
```

The agent runs a loop: Claude requests tool calls → backend executes **read** tools
and returns results as `tool_result` → repeat until Claude emits a final text
answer. **Action** tools are not executed server-side; they are collected and
returned as structured proposals.

## Backend

### `ClaudeService` extension
Add `messageWithTools()` alongside the existing `messageJson()` (unchanged):

```ts
messageWithTools(opts: {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>;
  tools: AnthropicTool[];
  model?: string;
  maxTokens?: number;
  maxIterations?: number;          // default 6 — loop guard
  onToolCall: (name: string, input: Record<string, unknown>)
                => Promise<{ result?: unknown; proposal?: ProposedAction }>;
}): Promise<{ text: string; toolTrace: ToolTraceEntry[]; proposedActions: ProposedAction[] }>
```

- Sends `tools` in the Anthropic request. While `stop_reason === 'tool_use'`, for
  each `tool_use` block it calls `onToolCall`. A read tool returns `{ result }`,
  fed back as a `tool_result`. An action tool returns `{ proposal }`, collected and
  acknowledged to the model with a short `tool_result` ("proposed; awaiting operator
  confirmation") so the model can finish its turn.
- Caps iterations (default 6) and total time (reuse the 90s timeout pattern).
- Returns `null`-safe (no key → caller handles fallback).

### New `modules/copilot/`
- `copilot.tools.ts` — tool definitions (name, description, JSON-schema input) and a
  dispatcher mapping each tool to an internal **service** call (not HTTP self-call).
- `copilot.service.ts` — builds the system prompt, owns `onToolCall` dispatch,
  drives `messageWithTools`.
- `copilot.controller.ts` — `POST /api/v1/copilot/chat`
  - body: `{ messages: Array<{role, content}> }`
  - returns: `{ reply: string, toolTrace: ToolTraceEntry[], proposedActions: ProposedAction[], enabled: boolean, model: string }`
- `copilot.module.ts` — imports the modules whose services back the tools
  (Flights, Drones, Hubs, Fleet, Conflicts, Emergency, Weather, Notam, Adsb,
  Briefing, Airspace, Ai).

### Tools (curated)

**Read (auto-exec):**
`list_flights`, `get_flight`, `list_drones`, `list_hubs`, `fleet_overview`,
`active_conflicts`, `emergency_incidents`, `weather_go_no_go`, `get_notams`,
`live_traffic`, `flight_briefing`.

**Action proposals (confirm-gated):**
`propose_authorize_flight` → `POST /flights/:id/authorize`
`propose_abort_flight` → `POST /flights/:id/abort`
`propose_resolve_conflict` → `POST /conflicts/:id/resolve`
`propose_confirm_emergency` → `POST /emergency/incidents/:id/confirm`

A `ProposedAction` is `{ kind, label, method, path, body?, rationale }` — enough for
the frontend to render a button and call the real endpoint.

## Frontend

- `components/copilot/copilot-widget.tsx` — floating button (bottom-right), mounted
  in `app/dashboard/layout.tsx`; opens a chat panel.
- Chat state in component/local store (no server persistence v1).
- Renders: messages, a collapsible **tool trace** ("called list_flights, weather_go_no_go…"),
  and **action proposal cards** with a Confirm button.
- Confirm → calls the existing endpoint via `api` → toast result → optional follow-up.
- `copilotApi.chat()` + types in `lib/api.ts`.

## Guardrails / Safety

- Read tools are read-only and autonomous.
- No write is performed by the agent; only proposal → human confirm → existing
  endpoint (which keeps its own guards, e.g. the weather gate on authorize).
- Tool dispatch runs with the caller's auth context / role; the agent cannot surface
  data the user is not entitled to.
- Loop iteration cap + timeout. Missing `ANTHROPIC_API_KEY` → graceful disabled state.

## Build Sequence

1. `ClaudeService.messageWithTools()` + unit test (mock fetch; assert loop, trace,
   proposals).
2. `copilot.tools.ts` (read tools) + `copilot.service.ts` loop dispatch.
3. `POST /copilot/chat` + live curl test (Greek + English questions).
4. Floating widget + chat UI (read-only first), verify live.
5. Action proposals + confirm flow.
6. End-to-end verification (puppeteer): a Greek question, a tool trace, an action
   proposal confirmed.

## Verification

- Unit: `messageWithTools` loop terminates, aggregates trace + proposals.
- Live: curl `/copilot/chat` returns grounded answers citing real flights/weather.
- E2E: widget answers «ποιες πτήσεις είναι ενεργές;» from live data; proposes an
  authorize action that, on confirm, hits the real endpoint.

## Future (not v1)

Conflict Resolution Advisor, Emergency Triage, Fleet Rebalancer, Weather/SIGMET
triage, After-Action reports — each reusing `messageWithTools` + the tool registry.
