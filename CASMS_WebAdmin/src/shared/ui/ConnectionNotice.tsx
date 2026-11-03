import { useSyncExternalStore } from 'react'
import { Notice } from './AdminUI'

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback) }
}

export function ConnectionNotice() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (online) return null
  return <Notice title="Thiết bị đang mất kết nối mạng" tone="warning">
    Dữ liệu đang hiển thị có thể chưa cập nhật. Kiểm tra kết nối trước khi thử lại hoặc gửi thao tác.
  </Notice>
}
