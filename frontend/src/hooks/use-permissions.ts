import { useAuthStore } from '@/store/auth.store';

export type UserRole = 'admin' | 'hub_operator' | 'pilot';

interface Permissions {
  // Users
  canViewUsers: boolean;
  canManageUsers: boolean;

  // Hubs
  canCreateHub: boolean;
  canEditHub: boolean;
  canDeleteHub: boolean;

  // Drones
  canCreateDrone: boolean;
  canEditDrone: boolean;
  canDeleteDrone: boolean;

  // Flights
  canCreateFlight: boolean;
  canManageAllFlights: boolean;

  // Organizations
  canManageOrganizations: boolean;

  // Airspace
  canCreateAirspaceZone: boolean;
  canDeleteAirspaceZone: boolean;

  // Connectivity
  canManageDeviceCertificates: boolean;
  canRegisterDevices: boolean;

  // Settings
  canAccessSettings: boolean;

  // Role checks
  isAdmin: boolean;
  isHubOperator: boolean;
  isPilot: boolean;
}

export function usePermissions(): Permissions {
  const user = useAuthStore((state) => state.user);
  const role = (user?.role || 'pilot') as UserRole;

  const isAdmin = role === 'admin';
  const isHubOperator = role === 'hub_operator';
  const isPilot = role === 'pilot';

  return {
    // Users - admin only
    canViewUsers: isAdmin,
    canManageUsers: isAdmin,

    // Hubs
    canCreateHub: isAdmin,
    canEditHub: isAdmin || isHubOperator,
    canDeleteHub: isAdmin,

    // Drones
    canCreateDrone: isAdmin || isHubOperator,
    canEditDrone: isAdmin || isHubOperator,
    canDeleteDrone: isAdmin,

    // Flights - all roles can create, but scope differs
    canCreateFlight: true,
    canManageAllFlights: isAdmin || isHubOperator,

    // Organizations - admin only
    canManageOrganizations: isAdmin,

    // Airspace
    canCreateAirspaceZone: isAdmin || isHubOperator,
    canDeleteAirspaceZone: isAdmin,

    // Connectivity
    canManageDeviceCertificates: isAdmin,
    canRegisterDevices: isAdmin || isHubOperator,

    // Settings - admin only for system settings
    canAccessSettings: isAdmin,

    // Role checks
    isAdmin,
    isHubOperator,
    isPilot,
  };
}
