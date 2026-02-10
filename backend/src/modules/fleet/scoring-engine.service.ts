import { Injectable } from '@nestjs/common';
import { Drone } from '../drones/drone.entity';
import { Mission } from '../missions/mission.entity';
import { Hub } from '../hubs/hub.entity';
import { DroneScore, ScoringWeights, AlternativeDrone } from './fleet-assignment.entity';

export interface ScoredDrone {
  drone: Drone;
  scores: DroneScore;
  finalScore: number;
  eligible: boolean;
  ineligibilityReason?: string;
}

export interface MissionRequirements {
  departureHubId: string;
  departureLocation: { latitude: number; longitude: number };
  estimatedDistance?: number;
  estimatedDuration?: number;
  requiredPayload?: number;
  requiredCapabilities?: string[];
}

@Injectable()
export class ScoringEngineService {
  private fleetAverageFlightHours = 150; // Will be updated dynamically

  updateFleetAverageHours(avgHours: number): void {
    this.fleetAverageFlightHours = avgHours;
  }

  scoreDrones(
    drones: Drone[],
    requirements: MissionRequirements,
    weights: ScoringWeights,
  ): ScoredDrone[] {
    const scoredDrones = drones.map((drone) => this.scoreDrone(drone, requirements, weights));

    // Sort by final score descending
    return scoredDrones.sort((a, b) => b.finalScore - a.finalScore);
  }

  scoreDrone(
    drone: Drone,
    requirements: MissionRequirements,
    weights: ScoringWeights,
  ): ScoredDrone {
    // Check eligibility first
    const eligibility = this.checkEligibility(drone, requirements);
    if (!eligibility.eligible) {
      return {
        drone,
        scores: { proximity: 0, battery: 0, capability: 0, utilization: 0, maintenance: 0 },
        finalScore: 0,
        eligible: false,
        ineligibilityReason: eligibility.reason,
      };
    }

    const scores = this.calculateScores(drone, requirements);
    const finalScore = this.calculateFinalScore(scores, weights);

    return {
      drone,
      scores,
      finalScore,
      eligible: true,
    };
  }

  private checkEligibility(
    drone: Drone,
    requirements: MissionRequirements,
  ): { eligible: boolean; reason?: string } {
    // Check drone status
    if (drone.status !== 'available') {
      return { eligible: false, reason: `Drone status is ${drone.status}` };
    }

    // Check if drone is at a hub (has currentHubId)
    if (!drone.currentHubId) {
      return { eligible: false, reason: 'Drone is not at a hub' };
    }

    // Check payload capacity if required
    if (requirements.requiredPayload && drone.maxPayload < requirements.requiredPayload) {
      return {
        eligible: false,
        reason: `Insufficient payload capacity (${drone.maxPayload}kg < ${requirements.requiredPayload}kg)`,
      };
    }

    // Check range if distance known
    if (requirements.estimatedDistance && drone.maxRange < requirements.estimatedDistance) {
      return {
        eligible: false,
        reason: `Insufficient range (${drone.maxRange}m < ${requirements.estimatedDistance}m)`,
      };
    }

    return { eligible: true };
  }

  private calculateScores(drone: Drone, requirements: MissionRequirements): DroneScore {
    return {
      proximity: this.calculateProximityScore(drone, requirements),
      battery: this.calculateBatteryScore(drone, requirements),
      capability: this.calculateCapabilityScore(drone, requirements),
      utilization: this.calculateUtilizationScore(drone),
      maintenance: this.calculateMaintenanceScore(drone),
    };
  }

  private calculateProximityScore(drone: Drone, requirements: MissionRequirements): number {
    // If drone is at the departure hub, perfect score
    if (drone.currentHubId === requirements.departureHubId) {
      return 100;
    }

    // Calculate distance from drone's current hub to departure
    // For now, we'll use a simplified scoring based on hub match
    // In production, this would calculate actual distance
    const currentHub = drone.currentHub;
    if (!currentHub?.location) {
      return 50; // Default middle score if location unknown
    }

    const distance = this.calculateDistance(
      currentHub.location.latitude,
      currentHub.location.longitude,
      requirements.departureLocation.latitude,
      requirements.departureLocation.longitude,
    );

    // Score based on distance (max range as reference)
    const maxRange = drone.maxRange || 50000;
    const score = Math.max(0, 100 - (distance / maxRange) * 100);
    return Math.round(score);
  }

