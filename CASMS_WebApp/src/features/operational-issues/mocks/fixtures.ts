import type {
  CruiseReference,
  OperationalIssueRecord,
  PersonReference,
  ShipReference,
} from '../model/issue'

export const mockHandlers: PersonReference[] = [
  { id: 'ops-team-a', name: 'Ops Team A' },
  { id: 'fb-lead', name: 'F&B Lead' },
  { id: 'housekeeping', name: 'Housekeeping' },
  { id: 'shore-ops', name: 'Shore Ops' },
]

export const mockPeople: PersonReference[] = [
  ...mockHandlers,
  { id: 'ops-user', name: 'Nhân viên vận hành' },
  { id: 'system', name: 'CASMS System' },
]

export const mockShips: ShipReference[] = [
  { id: 'aurora', name: 'CASMS Aurora' },
  { id: 'horizon', name: 'CASMS Horizon' },
]

export const mockCruises: CruiseReference[] = [
  { id: 'cr-261120-01', code: 'CR-261120-01', name: 'Lan Hạ', shipId: 'aurora' },
  { id: 'cr-271120-02', code: 'CR-271120-02', name: 'Cát Bà', shipId: 'aurora' },
  { id: 'cr-021220-01', code: 'CR-021220-01', name: 'Hạ Long', shipId: 'horizon' },
]

export const mockCabins: Record<string, string> = { 'cabin-d203': 'D203' }

export const initialIssueRecords: OperationalIssueRecord[] = [
  {
    issueId: 'issue-104', issueCode: 'OPS-104', cruiseId: 'cr-261120-01', shipId: 'aurora',
    cabinId: null, issueType: 'OPERATIONAL', severity: 'HIGH', status: 'OPEN',
    description: 'Tender bị gián đoạn. Tender transfer tại Lan Hạ tạm gián đoạn do điều kiện vận hành.',
    reportedAt: '2026-10-10T08:42:00+07:00', resolvedAt: null, reportedBy: 'ops-user',
    resolvedBy: null, resolution: null, assignedTo: null,
    createdAt: '2026-10-10T08:42:00+07:00', updatedAt: '2026-10-10T08:42:00+07:00',
  },
  {
    issueId: 'issue-103', issueCode: 'OPS-103', cruiseId: 'cr-261120-01', shipId: 'aurora',
    cabinId: null, issueType: 'OPERATIONAL', severity: 'MEDIUM', status: 'IN_PROGRESS',
    description: 'Dining venue tạm đóng. Dining Studio đang được kiểm tra thiết bị.',
    reportedAt: '2026-10-10T07:15:00+07:00', resolvedAt: null, reportedBy: 'ops-user',
    resolvedBy: null, resolution: null, assignedTo: 'fb-lead',
    createdAt: '2026-10-10T07:15:00+07:00', updatedAt: '2026-10-10T07:28:00+07:00',
  },
  {
    issueId: 'issue-101', issueCode: 'OPS-101', cruiseId: 'cr-271120-02', shipId: 'aurora',
    cabinId: 'cabin-d203', issueType: 'CABIN', severity: 'LOW', status: 'RESOLVED',
    description: 'Cabin water issue. Áp lực nước cabin D203 đã được kiểm tra.',
    reportedAt: '2026-10-09T15:20:00+07:00', resolvedAt: '2026-10-09T16:35:00+07:00',
    reportedBy: 'ops-user', resolvedBy: 'housekeeping',
    resolution: 'Khôi phục áp lực nước và kiểm tra lại đường cấp.', assignedTo: 'housekeeping',
    createdAt: '2026-10-09T15:20:00+07:00', updatedAt: '2026-10-09T16:35:00+07:00',
  },
  {
    issueId: 'issue-099', issueCode: 'OPS-099', cruiseId: 'cr-021220-01', shipId: 'horizon',
    cabinId: null, issueType: 'OPERATIONAL', severity: 'MEDIUM', status: 'CLOSED',
    description: 'Supplier excursion delay. Nhà cung cấp tour bờ đến trễ tại Hạ Long.',
    reportedAt: '2026-10-08T10:05:00+07:00', resolvedAt: '2026-10-08T11:10:00+07:00',
    reportedBy: 'ops-user', resolvedBy: 'shore-ops',
    resolution: 'Điều phối lại giờ khởi hành và thông báo hành khách.', assignedTo: 'shore-ops',
    createdAt: '2026-10-08T10:05:00+07:00', updatedAt: '2026-10-08T11:25:00+07:00',
  },
  {
    issueId: 'issue-108', issueCode: 'OPS-108', cruiseId: 'cr-021220-01', shipId: 'horizon',
    cabinId: null, issueType: 'WEATHER', severity: 'CRITICAL', status: 'OPEN',
    description: 'Weather routing review. Điều kiện thời tiết cần bộ phận có thẩm quyền rà soát.',
    reportedAt: '2026-10-10T09:10:00+07:00', resolvedAt: null, reportedBy: 'system',
    resolvedBy: null, resolution: null, assignedTo: null,
    createdAt: '2026-10-10T09:10:00+07:00', updatedAt: '2026-10-10T09:10:00+07:00',
  },
]
