import { fareAmount, fareObject } from './purchase-contract'

export function addonPrice(value: unknown): { amount: string; currencyCode: 'VND' | 'USD' } {
  const row = fareObject(value)
  if (row.currencyCode !== 'VND' && row.currencyCode !== 'USD') {
    throw new Error('Tiền tệ dịch vụ mua thêm không hợp lệ.')
  }
  return { amount: fareAmount(row.amount), currencyCode: row.currencyCode }
}

export function sameAddonAmount(a: string, b: string): boolean {
  const normalize = (value: string) => fareAmount(value).replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return normalize(a) === normalize(b)
}

/** Keep monetary strings exact, including historical USD and fractional precision. */
export function addonPriceLabel(amount: string, currencyCode: 'VND' | 'USD'): string {
  const [whole, fraction] = fareAmount(amount).split('.')
  const digits = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimals = fraction?.replace(/0+$/, '')
  return `${digits}${decimals ? `,${decimals}` : ''} ${currencyCode}`
}
