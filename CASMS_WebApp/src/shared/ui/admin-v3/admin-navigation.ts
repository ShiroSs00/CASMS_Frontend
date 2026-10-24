/** Navigation contract: CASMS Backend 15a113a. Session permissions gate actual access. */
export type AdminNavigationItem = { label: string; to?: string; permissions?: readonly string[] }
export type WorkspaceId = 'schedule' | 'operations' | 'services'
export type AdminAccess = { status: string; permissions: readonly string[] }
export type AdminWorkspace = {
  id: WorkspaceId; title: string; shortTitle: string; description: string; responsibility: string;
  permissions: readonly string[]; tools: readonly string[]; steps: readonly string[];
  action: { label: string; to: string; permission: string };
}
const tools: readonly AdminNavigationItem[] = [
  { label:'Hành khách trên tàu', to:'/admin/passenger-tracking', permissions:['BLE_TELEMETRY_READ'] },
  { label:'Model 3D', to:'/admin/ship-models', permissions:['SHIP_MODEL_READ'] },
  { label:'Dashboard', to:'/admin/fleet-dashboard', permissions:['SHIP_READ'] },
  { label:'Nhập thông tin tàu', to:'/admin/ship-import', permissions:['SHIP_MODEL_CREATE'] },
  { label:'Tài khoản hệ thống', to:'/admin/system', permissions:['USER_READ'] },
  { label:'Đặt chỗ', to:'/admin/bookings', permissions:['BOOKING_READ'] },
  { label:'Điểm đến', to:'/admin/destinations', permissions:['DESTINATION_READ'] },
  { label:'Cảng', to:'/admin/ports', permissions:['PORT_READ'] },
  { label:'Tàu', to:'/admin/ships', permissions:['SHIP_READ'] },
  { label:'Boong', to:'/admin/decks', permissions:['DECK_READ'] },
  { label:'Cabin', to:'/admin/cabins', permissions:['CABIN_READ'] },
  { label:'Chuyến du lịch', to:'/admin/cruises', permissions:['CRUISE_READ'] },
  { label:'Hải trình', to:'/admin/itineraries', permissions:['ITINERARY_READ'] },
  { label:'Quy định', to:'/admin/regulations', permissions:['REGULATION_READ'] },
  { label:'Sự cố vận hành', to:'/admin/issues', permissions:['OPERATIONAL_ISSUE_READ'] },
  { label:'Nhà cung cấp', to:'/admin/suppliers', permissions:['SUPPLIER_READ'] },
  { label:'Chuyến tham quan bờ', to:'/admin/shore-excursions', permissions:['EXCURSION_READ'] },
  { label:'Nhóm tour', to:'/admin/tour-groups', permissions:['TOUR_GROUP_READ'] },
  { label:'Hoạt động trên tàu', to:'/admin/activities', permissions:['ACTIVITY_READ'] },
  { label:'Dịch vụ', to:'/admin/services', permissions:['SERVICE_READ'] },
  { label:'Sản phẩm', to:'/admin/products', permissions:['PRODUCT_MANAGE'] },
  { label:'Gói dịch vụ', to:'/admin/service-packages', permissions:['TOUR_PACKAGE_MANAGE','TOUR_PACKAGE_ASSIGN','BOOKING_READ'] },
  { label:'Yêu cầu dịch vụ', to:'/admin/service-requests', permissions:['SERVICE_REQUEST_READ','SERVICE_REQUEST_CREATE'] },
  { label:'Phân bổ gói', to:'/admin/package-assignments', permissions:['TOUR_PACKAGE_ASSIGN','TOUR_PACKAGE_MANAGE','BOOKING_READ'] },
  { label:'Làm thủ tục', to:'/admin/staff/checkin', permissions:['CHECKIN_READ','CHECKIN_CREATE','CHECKIN_UPDATE'] },
  { label:'Tài chính', to:'/admin/staff/finance', permissions:['PAYMENT_REPORT'] },
]
export const adminWorkspaces: readonly AdminWorkspace[] = [
  { id:'schedule', title:'Quản lý lịch trình', shortTitle:'Lịch trình',
    description:'Thiết kế tuyến đi, sắp xếp lịch trình và chuẩn bị công bố chuyến du thuyền.',
    responsibility:'Chuyến đi · Hải trình · Cảng ghé', permissions:['CRUISE_READ','ITINERARY_READ'],
    tools:['cruises','itineraries','destinations','ports'],
    steps:['Kiểm tra điểm đến và cảng ghé.','Tạo chuyến, chọn tàu và thời gian dự kiến.','Sắp xếp ngày hành trình và điểm dừng.','Gửi duyệt và kiểm tra điều kiện công bố.'],
    action:{label:'Tạo chuyến du thuyền',to:'/admin/cruises/new',permission:'CRUISE_CREATE'} },
  { id:'operations', title:'Quản lý vận hành', shortTitle:'Vận hành',
    description:'Theo dõi đội tàu, duyệt lịch trình và điều phối hoạt động theo quyền được phân công.',
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
  return Boolean(item.to) && access.status==='ready' && Boolean(item.permissions?.some(p=>access.permissions.includes(p)))
}
export function canEnterWorkspace(workspace: AdminWorkspace, access: AdminAccess) {
  return access.status==='ready' && workspace.permissions.some(p=>access.permissions.includes(p))
}
export function workspaceUrl(workspace: AdminWorkspace) { return '/admin/workspaces/'+workspace.id }
export function workspaceTools(workspace: AdminWorkspace) { return workspace.tools.map(tool=>tools.find(item=>item.to==='/admin/'+tool)!) }
export function workspaceForPath(pathname: string) {
  const section=pathname.split('/')[2]
  if(pathname.split('/').includes('regulations')) return adminWorkspaces[1]
  if(section==='workspaces') return adminWorkspaces.find(w=>w.id===pathname.split('/')[3])
  if(section==='activity-registrations') return adminWorkspaces[2]
  if(section==='itinerary-history') return adminWorkspaces[0]
  return adminWorkspaces.find(w=>w.tools.includes(section))
}
export const adminToolDescriptions: Record<string,string> = {
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
export function staffRoleHome(roles: readonly string[]) {
  const role=primaryStaffRole(roles)
  if(role==='ADMIN') return '/admin/system'
  if(role==='CRUISE_MANAGER') return '/admin/cruises'
  if(role==='SHIP_MANAGER') return '/admin/fleet-dashboard'
  if(role==='OPERATIONS_MANAGER') return '/admin/issues'
  if(role==='ACTIVITY_SERVICE_MANAGER') return '/admin/activities'
  if(role==='ONBOARD_STAFF') return '/admin/service-requests'
  if(role==='BOOKING_AGENT'||role==='CUSTOMER_SERVICE') return '/admin/bookings'
  if(role==='CHECKIN_STAFF') return '/admin/staff/checkin'
  if(role==='FINANCE_OFFICER') return '/admin/staff/finance'
  return null
}
export function staffRoleLabel(roles: readonly string[]) {
  const role=primaryStaffRole(roles)
  const labels: Record<string,string> = {
    ADMIN:'Quản trị hệ thống', CRUISE_MANAGER:'Quản lý lịch trình', SHIP_MANAGER:'Quản lý đội tàu',
    OPERATIONS_MANAGER:'Quản lý vận hành', ACTIVITY_SERVICE_MANAGER:'Quản lý hoạt động và dịch vụ',
    BOOKING_AGENT:'Điều phối đặt chỗ', CUSTOMER_SERVICE:'Chăm sóc khách hàng',
    CHECKIN_STAFF:'Làm thủ tục', ONBOARD_STAFF:'Phục vụ trên tàu', FINANCE_OFFICER:'Tài chính',
  }
  return role ? labels[role] : 'Khu vực nhân sự'
}
const mutationPermissions: Record<string,readonly [readonly string[],readonly string[]]> = {
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
export function canRoleOpenAdminPath(roles: readonly string[], pathname: string, search='', access?: AdminAccess) {
  if(!primaryStaffRole(roles)) return false
  if(pathname==='/admin') return true
  if(pathname==='/admin/system'&&!roles.includes('ADMIN')) return false
  if(pathname==='/admin/ship-import'&&!roles.includes('ADMIN')) return false
  if(pathname==='/admin/ship-models'&&!roles.includes('ADMIN')) return false
  if(pathname==='/admin/passenger-tracking'&&!roles.includes('SHIP_MANAGER')) return false
  if(pathname==='/admin/fleet-dashboard'&&!roles.includes('SHIP_MANAGER')) return false
  if(pathname.replace(/\/$/,'')==='/admin/ships/new'&&roles.includes('SHIP_MANAGER')) return false
  const required=adminPathPermissions(pathname,search)
  const permissions=access ? (access.status==='ready'?access.permissions:[]) : roles.flatMap(role=>backendRolePermissions[role]??[])
  return required.some(p=>permissions.includes(p))
}
const roleJobSections: Record<string,readonly string[]> = {
  ADMIN:['system','ship-import','ship-models'],
  CRUISE_MANAGER:['cruises','itineraries','destinations','ports'],
  SHIP_MANAGER:['fleet-dashboard','ships','decks','passenger-tracking','cabins'],
  OPERATIONS_MANAGER:['issues','regulations','itineraries','cruises','bookings'],
  ACTIVITY_SERVICE_MANAGER:['activities','services','products','service-packages','service-requests','package-assignments','shore-excursions','tour-groups','suppliers'],
  ONBOARD_STAFF:['service-requests','activities','shore-excursions','tour-groups','services'],
  BOOKING_AGENT:['bookings','cabins','staff/checkin','package-assignments'],
  CUSTOMER_SERVICE:['bookings','service-requests','staff/checkin'],
  CHECKIN_STAFF:['staff/checkin','ships','decks','cabins'],
  FINANCE_OFFICER:['staff/finance','bookings'],
}
export function roleNavigationItems(roles: readonly string[], access: AdminAccess) {
  const role=primaryStaffRole(roles)
  const primary=(roleJobSections[role??'']??[]).map(section=>tools.find(tool=>tool.to==='/admin/'+section)!)
  const ordered=[...primary,...tools.filter(tool=>!primary.includes(tool))]
  const importOnlyAdmin=role==='ADMIN'&&!roles.includes('SHIP_MANAGER')
  const fleetPaths=['/admin/ships','/admin/decks','/admin/cabins']
  const managerPaths=['/admin/fleet-dashboard','/admin/ships','/admin/decks','/admin/passenger-tracking']
  return ordered.map(item=>role==='SHIP_MANAGER'&&item.to==='/admin/decks'?{...item,permissions:['DECK_READ','CABIN_READ']}:item)
    .filter(item=>!(importOnlyAdmin&&fleetPaths.includes(item.to!))&&(role!=='SHIP_MANAGER'||managerPaths.includes(item.to!))&&canOpenAdminItem(item,access)&&canRoleOpenAdminPath(roles,item.to!,'',access))
    .map(item=>role==='SHIP_MANAGER'?{...item,label:({'/admin/fleet-dashboard':'Dashboard','/admin/ships':'Ship','/admin/decks':'Boong & Cabin'} as Record<string,string>)[item.to!]??item.label}:item)
}
export type AdminNavigationGroup = { id: string; label: string; items: AdminNavigationItem[]; direct?: boolean }
const navigationGroups = [
  {id:'experiences',label:'Hoạt động và tour',sections:['activities','shore-excursions','tour-groups']},
  {id:'services',label:'Dịch vụ, sản phẩm và gói',sections:['services','products','service-packages','service-requests','package-assignments']},
  {id:'locations',label:'Điểm đến và đối tác',sections:['destinations','ports','suppliers']},
  {id:'fleet',label:'Đội tàu',sections:['ships','decks','cabins']},
  {id:'schedule',label:'Chuyến đi và lịch trình',sections:['cruises','itineraries']},
  {id:'bookings',label:'Đặt chỗ và đón khách',sections:['bookings','staff/checkin']},
  {id:'operations',label:'Vận hành và tuân thủ',sections:['issues','regulations']},
]
export function roleNavigationGroups(roles: readonly string[], access: AdminAccess): AdminNavigationGroup[] {
  if(primaryStaffRole(roles)==='SHIP_MANAGER') return roleNavigationItems(roles,access).map(item=>({id:item.to!.replace('/admin/',''),label:item.label,items:[item],direct:true}))
  const groups=new Map<string,AdminNavigationGroup>()
  for(const item of roleNavigationItems(roles,access)) {
    const section=item.to!.replace('/admin/','')
    const category=navigationGroups.find(group=>group.sections.includes(section))
    const id=category?.id ?? section
    if(!groups.has(id)) groups.set(id,{id,label:category?.label ?? item.label,items:[]})
    groups.get(id)!.items.push(item)
  }
  return [...groups.values()]
}
export function roleSafeAdminReturnTo(roles: readonly string[], value: string | null) {
  if(!value||value.includes('\\')||[...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)) return staffRoleHome(roles)
  try {const url=new URL(value,'https://ocevie.invalid'); return url.origin==='https://ocevie.invalid'&&canRoleOpenAdminPath(roles,url.pathname,url.search)?url.pathname+url.search+url.hash:staffRoleHome(roles)} catch {return staffRoleHome(roles)}
}

// BE 15a113a snapshot for pre-session landing only; runtime uses /auth/me.
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
