/** Exact comparison of API decimal text and form input; never compute a fee or policy here. */
export function decimalUnits(value: string | number): bigint | null {
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) return null
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(String(value))
  if (!match) return null
  const units = BigInt(match[2]) * 10000n + BigInt((match[3] ?? '').padEnd(4, '0'))
  return match[1] ? -units : units
}

export function validRefundAmount(input: string, requestedAmount: number | string, currency: string): boolean {
  if (currency === 'VND' && !/^\d+(?:\.0+)?$/.test(input)) return false
  const normalized = currency === 'VND' ? input.replace(/\.0+$/, '') : input
  const amount = decimalUnits(normalized), limit = decimalUnits(requestedAmount)
  return amount !== null && limit !== null && amount > 0n && amount <= limit
}
