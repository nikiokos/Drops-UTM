import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClaudeService,
  type ProposedAction,
  type ToolDispatchResult,
} from '../ai/claude.service';
import { FlightsService } from '../flights/flights.service';
import { DronesService } from '../drones/drones.service';
import { HubsService } from '../hubs/hubs.service';
import { FleetStateService } from '../fleet/fleet-state.service';
import { ConflictsService } from '../conflicts/conflicts.service';
import { WeatherService } from '../weather/weather.service';
import { NotamService } from '../notam/notam.service';
import { AdsbService } from '../adsb/adsb.service';
import { BriefingService } from '../briefing/briefing.service';
import { EmergencyIncident } from '../emergency/incident.entity';
import { COPILOT_TOOLS, COPILOT_SYSTEM } from './copilot.tools';

type ChatMessage = { role: 'user' | 'assistant'; content: unknown };

/**
 * Operations Copilot orchestrator. Drives the Claude tool-use loop, dispatching
 * read tools to internal services (shaped to keep token cost down) and turning
 * propose_* tools into confirm-gated action proposals (never executed here).
 */
@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly flights: FlightsService,
    private readonly drones: DronesService,
    private readonly hubs: HubsService,
    private readonly fleetState: FleetStateService,
    private readonly conflicts: ConflictsService,
    private readonly weather: WeatherService,
    private readonly notam: NotamService,
    private readonly adsb: AdsbService,
    private readonly briefing: BriefingService,
    @InjectRepository(EmergencyIncident)
    private readonly incidents: Repository<EmergencyIncident>,
  ) {}

  enabled(): boolean {
    return this.claude.hasKey();
  }

  async chat(messages: ChatMessage[]) {
    if (!this.claude.hasKey()) {
      return { enabled: false, reply: '', toolTrace: [], proposedActions: [], model: ClaudeService.SONNET };
    }

    const out = await this.claude.messageWithTools({
      system: COPILOT_SYSTEM,
      messages,
      tools: COPILOT_TOOLS,
      model: ClaudeService.SONNET,
      maxTokens: 1500,
      maxIterations: 6,
      onToolCall: (name, input) => this.dispatch(name, input),
    });

    if (!out) {
      return {
        enabled: true,
        reply: 'The assistant is temporarily unavailable. Please try again.',
        toolTrace: [],
        proposedActions: [],
        model: ClaudeService.SONNET,
      };
    }

    return {
      enabled: true,
      reply: out.text,
      toolTrace: out.toolTrace,
      proposedActions: out.proposedActions,
      model: ClaudeService.SONNET,
    };
  }

  /** Dispatch a single tool call to the backing service (or build a proposal). */
  private async dispatch(
    name: string,
    input: Record<string, unknown>,
  ): Promise<ToolDispatchResult> {
    switch (name) {
      case 'list_flights': {
        const filters: Record<string, unknown> = {};
        if (input.status) filters.status = input.status;
        if (input.hubId) filters.hubId = input.hubId;
        const flights = await this.flights.findAll(filters);
        return {
          result: flights.map((f) => ({
            id: f.id,
            flightNumber: f.flightNumber,
            status: f.status,
            departureHub: f.departureHub?.name ?? f.departureHubId,
            arrivalHub: f.arrivalHub?.name ?? f.arrivalHubId,
            maxAltitudeM: f.maxAltitude,
            droneId: f.droneId,
          })),
        };
      }
      case 'get_flight': {
        const fid = await this.resolveFlightId(String(input.flightId));
        if (!fid) return { result: { error: `Flight not found: ${input.flightId}` } };
        const f = await this.flights.findById(fid);
        return {
          result: {
            id: f.id,
            flightNumber: f.flightNumber,
            status: f.status,
            departureHub: f.departureHub?.name ?? f.departureHubId,
            arrivalHub: f.arrivalHub?.name ?? f.arrivalHubId,
            maxAltitudeM: f.maxAltitude,
            droneId: f.droneId,
          },
        };
      }
      case 'list_drones': {
        const drones = await this.drones.findAll();
        return {
          result: drones.map((d) => ({
            id: d.id,
            registration: d.registrationNumber,
            model: d.model,
            status: d.status,
            currentHubId: d.currentHubId,
          })),
        };
      }
      case 'list_hubs': {
        const hubs = await this.hubs.findAll();
        return {
          result: hubs.map((h) => ({
            id: h.id,
            code: h.code,
            name: h.name,
            status: h.status,
          })),
        };
      }
      case 'fleet_overview':
        return { result: await this.fleetState.getFleetOverview() };
      case 'active_conflicts': {
        const conflicts = await this.conflicts.findActive();
        return {
          result: conflicts.map((c) => ({
            id: c.id,
            type: c.conflictType,
            severity: c.severity,
            status: c.status,
            primaryFlight: c.primaryFlight?.flightNumber,
            secondaryFlight: c.secondaryFlight?.flightNumber,
            detectedAt: c.detectedAt,
          })),
        };
      }
      case 'emergency_incidents': {
        const where = input.activeOnly
          ? [{ status: 'active' }, { status: 'pending_confirmation' }, { status: 'executing' }]
          : undefined;
        const list = await this.incidents.find({
          where: where as never,
          order: { detectedAt: 'DESC' },
          take: 25,
        });
        return {
          result: list.map((i) => ({
            id: i.id,
            type: i.emergencyType,
            severity: i.severity,
            status: i.status,
            message: i.message,
            droneId: i.droneId,
            detectedAt: i.detectedAt,
          })),
        };
      }
      case 'weather_go_no_go': {
        const hub = await this.resolveHub(String(input.hub));
        if (!hub) return { result: { error: `Hub not found: ${input.hub}` } };
        const w = await this.weather.getGoNoGo(hub.id);
        return {
          result: {
            hub: hub.code,
            verdict: w.verdict,
            station: w.station,
            wind: w.wind,
            reasons: w.reasons,
          },
        };
      }
      case 'get_notams': {
        const notams = await this.notam.getNotams();
        return {
          result: {
            count: notams.length,
            critical: notams.filter((n) => n.significance === 'critical').length,
            items: notams.slice(0, 10).map((n) => ({
              ref: n.ref,
              significance: n.significance,
              subject: n.subject,
              end: n.end,
              permanent: n.permanent,
            })),
          },
        };
      }
      case 'live_traffic': {
        const aircraft = await this.adsb.getAircraft();
        const low = aircraft.filter((a) => !a.onGround && (a.altitude ?? 99999) <= 5000);
        return {
          result: {
            total: aircraft.length,
            lowAltitudeCount: low.length,
            sample: low.slice(0, 10).map((a) => ({
              callsign: a.callsign,
              hex: a.hex,
              altitudeFt: a.altitude,
              lat: a.lat,
              lon: a.lon,
            })),
          },
        };
      }
      case 'flight_briefing': {
        const fid = await this.resolveFlightId(String(input.flightId));
        if (!fid) return { result: { error: `Flight not found: ${input.flightId}` } };
        const b = await this.briefing.getFlightBriefing(fid);
        return {
          result: {
            flightNumber: b.flightNumber,
            verdict: b.verdict,
            weather: b.sections.weather,
            airspace: b.sections.airspace,
            traffic: b.sections.traffic,
            notam: (b.sections.notam as Record<string, unknown>).message ?? b.sections.notam,
          },
        };
      }

      // ── Action proposals (NOT executed) ──
      case 'propose_authorize_flight': {
        const f = await this.resolveFlight(String(input.flightId));
        if (!f) return { result: { error: `Flight not found: ${input.flightId}` } };
        return {
          proposal: this.action('authorize_flight', 'POST',
            `/flights/${f.id}/authorize`, input, `Authorize flight ${f.flightNumber}`),
        };
      }
      case 'propose_abort_flight': {
        const f = await this.resolveFlight(String(input.flightId));
        if (!f) return { result: { error: `Flight not found: ${input.flightId}` } };
        return {
          proposal: this.action('abort_flight', 'POST',
            `/flights/${f.id}/abort`, input, `Abort flight ${f.flightNumber}`),
        };
      }
      case 'propose_resolve_conflict':
        return {
          proposal: this.action('resolve_conflict', 'POST',
            `/conflicts/${input.conflictId}/resolve`, input, `Resolve conflict ${input.conflictId}`),
        };
      case 'propose_confirm_emergency':
        return {
          proposal: this.action('confirm_emergency', 'POST',
            `/emergency/incidents/${input.incidentId}/confirm`, input,
            `Confirm response for incident ${input.incidentId}`, { approved: true }),
        };

      default:
        return { result: { error: `Unknown tool: ${name}` } };
    }
  }

  private action(
    kind: string,
    method: 'POST' | 'PUT' | 'PATCH',
    path: string,
    input: Record<string, unknown>,
    label: string,
    body?: Record<string, unknown>,
  ): ProposedAction {
    return {
      kind,
      label,
      method,
      path,
      ...(body ? { body } : {}),
      rationale: String(input.rationale ?? ''),
    };
  }

  /** Resolve a flight by id or flight number; returns the entity or null. */
  private async resolveFlight(token: string) {
    const t = token.trim();
    try {
      const all = await this.flights.findAll();
      return (
        all.find((f) => f.id === t) ||
        all.find((f) => f.flightNumber?.toLowerCase() === t.toLowerCase()) ||
        null
      );
    } catch {
      return null;
    }
  }

  private async resolveFlightId(token: string): Promise<string | null> {
    const f = await this.resolveFlight(token);
    return f?.id ?? null;
  }

  /** Resolve a hub by id, code, or name (case-insensitive). */
  private async resolveHub(token: string) {
    const hubs = await this.hubs.findAll();
    const t = token.trim().toLowerCase();
    return (
      hubs.find((h) => h.id === token) ||
      hubs.find((h) => h.code?.toLowerCase() === t) ||
      hubs.find((h) => h.name?.toLowerCase() === t) ||
      hubs.find((h) => h.name?.toLowerCase().includes(t)) ||
      null
    );
  }
}