  private calculateBatteryScore(drone: Drone, requirements: MissionRequirements): number {
    // Estimate required battery based on mission duration
    // Assume ~1% battery per minute of flight + 20% reserve
    const estimatedMinutes = (requirements.estimatedDuration || 1800) / 60;
    const requiredBattery = Math.min(80, estimatedMinutes + 20);

    // Simulate battery level (in real system, this comes from telemetry)
    const currentBattery = this.getSimulatedBatteryLevel(drone);

    if (currentBattery < requiredBattery) {
      return 0;
    }

    // Score based on excess battery above requirement
    const excessBattery = currentBattery - requiredBattery;
    const maxExcess = 100 - requiredBattery;
    const score = (excessBattery / maxExcess) * 100;
    return Math.round(Math.min(100, score));
  }

  private calculateCapabilityScore(drone: Drone, requirements: MissionRequirements): number {
    let score = 100;

    // Check payload capacity
    if (requirements.requiredPayload) {
      const payloadRatio = drone.maxPayload / requirements.requiredPayload;
      if (payloadRatio < 1) return 0;
      // Slight penalty for over-capacity (using a bigger drone than needed)
      if (payloadRatio > 2) score -= 10;
    }

    // Check required capabilities
    if (requirements.requiredCapabilities && requirements.requiredCapabilities.length > 0) {
      // Capabilities can be an array or object with capability keys
      const droneCapabilities = this.extractCapabilities(drone.capabilities);
      const matched = requirements.requiredCapabilities.filter((cap) =>
        droneCapabilities.includes(cap),
      ).length;
      const matchRatio = matched / requirements.requiredCapabilities.length;
      score *= matchRatio;
    }

    return Math.round(score);
  }

  private calculateUtilizationScore(drone: Drone): number {
    // Score based on flight hours relative to fleet average
    // Lower utilization = higher score (to balance wear)
    const flightHours = drone.totalFlightHours || 0;
    const ratio = flightHours / this.fleetAverageFlightHours;

    // If below average, high score. If above, lower score.
    if (ratio <= 0.5) return 100;
    if (ratio >= 1.5) return 0;

    // Linear interpolation between 0.5 and 1.5
    const score = 100 - ((ratio - 0.5) / 1) * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private calculateMaintenanceScore(drone: Drone): number {
    // Score based on days until next scheduled maintenance
    const nextMaintenance = drone.nextMaintenance;
    if (!nextMaintenance) {
      return 80; // Default good score if no maintenance scheduled
    }

    const daysUntil = Math.floor(
      (new Date(nextMaintenance).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntil < 0) return 0; // Overdue
    if (daysUntil < 3) return 20; // Very soon
    if (daysUntil < 7) return 50;
    if (daysUntil < 14) return 70;
    if (daysUntil < 30) return 90;
    return 100;
  }

  private calculateFinalScore(scores: DroneScore, weights: ScoringWeights): number {
    const finalScore =
      scores.proximity * weights.proximity +
      scores.battery * weights.battery +
      scores.capability * weights.capability +
      scores.utilization * weights.utilization +
      scores.maintenance * weights.maintenance;

    return Math.round(finalScore * 100) / 100;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private extractCapabilities(capabilities: unknown): string[] {
    if (!capabilities) return [];
    if (Array.isArray(capabilities)) return capabilities as string[];
    if (typeof capabilities === 'object') {
      // If object, treat keys as capability names
      return Object.keys(capabilities);
    }
    return [];
  }

  private getSimulatedBatteryLevel(drone: Drone): number {
    // Simulate battery levels based on drone status
    // In production, this would come from real telemetry
    switch (drone.status) {
      case 'available':
        return 80 + Math.floor(Math.random() * 20); // 80-100%
      case 'charging':
        return 40 + Math.floor(Math.random() * 40); // 40-80%
      default:
        return 50;
    }
  }

  formatAlternatives(scoredDrones: ScoredDrone[], topN: number = 5): AlternativeDrone[] {
    return scoredDrones.slice(0, topN).map((sd) => ({
      droneId: sd.drone.id,
      score: sd.finalScore,
      scores: sd.scores,
      reason: sd.ineligibilityReason,
    }));
  }
}
