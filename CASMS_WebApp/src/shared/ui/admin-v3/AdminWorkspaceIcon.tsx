import type { WorkspaceId } from './admin-navigation'

const paths: Record<WorkspaceId, string[]> = {
  schedule: ['M7 3v4m10-4v4M4 10h16', 'M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z', 'm8 15 3 3 5-5'],
  operations: ['m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z', 'm8 12 3 3 5-6'],
  services: ['M4 14h16l-3 6H7l-3-6Zm4 0V8h8v6M10 8V4h4v4', 'M3 22c2-2 4 2 6 0s4 2 6 0 4 2 6 0'],
}
export function AdminWorkspaceIcon({ workspace }: { workspace: WorkspaceId }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[workspace].map(path => <path key={path} d={path} />)}</svg>
}
