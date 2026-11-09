import { dateTime } from '../passenger-actions/passenger-model';
import type { PosContext, PosRequest } from './pos-api';

export function posDestination(user: { roles: readonly string[]; effectivePermissions?: readonly string[] | null } | undefined) {
  if (!user || user.roles.includes('PASSENGER')) return false;
  return user.roles.includes('ONBOARD_STAFF') || user.roles.includes('POS')
    || (user.roles.includes('OPERATIONS_MANAGER')
      && !!user.effectivePermissions?.includes('POS_ACCESS'));
}

export function employeeRole(roles: readonly string[]) {
  return !roles.includes('POS') && !roles.includes('PASSENGER')
    && (roles.includes('ONBOARD_STAFF') || roles.includes('OPERATIONS_MANAGER'));
}
export function eligibleEmployee(owner: string, me: { userId: string; status: string; roles: string[]; effectivePermissions: string[] }) {
  return me.userId === owner && me.status === 'ACTIVE' && employeeRole(me.roles) && me.effectivePermissions.includes('POS_ACCESS');
}
export function passengersFromRequests(services: PosContext['services'], rows: PosRequest[]) {
  const readable = new Map(services.filter(item => item.permissions.includes('SERVICE_REQUEST_READ'))
    .map(item => [item.serviceId, item.name]));
  const options = new Map<string, string>();
  for (const row of rows) {
    const label = readable.get(row.serviceId);
    if (row.bookingPassengerId && label && !options.has(row.bookingPassengerId)) {
      options.set(row.bookingPassengerId, `${label} · ${dateTime(row.requestTime)} · …${row.bookingPassengerId.slice(-8)}`);
    }
  }
  return [...options].map(([id, label]) => ({ id, label }));
}
