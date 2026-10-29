import { hasPermissions, hasWorkScope, actionInWorkScope, ROLE_WORK_MODULES, type PermissionRequirement } from '@/shared/auth'
import {businessCopy} from '@/shared/i18n/business-copy'
/** Access = union of role work scopes AND current /auth/me permissions. */
export type AdminNavigationItem = { label: string; to?: string; permissions?: readonly string[]; permissionMode?: 'ANY' | 'ALL' }
export type WorkspaceId = 'schedule' | 'operations' | 'services'
export type AdminAccess = { status: string; permissions: readonly string[]; roles?: readonly string[] }
export type AdminWorkspace = {
  id: WorkspaceId; title: string; shortTitle: string; description: string; responsibility: string;
  permissions: readonly string[]; tools: readonly string[]; steps: readonly string[];
  action: { label: string; to: string; permission: string };
}
const tools: readonly AdminNavigationItem[] = [
  { label:'Kế hoạch chờ OPS xét duyệt', to:'/admin/cruise-plan-reviews', permissionMode:'ALL', permissions:['CRUISE_READ','ITINERARY_APPROVE'] },
  { label:'Chuyến đi', to:'/admin/trips', permissionMode:'ALL', permissions:['TRIP_READ'] },
  { label:'Hành khách trên tàu', to:'/admin/passenger-tracking', permissionMode:'ALL', permissions:['SHIP_READ','BLE_TELEMETRY_READ'] },
  { label:'Model 3D', to:'/admin/ship-models', permissionMode:'ALL', permissions:['SHIP_READ','SHIP_MODEL_READ'] },
  { label:'Tổng quan đội tàu', to:'/admin/fleet-dashboard', permissionMode:'ANY', permissions:['SHIP_READ'] },
  { label:'Nhập thông tin tàu', to:'/admin/ship-import', permissionMode:'ANY', permissions:['SHIP_UPDATE','SHIP_MODEL_CREATE'] },
  { label:'Tài khoản nhân sự', to:'/admin/system', permissionMode:'ANY', permissions:['USER_READ'] },
  { label:'Đặt chỗ', to:'/admin/bookings', permissionMode:'ANY', permissions:['BOOKING_READ'] },
  { label:'Điểm đến', to:'/admin/destinations', permissionMode:'ANY', permissions:['DESTINATION_READ'] },
  { label:'Cảng', to:'/admin/ports', permissionMode:'ANY', permissions:['PORT_READ'] },
  { label:'Tàu', to:'/admin/ships', permissionMode:'ANY', permissions:['SHIP_READ'] },
  { label:'Boong', to:'/admin/decks', permissionMode:'ANY', permissions:['DECK_READ','CABIN_READ'] },
  { label:'Cabin', to:'/admin/cabins', permissionMode:'ANY', permissions:['CABIN_READ'] },
  { label:'Lần khởi hành', to:'/admin/cruises', permissionMode:'ANY', permissions:['CRUISE_READ'] },
  { label:'Lịch trình lần khởi hành', to:'/admin/itineraries', permissionMode:'ANY', permissions:['ITINERARY_READ'] },
  { label:'Quy định', to:'/admin/regulations', permissionMode:'ANY', permissions:['REGULATION_READ'] },
  { label:'Sự cố vận hành', to:'/admin/issues', permissionMode:'ANY', permissions:['OPERATIONAL_ISSUE_READ'] },
  { label:'Nhà cung cấp', to:'/admin/suppliers', permissionMode:'ANY', permissions:['SUPPLIER_READ'] },
  { label:'Tour tham quan trên bờ', to:'/admin/shore-excursions', permissionMode:'ANY', permissions:['EXCURSION_READ'] },
  { label:'Nhóm tour', to:'/admin/tour-groups', permissionMode:'ANY', permissions:['TOUR_GROUP_READ'] },
  { label:'Hoạt động trên tàu', to:'/admin/activities', permissionMode:'ANY', permissions:['ACTIVITY_READ'] },
  { label:'Dịch vụ', to:'/admin/services', permissionMode:'ANY', permissions:['SERVICE_READ'] },
  { label:'Sản phẩm', to:'/admin/products', permissionMode:'ANY', permissions:['PRODUCT_MANAGE'] },
  { label:'Gói dịch vụ', to:'/admin/service-packages', permissionMode:'ANY', permissions:['TOUR_PACKAGE_MANAGE','PACKAGE_COMPONENT_MANAGE'] },
  { label:'Yêu cầu dịch vụ', to:'/admin/service-requests', permissionMode:'ANY', permissions:['SERVICE_REQUEST_READ','SERVICE_REQUEST_CREATE'] },
  { label:'Gói của hành khách', to:'/admin/package-assignments', permissionMode:'ANY', permissions:['TOUR_PACKAGE_ASSIGN','BOOKING_READ'] },
  { label:'Làm thủ tục', to:'/admin/staff/checkin', permissionMode:'ANY', permissions:['CHECKIN_READ','CHECKIN_CREATE','CHECKIN_UPDATE'] },
  { label:'Tài chính', to:'/admin/staff/finance', permissionMode:'ANY', permissions:['PAYMENT_REPORT'] },
]
export const adminWorkspaces: readonly AdminWorkspace[] = [
  { id:'schedule', title:'Điều phối lịch trình', shortTitle:'Lịch trình',
    description:'Lập và chốt lịch trình mẫu; gửi kế hoạch khởi hành để OPS xét duyệt.',
    responsibility:'Chuyến đi · Lịch trình nguồn · Lần khởi hành', permissions:['TRIP_READ','CRUISE_READ'],
    tools:['trips','cruises','itineraries'],
    steps:['Tạo thông tin chuyến và chọn thời lượng, phạm vi.','Sắp xếp các ngày và lần ghé cảng.','Bổ sung hoạt động, tham quan và khung phục vụ.',businessCopy('workspace.crm.finalizeStep'),businessCopy('workspace.crm.departureStep')],
    action:{label:'Tạo chuyến đi',to:'/admin/trips/new',permission:'TRIP_CREATE'} },
  { id:'operations', title:'Quản lý vận hành', shortTitle:'Vận hành',
    description:businessCopy('workspace.ops.description'),
    responsibility:'Đội tàu · Điều phối · Tuân thủ', permissions:['SHIP_READ','REGULATION_READ','OPERATIONAL_ISSUE_READ'],
    tools:['ships','decks','cabins','bookings','issues','regulations'],
    steps:['Kiểm tra tàu, boong và cabin.','Rà soát lịch trình và thông tin chuyến.','Theo dõi quy định áp dụng và sự cố.','Phối hợp xử lý, xác minh và báo cáo.'],
    action:{label:'Ghi nhận sự cố',to:'/admin/issues/new',permission:'OPERATIONAL_ISSUE_CREATE'} },
  { id:'services', title:'Quản lý hoạt động và dịch vụ', shortTitle:'Hoạt động và dịch vụ',
    description:'Quản lý hoạt động, dịch vụ trên tàu và tour trên bờ trong cùng một khu vực.',
    responsibility:'Hoạt động · Dịch vụ · Tour trên bờ', permissions:['ACTIVITY_READ','SERVICE_READ','EXCURSION_READ'],
    tools:['activities','services','products','service-packages','service-requests','package-assignments','suppliers','shore-excursions','tour-groups'],
    steps:['Chuẩn bị hoạt động trên tàu và tour ghé cảng.','Cấu hình dịch vụ, sản phẩm, gói và quyền lợi.','Quản lý đăng ký, phân nhóm và điểm danh.','Theo dõi yêu cầu phục vụ và trạng thái hoạt động.'],
    action:{label:'Tạo hoạt động',to:'/admin/activities/new',permission:'ACTIVITY_CREATE'} },
]
export const adminNavigation = [{label:'CÔNG VIỆC VÀ TRA CỨU',items:tools}]
export function canOpenAdminItem(item: AdminNavigationItem, access: AdminAccess) {
  return Boolean(item.to) && access.status==='ready' && Boolean(item.permissionMode && item.permissions && hasPermissions(access,{mode:item.permissionMode,permissions:item.permissions}))
}
export function canEnterWorkspace(workspace: AdminWorkspace, access: AdminAccess) {
  return access.status==='ready' && hasPermissions(access,{mode:'ANY',permissions:workspace.permissions})
}
export function workspaceUrl(workspace: AdminWorkspace) { return '/admin/workspaces/'+workspace.id }
export function workspaceTools(workspace: AdminWorkspace) { return workspace.tools.map(tool=>tools.find(item=>item.to==='/admin/'+tool)!) }
export function workspaceForPath(pathname: string) {
  const section=pathname.split('/')[2]
  if(pathname.split('/').includes('regulations')) return adminWorkspaces[1]
  if(section==='workspaces') return adminWorkspaces.find(w=>w.id===pathname.split('/')[3])
  if(section==='activity-registrations') return adminWorkspaces[2]
  if(['cruises','itineraries','itinerary-history'].includes(section)) return adminWorkspaces[1]
  return adminWorkspaces.find(w=>w.tools.includes(section))
}
export const adminToolDescriptions: Record<string,string> = {
  trips:businessCopy('workspace.crm.tripDescription'),
  cruises:'Ngày khởi hành, tàu được phân công và vòng đời chuyến đi.', itineraries:'Lịch từng ngày, cảng ghé và thời gian dừng.',
  destinations:'Thông tin điểm đến và quốc gia trong tuyến đi.', ports:'Cảng và thông tin phục vụ lịch trình.',
  ships:'Trạng thái đội tàu và mức sẵn sàng vận hành.', decks:'Cấu trúc boong và liên kết với từng tàu.',
  cabins:'Loại cabin, sức chứa và trạng thái sử dụng.', bookings:'Đặt chỗ, hành khách và hợp đồng.',
  issues:'Ghi nhận, theo dõi và xử lý sự cố.', regulations:'Quy định áp dụng cho tàu và chuyến đi.',
  suppliers:'Thông tin đối tác và dịch vụ cung ứng.', 'shore-excursions':'Chuyến tham quan theo lịch ghé cảng.',
  'tour-groups':'Nhóm hành khách và điều phối tour.', activities:'Hoạt động, sức chứa và đăng ký trên tàu.',
  services:'Danh mục dịch vụ, giá và trạng thái.', products:'Sản phẩm cung cấp trong hành trình.',
  'service-packages':'Gói dịch vụ, thành phần và quyền lợi.', 'service-requests':'Yêu cầu, phân công và tiến độ phục vụ.',
  'package-assignments':'Gói và quyền lợi của hành khách.',
}
const staffRolePriority=['ADMIN','CRUISE_MANAGER','OPERATIONS_MANAGER','SHIP_MANAGER','ACTIVITY_SERVICE_MANAGER','ONBOARD_STAFF','BOOKING_AGENT','CUSTOMER_SERVICE','CHECKIN_STAFF','FINANCE_OFFICER'] as const
export function primaryStaffRole(roles: readonly string[]) { return staffRolePriority.find(r=>roles.includes(r)) }
export function roleWorkspace(roles: readonly string[]) {
  const role=primaryStaffRole(roles)
  const id=role==='CRUISE_MANAGER'?'schedule':role==='SHIP_MANAGER'||role==='OPERATIONS_MANAGER'?'operations':role==='ACTIVITY_SERVICE_MANAGER'?'services':undefined
  return adminWorkspaces.find(w=>w.id===id)
}
export function staffRoleHome(roles: readonly string[], access?: AdminAccess) {
  if (!primaryStaffRole(access?.roles ?? roles) || access?.status !== 'ready') return null
  return roleNavigationItems(roles, access)[0]?.to ?? null
}
export function staffRoleLabel(roles: readonly string[]) {
  const role=primaryStaffRole(roles)
  const labels: Record<string,string> = {
    ADMIN:'Quản trị hệ thống', CRUISE_MANAGER:'Điều phối lịch trình', SHIP_MANAGER:'Quản lý đội tàu',
    OPERATIONS_MANAGER:'Quản lý vận hành', ACTIVITY_SERVICE_MANAGER:'Quản lý hoạt động và dịch vụ',
    BOOKING_AGENT:'Điều phối đặt chỗ', CUSTOMER_SERVICE:'Chăm sóc khách hàng',
    CHECKIN_STAFF:'Làm thủ tục', ONBOARD_STAFF:'Phục vụ trên tàu', FINANCE_OFFICER:'Tài chính',
  }
  return role ? labels[role] : 'Khu vực nhân sự'
}
const mutationPermissions: Record<string,readonly [readonly string[],readonly string[]]> = {
  trips:[['TRIP_READ','TRIP_CREATE'],['TRIP_READ','TRIP_UPDATE']],
  bookings:[['BOOKING_CREATE'],[]], ships:[['SHIP_CREATE'],['SHIP_UPDATE']], decks:[['DECK_CREATE'],['DECK_UPDATE']],
  cabins:[['CABIN_CREATE'],['CABIN_UPDATE']], cruises:[['CRUISE_CREATE'],['CRUISE_UPDATE_DRAFT']],
  itineraries:[['ITINERARY_CREATE'],['ITINERARY_UPDATE_DRAFT']], destinations:[['DESTINATION_CREATE'],['DESTINATION_UPDATE']],
  ports:[['PORT_CREATE'],['PORT_UPDATE']], issues:[['OPERATIONAL_ISSUE_CREATE'],['OPERATIONAL_ISSUE_UPDATE']],
  regulations:[['REGULATION_CREATE'],['REGULATION_UPDATE']], suppliers:[['SUPPLIER_CREATE'],['SUPPLIER_UPDATE']],
  'shore-excursions':[['EXCURSION_CREATE'],['EXCURSION_UPDATE']], 'tour-groups':[['TOUR_GROUP_CREATE'],['TOUR_GROUP_UPDATE']],
  activities:[['ACTIVITY_CREATE'],['ACTIVITY_UPDATE']], services:[['SERVICE_CREATE'],['SERVICE_UPDATE']],
  products:[['PRODUCT_MANAGE'],['PRODUCT_MANAGE']], 'service-packages':[['TOUR_PACKAGE_MANAGE'],['TOUR_PACKAGE_MANAGE']],
  'service-requests':[['SERVICE_REQUEST_CREATE'],['SERVICE_REQUEST_CREATE','SERVICE_REQUEST_EXECUTE']],
}
export function adminPathPermissions(pathname: string, search=''): readonly string[] {
  void search // BE uses the same read authority for both registration targets.
  const section=pathname.split('/')[2], parts=pathname.split('/')
  if(parts.includes('regulations') && section!=='regulations') return [section==='ships'?'SHIP_REGULATION_READ':'CRUISE_REGULATION_READ']
  if(section==='activity-registrations') return ['ACTIVITY_ATTENDANCE','ACTIVITY_REGISTRATION']
  if(section==='itinerary-history') return ['ITINERARY_CHANGE_READ']
  if(parts[3]==='new') return mutationPermissions[section]?.[0] ?? []
  if(parts[4]==='edit') return mutationPermissions[section]?.[1] ?? []
  if(section==='decks'&&!parts[3]) return ['DECK_READ','CABIN_READ']
  return tools.find(item=>item.to===('/admin/'+section+(section==='staff'?'/'+parts[3]:'')))?.permissions ?? []
}
export function adminPathRequirements(pathname: string, search = ''): readonly PermissionRequirement[] {
  const permissions = adminPathPermissions(pathname, search)
  if (!permissions.length) return []
  const section = pathname.split('/')[2]
  const tool = tools.find(item => item.to === '/admin/' + section)
  const requirements: PermissionRequirement[] = [{ mode: tool?.permissionMode ?? 'ANY', permissions }]
  if (section === 'passenger-tracking') requirements.push({ mode: 'ALL', permissions: [], roles: ['SHIP_MANAGER'] })
  if (section === 'ship-import') return [{ mode: 'ALL', permissions: [], anyOf: [
    { mode: 'ALL', permissions: ['SHIP_UPDATE'] },
    { mode: 'ALL', permissions: ['SHIP_MODEL_CREATE'], anyOf: [{ mode: 'ANY', permissions: ['SHIP_CREATE','SHIP_UPDATE'] }] },
  ] }]
  // Edit screens load the saved record before exposing mutations: read AND edit.
  const parts = pathname.split('/')
  if (parts[4] === 'edit') {
    const read = tools.find(item => item.to === '/admin/' + parts[2])
    if (read?.permissions) requirements.push({ mode: read.permissionMode ?? 'ANY', permissions: read.permissions })
  }
  return requirements
}
function workModuleForPath(pathname: string): string | null {
  const parts = pathname.split('/')
  if (parts[2] === 'trips') return /^\/admin\/trips(?:\/new|\/[^/]+\/(?:info|schedule))?$/.test(pathname) ? 'trips' : null
  if (parts.includes('regulations') && parts[2] !== 'regulations') {
    return /^\/admin\/(ships|cruises)\/[^/]+\/regulations$/.test(pathname) ? (parts[2] === 'ships' ? 'ship-regulations' : 'cruise-regulations') : null
  }
  if (parts[2] === 'staff') return /^\/admin\/staff\/(checkin|finance)$/.test(pathname) ? 'staff/' + parts[3] : null
  if (parts.length === 3 && (tools.some(item => item.to === pathname) || ['activity-registrations','itinerary-history'].includes(parts[2]))) return parts[2]
  if (mutationPermissions[parts[2]] && (parts.length === 4 || (parts.length === 5 && parts[4] === 'edit'))) return parts[2]
  return null
}
export function canRoleOpenAdminPath(roles: readonly string[], pathname: string, search='', access?: AdminAccess) {
  const currentRoles = access?.roles ?? roles
  if (!primaryStaffRole(currentRoles) || access?.status !== 'ready' || pathname.includes(String.fromCharCode(92)) || pathname.includes('%') || pathname.endsWith('/')) return false
  if (pathname === '/admin') return true
  const module = workModuleForPath(pathname)
  const parts = pathname.split('/')
  // Fleet links may inspect a related Cruise; this does not open its management workspace.
  const shipCruiseDetail = module === 'cruises' && currentRoles.some(role=>['SHIP_MANAGER','FINANCE_OFFICER'].includes(role)) && parts.length === 4 && parts[3] !== 'new'
  if (!module || (!hasWorkScope(currentRoles, module) && !shipCruiseDetail)) return false
  const requirements = adminPathRequirements(pathname, search)
  if (parts[2] === 'trips' && parts[3] === 'new' && !actionInWorkScope(currentRoles, 'TRIP_CREATE')) return false
  if ((parts[3] === 'new' || parts[4] === 'edit') && !adminPathPermissions(pathname, search).some(permission => actionInWorkScope(currentRoles, permission))) return false
  return requirements.length > 0 && requirements.every(requirement => hasPermissions({...access, roles: currentRoles},requirement))
}
export function roleNavigationItems(roles: readonly string[], access: AdminAccess) {
  const currentRoles = access.roles ?? roles
  const primaryRole = primaryStaffRole(currentRoles)
  const orderedRoles = [primaryRole, ...currentRoles.filter(role => role !== primaryRole)].filter((role): role is string => Boolean(role))
  const sections = [...new Set(orderedRoles.flatMap(role => ROLE_WORK_MODULES[role] ?? []))]
  const ordered = sections.flatMap(section => tools.filter(item => item.to === '/admin/' + section))
  return ordered.filter(item=>canOpenAdminItem(item,access)&&canRoleOpenAdminPath(currentRoles,item.to!,'',access))
    .map(item=>primaryRole==='SHIP_MANAGER'&&item.to==='/admin/decks'?{...item,label:'Boong & Cabin'}:item)
}
export type AdminNavigationGroup = { id: string; label: string; items: AdminNavigationItem[]; direct?: boolean }
const navigationGroups = [
  {id:'experiences',label:'Hoạt động và tour',sections:['activities','shore-excursions','tour-groups']},
  {id:'services',label:'Dịch vụ, sản phẩm và gói',sections:['services','products','service-packages','service-requests','package-assignments']},
  {id:'locations',label:'Điểm đến và đối tác',sections:['destinations','ports','suppliers']},
  {id:'fleet',label:'Đội tàu',sections:['ships','decks','cabins']},
  {id:'schedule',label:'Lập lịch trình',sections:['trips']},
  {id:'cruise-operations',label:'Lần khởi hành',sections:['cruises','itineraries']},
  {id:'bookings',label:'Đặt chỗ và đón khách',sections:['bookings','staff/checkin']},
  {id:'operations',label:'Vận hành và tuân thủ',sections:['issues','regulations']},
]
export function roleNavigationGroups(roles: readonly string[], access: AdminAccess): AdminNavigationGroup[] {
  if(primaryStaffRole(access.roles ?? roles)==='SHIP_MANAGER') return roleNavigationItems(roles,access).map(item=>({id:item.to!.replace('/admin/',''),label:item.label,items:[item],direct:true}))
  const groups=new Map<string,AdminNavigationGroup>()
  for(const item of roleNavigationItems(roles,access)) {
    const section=item.to!.replace('/admin/','')
    const category=navigationGroups.find(group=>group.sections.includes(section))
    const id=category?.id ?? section
    if(!groups.has(id)) groups.set(id,{id,label:category?.label ?? item.label,items:[],direct:id==='schedule'})
    groups.get(id)!.items.push(item)
  }
  return [...groups.values()]
}
export function roleSafeAdminReturnTo(roles: readonly string[], value: string | null, access?: AdminAccess) {
  const home = staffRoleHome(roles,access)
  if (!value || value.includes('\\') || [...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return home
  try {
    const url = new URL(value,'https://ocevie.invalid')
    return url.origin === 'https://ocevie.invalid' && canRoleOpenAdminPath(roles,url.pathname,url.search,access) ? url.pathname + url.search + url.hash : home
  } catch { return home }
}

// Historical BE 15a113a snapshot; NOT used for landing, menu, routes or requests.
export const backendRolePermissions: Record<string, readonly string[]> = {
  ADMIN: 'SHIP_CREATE SHIP_READ SHIP_UPDATE BLE_ANCHOR_ACTIVATE BLE_ANCHOR_CREATE BLE_ANCHOR_DEACTIVATE BLE_ANCHOR_DELETE BLE_ANCHOR_INSTALL BLE_ANCHOR_READ BLE_ANCHOR_RETIRE BLE_ANCHOR_UPDATE BLE_ANCHOR_VALIDATE BLE_TELEMETRY_READ BLE_TELEMETRY_RECEIVE SHIP_CONFIGURATION_READ SHIP_CONFIGURATION_VALIDATE SHIP_MODEL_CREATE SHIP_MODEL_DELETE SHIP_MODEL_OBJECT_CREATE SHIP_MODEL_OBJECT_DELETE SHIP_MODEL_OBJECT_UPDATE SHIP_MODEL_PUBLISH SHIP_MODEL_READ SHIP_MODEL_UPDATE USER_CREATE USER_READ USER_ROLE_ASSIGN USER_STATUS_CHANGE USER_UPDATE'.split(' '),
  CRUISE_MANAGER: 'BOOKING_READ CRUISE_ASSIGN_SHIP CRUISE_CANCEL CRUISE_CHANGE_SHIP CRUISE_COMPLETE CRUISE_CREATE CRUISE_DELETE_DRAFT CRUISE_PUBLISH CRUISE_READ CRUISE_REGULATION_ASSIGN CRUISE_REGULATION_READ CRUISE_REGULATION_REMOVE CRUISE_START CRUISE_STATUS_CHANGE CRUISE_STOP_ACTUAL_ARRIVAL CRUISE_STOP_ACTUAL_DEPARTURE CRUISE_STOP_ADD CRUISE_STOP_ALL_ABOARD CRUISE_STOP_OMIT CRUISE_STOP_READ CRUISE_STOP_REMOVE_DRAFT CRUISE_STOP_REORDER CRUISE_STOP_SUBSTITUTE CRUISE_STOP_TIME_MANAGE CRUISE_STOP_UPDATE CRUISE_STOP_VALIDATE CRUISE_UNASSIGN_SHIP CRUISE_UPDATE_DRAFT CRUISE_VALIDATE DESTINATION_READ EXCURSION_READ ITINERARY_APPLY_CHANGE ITINERARY_CANCEL ITINERARY_CHANGE_READ ITINERARY_CHANGE_RECORD ITINERARY_CREATE ITINERARY_DAY_CREATE ITINERARY_DAY_DELETE ITINERARY_DAY_READ ITINERARY_DAY_TIMEZONE_SET ITINERARY_DAY_TYPE_SET ITINERARY_DAY_UPDATE ITINERARY_DAYS_MANAGE ITINERARY_DELETE_DRAFT ITINERARY_PUBLISH ITINERARY_READ ITINERARY_SUBMIT ITINERARY_UPDATE_DRAFT ITINERARY_VALIDATE OPERATIONAL_ISSUE_READ PORT_READ REGULATION_READ REPORT_GENERATE SERVICE_READ SERVICE_REQUEST_READ SHIP_READ SUPPLIER_READ TOUR_GROUP_READ'.split(' '),
  SHIP_MANAGER: 'BLE_ANCHOR_ACTIVATE BLE_ANCHOR_CREATE BLE_ANCHOR_DEACTIVATE BLE_ANCHOR_DELETE BLE_ANCHOR_INSTALL BLE_ANCHOR_READ BLE_ANCHOR_RETIRE BLE_ANCHOR_UPDATE BLE_ANCHOR_VALIDATE BLE_TELEMETRY_READ BLE_TELEMETRY_RECEIVE CABIN_ASSIGNMENTS_VIEW CABIN_AVAILABILITY CABIN_BLOCK CABIN_CREATE CABIN_DELETE CABIN_READ CABIN_RELEASE CABIN_SEARCH CABIN_STATUS_CHANGE CABIN_UPDATE CABIN_VALIDATE CRUISE_READ CRUISE_STOP_READ DECK_CABINS_VIEW DECK_CREATE DECK_DELETE DECK_READ DECK_UPDATE DECK_VALIDATE DESTINATION_READ ITINERARY_DAY_READ ITINERARY_READ PORT_READ REGULATION_READ REPORT_GENERATE SHIP_AFFECTED_CRUISES SHIP_CAPACITY_SUMMARY SHIP_CONFIGURATION_READ SHIP_CONFIGURATION_VALIDATE SHIP_CREATE SHIP_CURRENT_CRUISE SHIP_DELETE SHIP_MODEL_CREATE SHIP_MODEL_DELETE SHIP_MODEL_OBJECT_CREATE SHIP_MODEL_OBJECT_DELETE SHIP_MODEL_OBJECT_UPDATE SHIP_MODEL_PUBLISH SHIP_MODEL_READ SHIP_MODEL_UPDATE SHIP_READ SHIP_READINESS SHIP_REGULATION_ASSIGN SHIP_REGULATION_READ SHIP_REGULATION_REMOVE SHIP_SCHEDULE_CHECK SHIP_STATUS_CHANGE SHIP_UPDATE SHIP_VALIDATE'.split(' '),
  OPERATIONS_MANAGER: 'BLE_ANCHOR_READ BLE_TELEMETRY_READ BOOKING_READ CABIN_AVAILABILITY CABIN_READ CABIN_SEARCH CRUISE_COMPLETE CRUISE_READ CRUISE_REGULATION_ASSIGN CRUISE_REGULATION_READ CRUISE_REGULATION_REMOVE CRUISE_STAFF_ASSIGN CRUISE_STAFF_READ CRUISE_STAFF_REMOVE CRUISE_START CRUISE_STATUS_CHANGE CRUISE_STOP_ACTUAL_ARRIVAL CRUISE_STOP_ACTUAL_DEPARTURE CRUISE_STOP_OMIT CRUISE_STOP_READ CRUISE_STOP_SUBSTITUTE CRUISE_STOP_TIME_MANAGE CRUISE_STOP_VALIDATE CRUISE_VALIDATE DECK_READ DESTINATION_CREATE DESTINATION_DELETE_UNUSED DESTINATION_PORTS_VIEW DESTINATION_READ DESTINATION_UPDATE DESTINATION_VALIDATE EXCURSION_READ ITINERARY_APPROVE ITINERARY_CHANGE_READ ITINERARY_CHANGE_RECORD ITINERARY_DAY_READ ITINERARY_DAYS_MANAGE ITINERARY_READ ITINERARY_REJECT OPERATIONAL_ISSUE_ASSIGN OPERATIONAL_ISSUE_CREATE OPERATIONAL_ISSUE_ESCALATE OPERATIONAL_ISSUE_READ OPERATIONAL_ISSUE_RESOLVE OPERATIONAL_ISSUE_UPDATE PORT_ACTIVATE PORT_CREATE PORT_DEACTIVATE PORT_DELETE_UNUSED PORT_READ PORT_UPDATE PORT_VALIDATE REGULATION_ACTIVATE REGULATION_CREATE REGULATION_DEACTIVATE REGULATION_DELETE REGULATION_READ REGULATION_UPDATE REGULATION_VALIDATE REPORT_EXPORT REPORT_GENERATE SERVICE_READ SHIP_AFFECTED_CRUISES SHIP_CAPACITY_SUMMARY SHIP_CONFIGURATION_READ SHIP_CURRENT_CRUISE SHIP_MODEL_READ SHIP_READ SHIP_READINESS SHIP_REGULATION_ASSIGN SHIP_REGULATION_READ SHIP_REGULATION_REMOVE SHIP_SCHEDULE_CHECK SHIP_STATUS_CHANGE SUPPLIER_CREATE SUPPLIER_READ SUPPLIER_STATUS_CHANGE SUPPLIER_UPDATE SUPPLIER_VALIDATE SUPPLIER_VERIFY TOUR_GROUP_PASSENGER_READ TOUR_GROUP_READ'.split(' '),
  BOOKING_AGENT: 'BOOKING_CABIN_ASSIGN BOOKING_CANCEL BOOKING_CONFIRM BOOKING_CONTRACT_MANAGE BOOKING_CREATE BOOKING_READ BOOKING_UPDATE CABIN_ASSIGNMENTS_VIEW CABIN_AVAILABILITY CABIN_BLOCK CABIN_READ CABIN_RELEASE CABIN_SEARCH CABIN_STATUS_CHANGE CHECKIN_BOARDING CHECKIN_CREATE CHECKIN_DOCUMENT_VERIFY CHECKIN_IDENTITY_VERIFY CHECKIN_PAYMENT_VERIFY CHECKIN_READ CHECKIN_STEP_UPDATE CHECKIN_UPDATE CRUISE_READ CRUISE_STOP_READ DECK_CABINS_VIEW DECK_READ DESTINATION_READ ITINERARY_DAY_READ ITINERARY_READ NOTIFICATION_SEND PORT_READ REPORT_GENERATE SERVICE_READ SERVICE_REQUEST_READ SHIP_CONFIGURATION_READ SHIP_MODEL_READ SHIP_READ TOUR_PACKAGE_ASSIGN'.split(' '),
  CUSTOMER_SERVICE: 'ACTIVITY_READ BOOKING_CANCEL BOOKING_READ BOOKING_UPDATE CABIN_ASSIGNMENTS_VIEW CABIN_AVAILABILITY CABIN_READ CABIN_SEARCH CHECKIN_READ CHECKIN_UPDATE CRUISE_READ CRUISE_STOP_READ DECK_READ DESTINATION_READ EXCURSION_READ FEEDBACK_READ FEEDBACK_REVIEW ITINERARY_DAY_READ ITINERARY_READ NOTIFICATION_READ NOTIFICATION_SEND PORT_READ REPORT_GENERATE SERVICE_READ SERVICE_REQUEST_CREATE SERVICE_REQUEST_READ SHIP_READ USER_READ USER_UPDATE'.split(' '),
  CHECKIN_STAFF: 'CABIN_AVAILABILITY CABIN_READ CABIN_SEARCH CHECKIN_BOARDING CHECKIN_CREATE CHECKIN_DOCUMENT_VERIFY CHECKIN_IDENTITY_VERIFY CHECKIN_PAYMENT_VERIFY CHECKIN_READ CHECKIN_STEP_UPDATE CHECKIN_UPDATE CHECKOUT_PROCESS CRUISE_READ CRUISE_STOP_READ DECK_READ DESTINATION_READ ITINERARY_DAY_READ ITINERARY_READ PASSENGER_BLE_ASSIGN PASSENGER_BLE_HISTORY PASSENGER_BLE_READ PASSENGER_BLE_REVOKE PORT_READ SHIP_READ'.split(' '),
  ACTIVITY_SERVICE_MANAGER: 'ACTIVITY_ATTENDANCE ACTIVITY_CREATE ACTIVITY_LIFECYCLE ACTIVITY_READ ACTIVITY_REGISTRATION ACTIVITY_UPDATE CRUISE_READ CRUISE_STOP_READ DECK_READ DESTINATION_READ EXCURSION_BOOKING EXCURSION_CREATE EXCURSION_DELETE_DRAFT EXCURSION_READ EXCURSION_STATUS_CHANGE EXCURSION_UPDATE EXCURSION_VALIDATE FEEDBACK_READ FEEDBACK_REVIEW ITINERARY_DAY_READ ITINERARY_READ NOTIFICATION_READ NOTIFICATION_SEND PACKAGE_COMPONENT_MANAGE PARTICIPATION_ATTENDANCE PORT_READ PRODUCT_MANAGE REGISTRATION_MANAGE REPORT_EXPORT REPORT_GENERATE SERVICE_ACTIVATE SERVICE_CREATE SERVICE_DELETE_UNUSED SERVICE_READ SERVICE_REQUEST_ASSIGN SERVICE_REQUEST_EXECUTE SERVICE_REQUEST_READ SERVICE_SUSPEND SERVICE_UPDATE SHIP_READ SUPPLIER_CREATE SUPPLIER_DELETE SUPPLIER_READ SUPPLIER_STATUS_CHANGE SUPPLIER_UPDATE SUPPLIER_VALIDATE SUPPLIER_VERIFY TOUR_GROUP_CREATE TOUR_GROUP_GUIDE_ASSIGN TOUR_GROUP_PASSENGER_ASSIGN TOUR_GROUP_PASSENGER_ATTENDANCE TOUR_GROUP_PASSENGER_MOVE TOUR_GROUP_PASSENGER_READ TOUR_GROUP_PASSENGER_REMOVE TOUR_GROUP_PASSENGER_VALIDATE TOUR_GROUP_READ TOUR_GROUP_STATUS_CHANGE TOUR_GROUP_UPDATE TOUR_GROUP_VALIDATE TOUR_PACKAGE_MANAGE'.split(' '),
  ONBOARD_STAFF: 'ACTIVITY_ATTENDANCE ACTIVITY_READ BLE_TELEMETRY_READ CHECKOUT_PROCESS CRUISE_READ CRUISE_STOP_READ DECK_READ DESTINATION_READ EXCURSION_READ ITINERARY_DAY_READ ITINERARY_READ NOTIFICATION_SEND PARTICIPATION_ATTENDANCE PAYMENT_PROCESS PORT_READ PRODUCT_SALE SERVICE_READ SERVICE_REQUEST_ASSIGN SERVICE_REQUEST_EXECUTE SERVICE_REQUEST_READ SHIP_READ TOUR_GROUP_PASSENGER_ATTENDANCE TOUR_GROUP_PASSENGER_READ TOUR_GROUP_READ'.split(' '),
  FINANCE_OFFICER: 'BOOKING_CONFIRM BOOKING_READ CHECKIN_READ CRUISE_READ CRUISE_STOP_READ INVOICE_GENERATE ITINERARY_DAY_READ ITINERARY_READ PAYMENT_PROCESS PAYMENT_READ PAYMENT_REFUND PAYMENT_REPORT REPORT_EXPORT REPORT_GENERATE SETTLEMENT_PROCESS'.split(' '),
  PASSENGER: 'ACTIVITY_READ ACTIVITY_REGISTRATION BOOKING_CANCEL BOOKING_CREATE BOOKING_READ CABIN_READ CHECKIN_CREATE CHECKIN_READ CRUISE_READ CRUISE_STOP_READ DECK_CABINS_VIEW DECK_READ DESTINATION_READ EXCURSION_BOOKING EXCURSION_READ FEEDBACK_READ FEEDBACK_SUBMIT ITINERARY_CHANGE_READ ITINERARY_DAY_READ ITINERARY_READ NOTIFICATION_READ PAYMENT_READ PORT_READ SERVICE_READ SERVICE_REQUEST_CREATE SERVICE_REQUEST_READ SHIP_READ TOUR_PACKAGE_ASSIGN'.split(' '),
}
