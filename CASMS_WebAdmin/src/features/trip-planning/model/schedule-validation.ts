import type { PlanningGateway } from '../api/gateway'
import { PlanningFault } from '../api/gateway'
import type { Report, Version } from './plan'

export function scheduleValidationKey(version: Pick<Version, 'versionId' | 'revision'>, generation: number) {
  return JSON.stringify([version.versionId, version.revision, generation])
}

export function reportMatchesVersion(report: Report, version: Pick<Version, 'versionId' | 'revision'>) {
  return report.versionId === version.versionId && report.revision === version.revision
}

export async function createScheduleTemplate(
  gateway: Pick<PlanningGateway, 'validate' | 'action'>,
  loadTarget: () => Promise<Version>,
) {
  const target = await loadTarget()
  const report = await gateway.validate(target)
  if (!reportMatchesVersion(report, target)) {
    throw new PlanningFault('Lịch trình đã thay đổi. Hãy đối chiếu dữ liệu trước khi tạo mẫu.', 409, 'STALE_VALIDATION')
  }
  if (!report.validForSubmit || report.violations.some(issue => issue.severity === 'ERROR')) return { report }

  try {
    const version = await gateway.action(target, 'finalize')
    if (version.versionId !== target.versionId || version.status !== 'PUBLISHED') {
      throw new PlanningFault('Hệ thống chưa xác nhận được mẫu đã tạo.', 502, 'READBACK_MISMATCH')
    }
    return { version }
  } catch (error) {
    if (error instanceof PlanningFault && error.status > 0 && error.status < 500) throw error
    throw new PlanningFault('Chưa xác định được mẫu đã tạo hay chưa. Hãy đối chiếu trước khi thử lại.', 502, 'FINALIZE_UNCERTAIN')
  }
}

export function createScheduleValidator() {
  const pending = new Map<string, Promise<Report>>()
  return (gateway: Pick<PlanningGateway, 'validate'>, version: Version, key: string) => {
    const current = pending.get(key)
    if (current) return current
    const request = Promise.resolve().then(() => gateway.validate(version)).finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }
}
