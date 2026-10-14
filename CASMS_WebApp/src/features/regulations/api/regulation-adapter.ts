import { regulationApi } from './regulation-api'

/** Live-only: failed requests must never become successful demo writes. */
export const regulationAdapter = {
  ...regulationApi,
  source: 'backend' as const,
  sourceLabel: 'Chế độ API backend · không dùng dữ liệu demo',
  sourceNotice: '',
}
