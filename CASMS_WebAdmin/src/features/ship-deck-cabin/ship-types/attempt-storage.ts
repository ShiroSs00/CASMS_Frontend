export function loadAttempt<T>(key: string): T | null {
  try {
    const saved = window.sessionStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : null
  } catch {
    return null
  }
}

export function saveAttempt<T>(key: string, attempt: T | null) {
  try {
    if (attempt) window.sessionStorage.setItem(key, JSON.stringify(attempt))
    else window.sessionStorage.removeItem(key)
  } catch {
    // The live form can still recover using the attempt held in memory.
  }
}
