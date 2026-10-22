type Access = { has: (permission: string) => boolean }
/** Match ActivityController at BE 15a113a, including its shared registration endpoints. */
export function registrationAccess(access: Access, kind: 'activities' | 'excursions') {
  return {
    read: access.has('ACTIVITY_ATTENDANCE') || access.has('ACTIVITY_REGISTRATION'),
    create: access.has(kind==='activities'?'ACTIVITY_REGISTRATION':'EXCURSION_BOOKING'),
    manage: access.has('ACTIVITY_REGISTRATION'),
    attend: access.has('ACTIVITY_ATTENDANCE'),
  }
}
