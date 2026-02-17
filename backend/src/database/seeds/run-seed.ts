import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Organization } from '../../modules/organizations/organization.entity';
import { User } from '../../modules/users/user.entity';
import { Hub } from '../../modules/hubs/hub.entity';
import { Drone } from '../../modules/drones/drone.entity';
import { Flight } from '../../modules/flights/flight.entity';
import { AirspaceZone } from '../../modules/airspace/airspace-zone.entity';
import { Conflict } from '../../modules/conflicts/conflict.entity';
import { EmergencyIncident, EmergencyType, EmergencySeverity, IncidentStatus, ResponseAction, RootCause } from '../../modules/emergency/incident.entity';
import { EmergencyProtocol } from '../../modules/emergency/protocol.entity';
import { BlackboxEntry } from '../../modules/emergency/blackbox.entity';

async function runSeed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  logger.log('Seeding started...');

  // ── Clear existing data ──
  logger.log('Clearing existing data...');
  await dataSource.getRepository(BlackboxEntry).delete({});
  await dataSource.getRepository(EmergencyIncident).delete({});
  await dataSource.getRepository(EmergencyProtocol).delete({});
  await dataSource.getRepository(Conflict).delete({});
  await dataSource.getRepository(AirspaceZone).delete({});
  await dataSource.getRepository(Flight).delete({});
  await dataSource.getRepository(Drone).delete({});
  await dataSource.getRepository(Hub).delete({});
  await dataSource.getRepository(User).delete({});
  await dataSource.getRepository(Organization).delete({});
  logger.log('Existing data cleared');

  // ── Organization ──
  const orgRepo = dataSource.getRepository(Organization);
  let org = await orgRepo.findOne({ where: { name: 'DROPS Aerospace' } });
  if (!org) {
    org = orgRepo.create({
      name: 'DROPS Aerospace',
      type: 'operator',
      registrationNumber: 'OP-2025-GR-001',
      contactInfo: { email: 'ops@drops-aero.com', phone: '+30-210-555-0100' },
      address: { city: 'Athens', country: 'Greece', street: '25 Vasilissis Sofias Ave, Marousi' },
      status: 'active',
    });
    org = await orgRepo.save(org);
    logger.log(`Created organization: ${org.name}`);
  }

  // ── Users ──
  const userRepo = dataSource.getRepository(User);
  const salt = await bcrypt.genSalt();
  const passwordHash = await bcrypt.hash('password123', salt);

  const usersData = [
    { email: 'admin@drops-utm.com', firstName: 'Nikos', lastName: 'Papadopoulos', role: 'admin' },
    { email: 'pilot@drops-utm.com', firstName: 'Elena', lastName: 'Georgiou', role: 'pilot' },
    { email: 'operator@drops-utm.com', firstName: 'Dimitris', lastName: 'Konstantinou', role: 'hub_operator' },
  ];

  const users: User[] = [];
  for (const u of usersData) {
    let user = await userRepo.findOne({ where: { email: u.email } });
    if (!user) {
      user = userRepo.create({
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        organizationId: org.id,
        status: 'active',
      });
      user = await userRepo.save(user);
      logger.log(`Created user: ${u.email}`);
    }
    users.push(user);
  }

  // ── Hubs ──
  const hubRepo = dataSource.getRepository(Hub);
  const hubsData = [
    {
      code: 'ATH-HUB',
      name: 'Athens Central Hub',
      location: { latitude: 37.9838, longitude: 23.7275 },
      airspaceRadius: 8000,
      airspaceCeiling: 400,
      airspaceFloor: 0,
      timezone: 'Europe/Athens',
      status: 'active',
      maxSimultaneousDrones: 15,
    },
    {
      code: 'SKG-HUB',
      name: 'Thessaloniki Logistics Hub',
      location: { latitude: 40.6401, longitude: 22.9444 },
      airspaceRadius: 6000,
      airspaceCeiling: 350,
      airspaceFloor: 0,
      timezone: 'Europe/Athens',
      status: 'active',
      maxSimultaneousDrones: 12,
    },
    {
      code: 'HER-HUB',
      name: 'Heraklion Operations Center',
      location: { latitude: 35.3387, longitude: 25.1442 },
      airspaceRadius: 5000,
      airspaceCeiling: 300,
      airspaceFloor: 0,
      timezone: 'Europe/Athens',
      status: 'active',
      maxSimultaneousDrones: 10,
    },
    {
      code: 'GPA-HUB',
      name: 'Patras Sky Port',
      location: { latitude: 38.2466, longitude: 21.7346 },
      airspaceRadius: 6000,
      airspaceCeiling: 350,
      airspaceFloor: 0,
      timezone: 'Europe/Athens',
      status: 'active',
      maxSimultaneousDrones: 8,
    },
    {
      code: 'RHO-HUB',
      name: 'Rhodes Island Station',
      location: { latitude: 36.4349, longitude: 28.2176 },
      airspaceRadius: 7000,
      airspaceCeiling: 400,
      airspaceFloor: 0,
      timezone: 'Europe/Athens',
      status: 'active',
      maxSimultaneousDrones: 6,
    },
  ];

  const hubs: Hub[] = [];
  for (const h of hubsData) {
    let hub = await hubRepo.findOne({ where: { code: h.code } });
    if (!hub) {
      hub = hubRepo.create(h);
      hub = await hubRepo.save(hub);
      logger.log(`Created hub: ${h.code} — ${h.name}`);
    }
    hubs.push(hub);
  }

  // ── Drones ──
  const droneRepo = dataSource.getRepository(Drone);
  const dronesData = [
    {
      registrationNumber: 'DRN-GR-001',
      manufacturer: 'DJI',
      model: 'Matrice 350 RTK',
      serialNumber: 'DJI-M350-2025-A001',
      homeHubId: hubs[0].id,
      currentHubId: hubs[0].id,
      status: 'available',
      maxFlightTime: 55,
      maxRange: 15000,
      maxAltitude: 500,
      maxSpeed: 23.0,
      maxPayload: 2.7,
      communicationProtocol: 'dji_sdk',
      totalFlightHours: 142.5,
      totalFlights: 87,
    },
    {
      registrationNumber: 'DRN-GR-002',
      manufacturer: 'Wingcopter',
      model: 'W198',
      serialNumber: 'WC-198-2025-B003',
      homeHubId: hubs[0].id,
      currentHubId: hubs[0].id,
      status: 'in_flight',
      maxFlightTime: 100,
      maxRange: 75000,
      maxAltitude: 450,
      maxSpeed: 36.0,
      maxPayload: 6.0,
      communicationProtocol: 'mavlink',
      totalFlightHours: 310.2,
      totalFlights: 156,
    },
    {
      registrationNumber: 'DRN-GR-003',
      manufacturer: 'Ehang',
      model: 'EH216-S',
      serialNumber: 'EH-216S-2025-C007',
      homeHubId: hubs[1].id,
      currentHubId: hubs[1].id,
      status: 'available',
      maxFlightTime: 25,
      maxRange: 35000,
      maxAltitude: 300,
      maxSpeed: 31.0,
      maxPayload: 220.0,
      communicationProtocol: 'custom_api',
      totalFlightHours: 58.0,
      totalFlights: 34,
    },
    {
      registrationNumber: 'DRN-GR-004',
      manufacturer: 'Joby Aviation',
      model: 'S4',
      serialNumber: 'JB-S4-2025-D012',
      homeHubId: hubs[2].id,
      currentHubId: hubs[2].id,
      status: 'charging',
      maxFlightTime: 60,
      maxRange: 100000,
      maxAltitude: 450,
      maxSpeed: 90.0,
      maxPayload: 450.0,
      communicationProtocol: 'custom_api',
      totalFlightHours: 220.8,
      totalFlights: 112,
    },
    {
      registrationNumber: 'DRN-GR-005',
      manufacturer: 'DJI',
      model: 'FlyCart 30',
      serialNumber: 'DJI-FC30-2025-E019',
      homeHubId: hubs[2].id,
      currentHubId: hubs[2].id,
      status: 'available',
      maxFlightTime: 40,
      maxRange: 28000,
      maxAltitude: 400,
      maxSpeed: 20.0,
      maxPayload: 30.0,
      communicationProtocol: 'dji_sdk',
      totalFlightHours: 95.3,
      totalFlights: 64,
    },
    {
      registrationNumber: 'DRN-GR-006',
      manufacturer: 'Volocopter',
      model: 'VoloDrone',
      serialNumber: 'VC-VD-2025-F021',
      homeHubId: hubs[3].id,
      currentHubId: hubs[3].id,
      status: 'maintenance',
      maxFlightTime: 40,
      maxRange: 40000,
      maxAltitude: 350,
      maxSpeed: 30.0,
      maxPayload: 200.0,
      communicationProtocol: 'mavlink',
      totalFlightHours: 180.0,
      totalFlights: 92,
    },
    {
      registrationNumber: 'DRN-GR-007',
      manufacturer: 'Skydio',
      model: 'X10',
      serialNumber: 'SK-X10-2025-G025',
      homeHubId: hubs[4].id,
      currentHubId: hubs[4].id,
      status: 'available',
      maxFlightTime: 45,
      maxRange: 10000,
      maxAltitude: 400,
      maxSpeed: 18.0,
      maxPayload: 0.5,
      communicationProtocol: 'custom_api',
      totalFlightHours: 67.4,
      totalFlights: 43,
    },
    {
      registrationNumber: 'DRN-GR-008',
      manufacturer: 'Zipline',
      model: 'P2 Zip',
      serialNumber: 'ZL-P2-2025-H030',
      homeHubId: hubs[4].id,
      currentHubId: hubs[4].id,
      status: 'available',
      maxFlightTime: 50,
      maxRange: 80000,
      maxAltitude: 450,
      maxSpeed: 44.0,
      maxPayload: 1.8,
      communicationProtocol: 'custom_api',
      totalFlightHours: 410.7,
      totalFlights: 238,
    },
  ];

  const drones: Drone[] = [];
  for (const d of dronesData) {
    let drone = await droneRepo.findOne({ where: { registrationNumber: d.registrationNumber } });
    if (!drone) {
      drone = droneRepo.create(d);
      drone = await droneRepo.save(drone);
      logger.log(`Created drone: ${d.registrationNumber} — ${d.manufacturer} ${d.model}`);
    }
    drones.push(drone);
  }

  // ── Flights ──
  const flightRepo = dataSource.getRepository(Flight);
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600_000);

  const flightsData = [
    {
      flightNumber: 'DRP-2025-0001',
      droneId: drones[1].id,
      pilotId: users[1].id,
      departureHubId: hubs[0].id,
      arrivalHubId: hubs[1].id,
      flightType: 'delivery',
      operationMode: 'autonomous',
      status: 'active',
      plannedDeparture: hoursAgo(1),
      plannedArrival: hoursFromNow(0.5),
      actualDeparture: hoursAgo(0.9),
      maxAltitude: 250,
      minAltitude: 80,
      authorizationStatus: 'approved',
      authorizationNumber: 'AUTH-ATH-001',
      missionType: 'cargo',
      payloadWeight: 3.5,
      riskAssessment: 'low',
      notes: 'Medical supplies delivery — Athens to Thessaloniki priority route',
    },
    {
      flightNumber: 'DRP-2025-0002',
      droneId: drones[0].id,
      pilotId: users[1].id,
      departureHubId: hubs[0].id,
      arrivalHubId: hubs[2].id,
      flightType: 'inspection',
      operationMode: 'remote_pilot',
      status: 'planned',
      plannedDeparture: hoursFromNow(2),
      plannedArrival: hoursFromNow(4),
      maxAltitude: 300,
      minAltitude: 100,
      authorizationStatus: 'pending',
      missionType: 'infrastructure_survey',
      riskAssessment: 'medium',
      notes: 'Bridge inspection along Corinth Canal corridor',
    },
    {
      flightNumber: 'DRP-2025-0003',
      droneId: drones[2].id,
      pilotId: users[1].id,
      departureHubId: hubs[1].id,
      arrivalHubId: hubs[2].id,
      flightType: 'delivery',
      operationMode: 'autonomous',
      status: 'authorized',
      plannedDeparture: hoursFromNow(1),
      plannedArrival: hoursFromNow(1.5),
      maxAltitude: 200,
      minAltitude: 60,
      authorizationStatus: 'approved',
      authorizationNumber: 'AUTH-SKG-002',
      missionType: 'cargo',
      payloadWeight: 5.0,
      riskAssessment: 'low',
    },
    {
      flightNumber: 'DRP-2025-0004',
      droneId: drones[4].id,
      departureHubId: hubs[2].id,
      arrivalHubId: hubs[0].id,
      flightType: 'delivery',
      operationMode: 'autonomous',
      status: 'completed',
      plannedDeparture: hoursAgo(6),
      plannedArrival: hoursAgo(4.5),
      actualDeparture: hoursAgo(5.8),
      actualArrival: hoursAgo(4.3),
      maxAltitude: 280,
      minAltitude: 90,
      authorizationStatus: 'approved',
      authorizationNumber: 'AUTH-HER-003',
      missionType: 'cargo',
      payloadWeight: 12.0,
      riskAssessment: 'low',
      notes: 'Heavy cargo — construction materials to Athens',
    },
    {
      flightNumber: 'DRP-2025-0005',
      droneId: drones[3].id,
      pilotId: users[1].id,
      departureHubId: hubs[2].id,
      arrivalHubId: hubs[1].id,
      flightType: 'test',
      operationMode: 'hybrid',
      status: 'completed',
      plannedDeparture: hoursAgo(12),
      plannedArrival: hoursAgo(11),
      actualDeparture: hoursAgo(11.9),
      actualArrival: hoursAgo(10.8),
      maxAltitude: 350,
      minAltitude: 50,
      authorizationStatus: 'approved',
      authorizationNumber: 'AUTH-HER-004',
      missionType: 'test_flight',
      riskAssessment: 'medium',
      notes: 'eVTOL certification test run',
    },
    {
      flightNumber: 'DRP-2025-0006',
      droneId: drones[6].id,
      departureHubId: hubs[4].id,
      arrivalHubId: hubs[4].id,
      flightType: 'surveillance',
      operationMode: 'autonomous',
      status: 'planned',
      plannedDeparture: hoursFromNow(5),
      plannedArrival: hoursFromNow(6),
      maxAltitude: 200,
      minAltitude: 50,
      authorizationStatus: 'pending',
      missionType: 'coastal_patrol',
      riskAssessment: 'low',
      notes: 'Coastal perimeter monitoring — Rhodes',
    },
    {
      flightNumber: 'DRP-2025-0007',
      droneId: drones[7].id,
      departureHubId: hubs[4].id,
      arrivalHubId: hubs[4].id,
      flightType: 'delivery',
      operationMode: 'autonomous',
      status: 'completed',
      plannedDeparture: hoursAgo(24),
      plannedArrival: hoursAgo(23),
      actualDeparture: hoursAgo(23.8),
      actualArrival: hoursAgo(22.9),
      maxAltitude: 300,
      minAltitude: 100,
      authorizationStatus: 'approved',
      authorizationNumber: 'AUTH-RHO-005',
      missionType: 'medical',
      payloadWeight: 1.2,
      riskAssessment: 'low',
      notes: 'Blood sample delivery to rural clinic in Rhodes',
    },
    {
      flightNumber: 'DRP-2025-0008',
      droneId: drones[0].id,
      departureHubId: hubs[0].id,
      arrivalHubId: hubs[0].id,
      flightType: 'training',
      operationMode: 'remote_pilot',
      status: 'cancelled',
      plannedDeparture: hoursAgo(3),
      plannedArrival: hoursAgo(2),
      authorizationStatus: 'approved',
      authorizationNumber: 'AUTH-ATH-006',
      missionType: 'pilot_training',
      riskAssessment: 'low',
      notes: 'Cancelled due to high wind',
    },
  ];

  const flights: Flight[] = [];
  for (const f of flightsData) {
    let flight = await flightRepo.findOne({ where: { flightNumber: f.flightNumber } });
    if (!flight) {
      flight = flightRepo.create(f);
      flight = await flightRepo.save(flight);
      logger.log(`Created flight: ${f.flightNumber} [${f.status}]`);
    }
    flights.push(flight);
  }

  // ── Airspace Zones ──
  const zoneRepo = dataSource.getRepository(AirspaceZone);
  const zonesData = [
    {
      name: 'Athens International Airport CTR',
      zoneType: 'controlled',
      hubId: hubs[0].id,
      geometry: {
        coordinates: [
          { latitude: 37.94, longitude: 23.93 },
          { latitude: 37.94, longitude: 23.96 },
          { latitude: 37.92, longitude: 23.96 },
          { latitude: 37.92, longitude: 23.93 },
        ],
      },
      altitudeFloor: 0,
      altitudeCeiling: 400,
      status: 'active',
      priority: 10,
    },
    {
      name: 'Thessaloniki Airport Zone',
      zoneType: 'restricted',
      hubId: hubs[1].id,
      geometry: {
        coordinates: [
          { latitude: 40.52, longitude: 22.97 },
          { latitude: 40.52, longitude: 23.00 },
          { latitude: 40.50, longitude: 23.00 },
          { latitude: 40.50, longitude: 22.97 },
        ],
      },
      altitudeFloor: 0,
      altitudeCeiling: 150,
      status: 'active',
      priority: 8,
    },
    {
      name: 'Saronic Gulf Corridor',
      zoneType: 'corridor',
      geometry: {
        coordinates: [
          { latitude: 37.95, longitude: 23.60 },
          { latitude: 37.95, longitude: 23.75 },
          { latitude: 37.90, longitude: 23.75 },
          { latitude: 37.90, longitude: 23.60 },
        ],
      },
      altitudeFloor: 50,
      altitudeCeiling: 300,
      status: 'active',
      priority: 5,
    },
    {
      name: 'Acropolis No-Fly Zone',
      zoneType: 'prohibited',
      geometry: {
        coordinates: [
          { latitude: 37.973, longitude: 23.724 },
          { latitude: 37.973, longitude: 23.730 },
          { latitude: 37.969, longitude: 23.730 },
          { latitude: 37.969, longitude: 23.724 },
        ],
      },
      altitudeFloor: 0,
      altitudeCeiling: 600,
      status: 'active',
      priority: 100,
    },
    {
      name: 'Patras Test Range',
      zoneType: 'warning',
      hubId: hubs[3].id,
      geometry: {
        coordinates: [
          { latitude: 38.26, longitude: 21.72 },
          { latitude: 38.26, longitude: 21.75 },
          { latitude: 38.24, longitude: 21.75 },
          { latitude: 38.24, longitude: 21.72 },
        ],
      },
      altitudeFloor: 0,
      altitudeCeiling: 500,
      status: 'temporary',
      priority: 3,
    },
  ];

  for (const z of zonesData) {
    const existing = await zoneRepo.findOne({ where: { name: z.name } });
    if (!existing) {
      const zone = zoneRepo.create(z);
      await zoneRepo.save(zone);
      logger.log(`Created zone: ${z.name} [${z.zoneType}]`);
    }
  }

  // ── Conflicts ──
  const conflictRepo = dataSource.getRepository(Conflict);
  const conflictsData = [
    {
      conflictType: 'separation_minimum',
      severity: 'high',
      status: 'detected',
      primaryFlightId: flights[0].id,
      secondaryFlightId: flights[2].id,
      hubId: hubs[1].id,
      description: 'Minimum separation breach detected between DRP-2025-0001 and DRP-2025-0003 near Thessaloniki Logistics Hub. Projected convergence at 250m altitude.',
      separationDistance: 180,
      location: { latitude: 40.635, longitude: 22.940 },
      altitude: 250,
      detectionMethod: 'automated',
    },
    {
      conflictType: 'airspace_violation',
      severity: 'medium',
      status: 'resolving',
      primaryFlightId: flights[0].id,
      hubId: hubs[1].id,
      description: 'Flight DRP-2025-0001 trajectory enters Thessaloniki Airport Zone boundary. Rerouting recommended.',
      location: { latitude: 40.515, longitude: 22.985 },
      altitude: 140,
      detectionMethod: 'geofence',
      resolutionStrategy: 'Route deviation via corridor SKG-ALT-1',
    },
    {
      conflictType: 'weather',
      severity: 'low',
      status: 'resolved',
      primaryFlightId: flights[7].id,
      hubId: hubs[0].id,
      description: 'Wind speed exceeded operational limit for training flight DRP-2025-0008. Flight cancelled.',
      detectionMethod: 'weather_service',
      resolutionStrategy: 'Flight cancelled by operator',
      resolvedAt: hoursAgo(2.5),
      resolvedBy: users[2].id,
    },
  ];

  for (const c of conflictsData) {
    const existing = await conflictRepo.findOne({
      where: { description: c.description },
    });
    if (!existing) {
      const conflict = conflictRepo.create(c);
      await conflictRepo.save(conflict);
      logger.log(`Created conflict: ${c.conflictType} [${c.severity}]`);
    }
  }

  // ── Emergency Protocols ──
  const protocolRepo = dataSource.getRepository(EmergencyProtocol);
  const protocolsData: Partial<EmergencyProtocol>[] = [
    {
      name: 'Battery Critical - Land Immediately',
      description: 'When battery drops below 15%, land at nearest safe zone',
      emergencyType: 'battery_critical' as EmergencyType,
      severity: 'emergency' as EmergencySeverity,
      responseAction: 'LAND' as ResponseAction,
      fallbackAction: 'ESTOP' as ResponseAction,
      requiresConfirmation: false,
      confirmationTimeoutSeconds: 30,
      autoExecuteOnTimeout: true,
      priority: 1,
      thresholds: { batteryPercent: 15 },
      notifyPilot: true,
      notifySupervisor: true,
      notifyOpsCenter: true,
      sendSms: true,
      sendEmail: true,
      playAudioAlarm: true,
      isActive: true,
      isSystemDefault: true,
    },
    {
      name: 'Battery Low - Return to Home',
      description: 'When battery drops below 30%, initiate RTH',
      emergencyType: 'battery_low' as EmergencyType,
      severity: 'warning' as EmergencySeverity,
      responseAction: 'RTH' as ResponseAction,
      requiresConfirmation: true,
      confirmationTimeoutSeconds: 60,
      autoExecuteOnTimeout: true,
      priority: 2,
      thresholds: { batteryPercent: 30 },
      notifyPilot: true,
      notifySupervisor: false,
      notifyOpsCenter: false,
      sendSms: false,
      sendEmail: false,
      playAudioAlarm: true,
      isActive: true,
      isSystemDefault: true,
    },
    {
      name: 'Signal Lost - RTH',
      description: 'When signal is lost for more than 10 seconds, return to home',
      emergencyType: 'signal_lost' as EmergencyType,
      severity: 'critical' as EmergencySeverity,
      responseAction: 'RTH' as ResponseAction,
      fallbackAction: 'LAND' as ResponseAction,
      requiresConfirmation: false,
      confirmationTimeoutSeconds: 15,
      autoExecuteOnTimeout: true,
      priority: 1,
      thresholds: { signalLostSeconds: 10 },
      notifyPilot: true,
      notifySupervisor: true,
      notifyOpsCenter: true,
      sendSms: true,
      sendEmail: true,
      playAudioAlarm: true,
      isActive: true,
      isSystemDefault: true,
    },
    {
      name: 'Geofence Breach - Hover',
      description: 'When drone breaches geofence, hover and await instructions',
      emergencyType: 'geofence_breach' as EmergencyType,
      severity: 'critical' as EmergencySeverity,
      responseAction: 'HOVER' as ResponseAction,
      fallbackAction: 'RTH' as ResponseAction,
      requiresConfirmation: true,
      confirmationTimeoutSeconds: 45,
      autoExecuteOnTimeout: true,
      priority: 2,
      notifyPilot: true,
      notifySupervisor: true,
      notifyOpsCenter: true,
      sendSms: true,
      sendEmail: false,
      playAudioAlarm: true,
      isActive: true,
      isSystemDefault: true,
    },
    {
      name: 'Aircraft Proximity - Descend',
      description: 'When manned aircraft detected nearby, descend to safe altitude',
      emergencyType: 'collision_aircraft' as EmergencyType,
      severity: 'emergency' as EmergencySeverity,
      responseAction: 'DESCEND' as ResponseAction,
      fallbackAction: 'LAND' as ResponseAction,
      requiresConfirmation: false,
      confirmationTimeoutSeconds: 10,
      autoExecuteOnTimeout: true,
      priority: 1,
      thresholds: { proximityMeters: 500 },
      notifyPilot: true,
      notifySupervisor: true,
      notifyOpsCenter: true,
      sendSms: true,
      sendEmail: true,
      playAudioAlarm: true,
      isActive: true,
      isSystemDefault: true,
    },
    {
      name: 'GPS Degraded - Hover',
      description: 'When GPS accuracy degrades, hover until signal improves',
      emergencyType: 'gps_degraded' as EmergencyType,
      severity: 'warning' as EmergencySeverity,
      responseAction: 'HOVER' as ResponseAction,
      requiresConfirmation: true,
      confirmationTimeoutSeconds: 60,
      autoExecuteOnTimeout: false,
      priority: 3,
      thresholds: { hdop: 5.0 },
      notifyPilot: true,
      notifySupervisor: false,
      notifyOpsCenter: false,
      sendSms: false,
      sendEmail: false,
      playAudioAlarm: true,
      isActive: true,
      isSystemDefault: true,
    },
  ];

  for (const p of protocolsData) {
    const existing = await protocolRepo.findOne({ where: { name: p.name } });
    if (!existing) {
      const protocol = protocolRepo.create(p as any);
      await protocolRepo.save(protocol);
      logger.log(`Created protocol: ${p.name} [${p.emergencyType}]`);
    }
  }

  // ── Emergency Incidents ──
  const incidentRepo = dataSource.getRepository(EmergencyIncident);
  const incidentsData: Partial<EmergencyIncident>[] = [
    {
      droneId: drones[1].id,
      flightId: flights[0].id,
      emergencyType: 'battery_low' as EmergencyType,
      severity: 'warning' as EmergencySeverity,
      status: 'resolved' as IncidentStatus,
      message: 'Battery level dropped to 28% during delivery mission',
      detectionData: { batteryPercent: 28, estimatedFlightTime: 12 },
      latitude: 38.50,
      longitude: 23.20,
      altitude: 180,
      responseAction: 'RTH' as ResponseAction,
      wasAutoExecuted: false,
      confirmationRequired: true,
      confirmedBy: users[1].id,
      confirmedAt: hoursAgo(2),
      actionStartedAt: hoursAgo(1.95),
      actionCompletedAt: hoursAgo(1.5),
      actionSuccess: true,
      resolvedAt: hoursAgo(1.5),
      resolvedBy: users[1].id,
      resolutionNotes: 'Drone returned safely to hub. Battery replaced.',
      rootCause: 'weather' as RootCause,
      rootCauseNotes: 'Strong headwinds increased power consumption beyond planned levels',
      lessonsLearned: 'Consider weather conditions more carefully in flight planning',
      timeline: [
        { timestamp: hoursAgo(2.1).toISOString(), event: 'Battery warning detected at 28%' },
        { timestamp: hoursAgo(2).toISOString(), event: 'Operator confirmed RTH action' },
        { timestamp: hoursAgo(1.95).toISOString(), event: 'RTH initiated' },
        { timestamp: hoursAgo(1.5).toISOString(), event: 'Drone landed safely at hub' },
      ],
      detectedAt: hoursAgo(2.1),
    },
    {
      droneId: drones[0].id,
      flightId: flights[1].id,
      emergencyType: 'signal_weak',
      severity: 'warning',
      status: 'resolved',
      message: 'Signal strength degraded to 45% near urban canyon',
      detectionData: { signalStrength: 45, noiseLevel: -85 },
      latitude: 37.98,
      longitude: 23.73,
      altitude: 150,
      responseAction: 'CLIMB',
      wasAutoExecuted: false,
      confirmationRequired: true,
      confirmedBy: users[1].id,
      confirmedAt: hoursAgo(8),
      actionStartedAt: hoursAgo(7.95),
      actionCompletedAt: hoursAgo(7.9),
      actionSuccess: true,
      resolvedAt: hoursAgo(7.8),
      resolvedBy: users[1].id,
      resolutionNotes: 'Altitude increase restored signal to 92%',
      rootCause: 'external',
      rootCauseNotes: 'Building interference in urban area',
      timeline: [
        { timestamp: hoursAgo(8.1).toISOString(), event: 'Signal weakness detected' },
        { timestamp: hoursAgo(8).toISOString(), event: 'Altitude increase approved' },
        { timestamp: hoursAgo(7.9).toISOString(), event: 'Signal restored to normal' },
      ],
      detectedAt: hoursAgo(8.1),
    },
    {
      droneId: drones[2].id,
      flightId: flights[2].id,
      emergencyType: 'geofence_warning',
      severity: 'warning',
      status: 'resolved',
      message: 'Approaching Thessaloniki Airport Zone boundary - 50m margin',
      detectionData: { distanceToGeofence: 50, zoneType: 'restricted' },
      latitude: 40.52,
      longitude: 22.98,
      altitude: 140,
      responseAction: 'DIVERT',
      wasAutoExecuted: false,
      confirmationRequired: true,
      confirmedBy: users[0].id,
      confirmedAt: hoursAgo(5),
      actionStartedAt: hoursAgo(4.98),
      actionCompletedAt: hoursAgo(4.9),
      actionSuccess: true,
      resolvedAt: hoursAgo(4.85),
      resolvedBy: users[0].id,
      resolutionNotes: 'Flight path adjusted to maintain safe margin from airport zone',
      rootCause: 'software',
      rootCauseNotes: 'Flight planner did not account for wind drift',
      timeline: [
        { timestamp: hoursAgo(5.1).toISOString(), event: 'Geofence proximity warning' },
        { timestamp: hoursAgo(5).toISOString(), event: 'Route diversion approved' },
        { timestamp: hoursAgo(4.9).toISOString(), event: 'New route established' },
      ],
      detectedAt: hoursAgo(5.1),
    },
    {
      droneId: drones[4].id,
      flightId: flights[3].id,
      emergencyType: 'motor_anomaly',
      severity: 'critical',
      status: 'resolved',
      message: 'Motor #3 showing abnormal vibration pattern',
      detectionData: { motorId: 3, vibrationLevel: 2.8, normalLevel: 0.5 },
      latitude: 35.34,
      longitude: 25.15,
      altitude: 220,
      responseAction: 'LAND',
      wasAutoExecuted: true,
      confirmationRequired: false,
      actionStartedAt: hoursAgo(5.5),
      actionCompletedAt: hoursAgo(5.2),
      actionSuccess: true,
      resolvedAt: hoursAgo(5),
      resolvedBy: users[2].id,
      resolutionNotes: 'Precautionary landing executed. Motor inspection revealed loose bearing.',
      rootCause: 'equipment',
      rootCauseNotes: 'Motor bearing wear detected - component replaced',
      lessonsLearned: 'Schedule more frequent motor inspections for high-usage drones',
      timeline: [
        { timestamp: hoursAgo(5.6).toISOString(), event: 'Motor vibration anomaly detected' },
        { timestamp: hoursAgo(5.5).toISOString(), event: 'Automatic landing initiated' },
        { timestamp: hoursAgo(5.2).toISOString(), event: 'Drone landed at safe zone' },
        { timestamp: hoursAgo(5).toISOString(), event: 'Maintenance team dispatched' },
      ],
      detectedAt: hoursAgo(5.6),
    },
    {
      droneId: drones[6].id,
      emergencyType: 'gps_degraded',
      severity: 'warning',
      status: 'resolved',
      message: 'GPS HDOP increased to 4.2 - accuracy degraded',
      detectionData: { hdop: 4.2, satellites: 6 },
      latitude: 36.44,
      longitude: 28.22,
      altitude: 180,
      responseAction: 'HOVER',
      wasAutoExecuted: false,
      confirmationRequired: true,
      confirmedBy: users[1].id,
      confirmedAt: hoursAgo(18),
      actionStartedAt: hoursAgo(17.98),
      actionCompletedAt: hoursAgo(17.9),
      actionSuccess: true,
      resolvedAt: hoursAgo(17.5),
      resolvedBy: users[1].id,
      resolutionNotes: 'Held position for 20 minutes until satellite geometry improved',
      rootCause: 'external',
      rootCauseNotes: 'Poor satellite constellation geometry',
      timeline: [
        { timestamp: hoursAgo(18.1).toISOString(), event: 'GPS accuracy degradation detected' },
        { timestamp: hoursAgo(18).toISOString(), event: 'Hover approved' },
        { timestamp: hoursAgo(17.5).toISOString(), event: 'GPS accuracy restored' },
      ],
      detectedAt: hoursAgo(18.1),
    },
    {
      droneId: drones[3].id,
      flightId: flights[4].id,
      emergencyType: 'collision_obstacle',
      severity: 'critical',
      status: 'resolved',
      message: 'Construction crane detected 80m ahead on flight path',
      detectionData: { obstacleType: 'crane', distance: 80, bearing: 15 },
      latitude: 35.35,
      longitude: 25.13,
      altitude: 280,
      responseAction: 'HOVER',
      wasAutoExecuted: true,
      confirmationRequired: false,
      actionStartedAt: hoursAgo(11.5),
      actionCompletedAt: hoursAgo(11.48),
      actionSuccess: true,
      resolvedAt: hoursAgo(11.3),
      resolvedBy: users[1].id,
      resolutionNotes: 'Rerouted around obstacle with 200m clearance',
      rootCause: 'external',
      rootCauseNotes: 'New construction activity not yet in airspace database',
      lessonsLearned: 'Implement more frequent airspace database updates',
      timeline: [
        { timestamp: hoursAgo(11.5).toISOString(), event: 'Obstacle detected' },
        { timestamp: hoursAgo(11.48).toISOString(), event: 'Emergency hover' },
        { timestamp: hoursAgo(11.4).toISOString(), event: 'Alternative route calculated' },
        { timestamp: hoursAgo(11.3).toISOString(), event: 'Flight resumed on new path' },
      ],
      detectedAt: hoursAgo(11.5),
    },
    // Active incidents for demo
    {
      droneId: drones[1].id,
      flightId: flights[0].id,
      emergencyType: 'battery_low',
      severity: 'warning',
      status: 'active',
      message: 'Battery at 32% - monitoring closely',
      detectionData: { batteryPercent: 32, estimatedFlightTime: 18 },
      latitude: 38.00,
      longitude: 23.74,
      altitude: 200,
      confirmationRequired: true,
      timeline: [
        { timestamp: new Date().toISOString(), event: 'Battery warning threshold reached' },
      ],
      detectedAt: new Date(),
    },
    {
      droneId: drones[2].id,
      emergencyType: 'signal_weak',
      severity: 'warning',
      status: 'pending_confirmation',
      message: 'Signal strength at 52% - RTH recommended',
      detectionData: { signalStrength: 52 },
      latitude: 40.64,
      longitude: 22.95,
      altitude: 160,
      responseAction: 'RTH',
      confirmationRequired: true,
      confirmationTimeoutAt: new Date(Date.now() + 45000),
      timeline: [
        { timestamp: new Date(Date.now() - 15000).toISOString(), event: 'Signal degradation detected' },
        { timestamp: new Date().toISOString(), event: 'Awaiting operator confirmation for RTH' },
      ],
      detectedAt: new Date(Date.now() - 15000),
    },
  ];

  const createdIncidents: EmergencyIncident[] = [];
  for (const i of incidentsData) {
    const existing = await incidentRepo.findOne({
      where: { droneId: i.droneId, message: i.message }
    });
    if (!existing) {
      const incident = incidentRepo.create(i as any);
      const saved = await incidentRepo.save(incident);
      if (Array.isArray(saved)) {
        createdIncidents.push(...saved);
      } else {
        createdIncidents.push(saved);
      }
      logger.log(`Created incident: ${i.emergencyType} [${i.severity}] - ${i.status}`);
    }
  }

  // ── Blackbox Entries ── (for resolved incidents with telemetry data)
  const blackboxRepo = dataSource.getRepository(BlackboxEntry);

  // Generate blackbox data for first resolved incident
  if (createdIncidents.length > 0) {
    const resolvedIncident = createdIncidents.find(i => i.status === 'resolved' && i.flightId);
    if (resolvedIncident) {
      const baseTime = new Date(resolvedIncident.detectedAt);
      const entries: Partial<BlackboxEntry>[] = [];

      // Generate 60 seconds of telemetry data before and after incident
      for (let i = -30; i <= 30; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        const batteryDrain = Math.max(20, 35 - Math.abs(i) * 0.1);

        entries.push({
          incidentId: resolvedIncident.id,
          flightId: resolvedIncident.flightId,
          droneId: resolvedIncident.droneId,
          timestamp,
          latitude: resolvedIncident.latitude! + (i * 0.0001),
          longitude: resolvedIncident.longitude! + (i * 0.00005),
          altitudeMsl: resolvedIncident.altitude! + (i < 0 ? 0 : -i * 2),
          groundSpeed: i < 0 ? 15 : Math.max(0, 15 - i),
          verticalSpeed: i < 0 ? 0 : -2,
          heading: 270 + (i * 0.5),
          batteryLevel: batteryDrain,
          batteryVoltage: 22.2 + (batteryDrain / 100) * 3,
          signalStrength: 85 + Math.random() * 10,
          gpsHdop: 1.2 + Math.random() * 0.5,
          gpsSatellites: 12,
          motorRpm: [5200, 5180, 5220, 5190],
          temperature: 35,
          flightMode: i < 0 ? 'mission' : 'rth',
          isEmergencyRecording: i >= 0,
        });
      }

      for (const entry of entries) {
        const bb = blackboxRepo.create(entry);
        await blackboxRepo.save(bb);
      }
      logger.log(`Created ${entries.length} blackbox entries for incident replay`);
    }
  }

  logger.log('──────────────────────────────────');
  logger.log('Seeding completed!');
  logger.log(`  Organizations: 1`);
  logger.log(`  Users: ${usersData.length}`);
  logger.log(`  Hubs: ${hubsData.length}`);
  logger.log(`  Drones: ${dronesData.length}`);
  logger.log(`  Flights: ${flightsData.length}`);
  logger.log(`  Airspace Zones: ${zonesData.length}`);
  logger.log(`  Conflicts: ${conflictsData.length}`);
  logger.log(`  Emergency Protocols: ${protocolsData.length}`);
  logger.log(`  Emergency Incidents: ${incidentsData.length}`);
  logger.log('──────────────────────────────────');
  logger.log('Test credentials:');
  logger.log('  admin@drops-utm.com / password123');
  logger.log('  pilot@drops-utm.com / password123');
  logger.log('  operator@drops-utm.com / password123');
  logger.log('──────────────────────────────────');

  await app.close();
}

runSeed();
