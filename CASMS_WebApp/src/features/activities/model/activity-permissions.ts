type Access = { canDo: (permission: string) => boolean }
/** Match ActivityController at BE 15a113a, including its shared registration endpoints. */
export function registrationAccess(access: Access, kind: 'activities' | 'excursions') {
  return {
    read: access.canDo('ACTIVITY_ATTENDANCE') || access.canDo('ACTIVITY_REGISTRATION'),
    create: access.canDo(kind==='activities'?'ACTIVITY_REGISTRATION':'EXCURSION_BOOKING'),
    manage: access.canDo('ACTIVITY_REGISTRATION'),
    attend: access.canDo('ACTIVITY_ATTENDANCE'),
  }
}
