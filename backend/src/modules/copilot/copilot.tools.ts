import type { AnthropicTool } from '../ai/claude.service';

/**
 * Curated tool set for the Operations Copilot. Read tools are executed server-side
 * against internal services; `propose_*` tools are NOT executed — they return a
 * confirm-gated action proposal that the operator approves in the UI.
 */
export const COPILOT_TOOLS: AnthropicTool[] = [
  {
    name: 'list_flights',
    description:
      'List flights with optional filters. Use to answer questions about flights by status (planned, authorized, active, completed, aborted, cancelled) or hub.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by flight status' },
        hubId: { type: 'string', description: 'Filter by departure hub id' },
      },
    },
  },
  {
    name: 'get_flight',
    description: 'Get full details for a single flight by its id.',
    input_schema: {
      type: 'object',
      properties: { flightId: { type: 'string' } },
      required: ['flightId'],
    },
  },
  {
    name: 'list_drones',
    description:
      'List the drone fleet with operational status (available, in-flight, charging, maintenance) and assigned hub. Note: live battery level is not available from this tool.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_hubs',
    description: 'List all hubs (code, name, id, location, status). Use to resolve hub codes to ids.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'fleet_overview',
    description: 'Aggregate fleet state across hubs: counts of available/in-flight/charging/maintenance drones.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'active_conflicts',
    description: 'List currently active airspace conflicts between flights, with severity and the flights involved.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'emergency_incidents',
    description: 'List emergency incidents (low battery, lost signal, geofence breach, etc.). Set activeOnly to focus on open ones.',
    input_schema: {
      type: 'object',
      properties: { activeOnly: { type: 'boolean', description: 'Only active/pending/executing incidents' } },
    },
  },
  {
    name: 'weather_go_no_go',
    description:
      'Get the GO / CAUTION / NO_GO flight-weather recommendation for a hub (from live METAR + SIGMET). Accepts a hub code (e.g. ATH-HUB), name, or id.',
    input_schema: {
      type: 'object',
      properties: { hub: { type: 'string', description: 'Hub code, name, or id' } },
      required: ['hub'],
    },
  },
  {
    name: 'get_notams',
    description: 'Get active NOTAMs for the Athinai FIR (live, classified by significance). Use for airspace restrictions/danger areas.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'live_traffic',
    description: 'Summary of live manned aircraft (ADS-B) currently over Greece: count and a sample of nearby low-altitude traffic.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'flight_briefing',
    description:
      'Run the composed pre-flight briefing for a flight (weather + airspace + live traffic + NOTAM) and return its GREEN/AMBER/RED verdict.',
    input_schema: {
      type: 'object',
      properties: { flightId: { type: 'string' } },
      required: ['flightId'],
    },
  },

  // ── Action proposals (NOT executed — operator confirms in the UI) ──
  {
    name: 'propose_authorize_flight',
    description:
      'Propose authorizing a flight for departure. Does NOT execute — the operator must confirm. Provide a brief rationale grounded in the evidence you gathered.',
    input_schema: {
      type: 'object',
      properties: {
        flightId: { type: 'string' },
        rationale: { type: 'string', description: 'Why this is safe to authorize' },
      },
      required: ['flightId', 'rationale'],
    },
  },
  {
    name: 'propose_abort_flight',
    description: 'Propose aborting an active flight. Does NOT execute — the operator must confirm. Provide a rationale.',
    input_schema: {
      type: 'object',
      properties: {
        flightId: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['flightId', 'rationale'],
    },
  },
  {
    name: 'propose_resolve_conflict',
    description: 'Propose marking an airspace conflict as resolved. Does NOT execute — the operator must confirm. Provide a rationale.',
    input_schema: {
      type: 'object',
      properties: {
        conflictId: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['conflictId', 'rationale'],
    },
  },
  {
    name: 'propose_confirm_emergency',
    description: 'Propose confirming the recommended response to an emergency incident. Does NOT execute — the operator must confirm. Provide a rationale.',
    input_schema: {
      type: 'object',
      properties: {
        incidentId: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['incidentId', 'rationale'],
    },
  },
];

export const COPILOT_SYSTEM = [
  'You are the Operations Copilot for DROPS UTM, a Greek drone Unmanned Traffic Management system.',
  'Answer the operator\'s questions about the live state of the system by calling the provided read tools.',
  'Ground every claim in tool results — never invent flights, drones, weather, or NOTAMs. If a tool returns nothing, say so.',
  'Be concise and operational. Prefer short answers, lists, and concrete identifiers (flight numbers, hub codes).',
  'Reply in the SAME language the operator used (Greek or English).',
  'You may PROPOSE actions with the propose_* tools when the operator asks to act or when it is the clear next step, but you never execute them — the operator confirms in the UI. Always gather supporting evidence first and cite it in the rationale.',
  'For safety-critical proposals (authorize/abort), only propose when the evidence supports it; otherwise explain what is blocking.',
].join(' ');
