export const MIN_PASSENGER_DECKS = 8
export const MAX_PASSENGER_DECKS = 24
export const passengerDeckCountHint = `Nhập từ ${MIN_PASSENGER_DECKS} đến ${MAX_PASSENGER_DECKS} boong hành khách.`
export const passengerDeckCountError = `Số boong hành khách phải là số nguyên từ ${MIN_PASSENGER_DECKS} đến ${MAX_PASSENGER_DECKS}.`

export function isPassengerDeckCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_PASSENGER_DECKS && value <= MAX_PASSENGER_DECKS
}

export function manifestPassengerDeckCountError(count: unknown, listedPassengerDecks: number): string {
  if (!isPassengerDeckCount(count)) return passengerDeckCountError
  return count < listedPassengerDecks ? 'Số boong khai báo ít hơn số boong hành khách trong mô hình.' : ''
}
