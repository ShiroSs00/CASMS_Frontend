export type StopSalePreset =
  | 'WEATHER_STORM'
  | 'SHIP_TECHNICAL_ISSUE'
  | 'PORT_AUTHORITY_REQUIREMENT'
  | 'COMMERCIAL_ADJUSTMENT'

export const STOP_SALE_PRESETS: Array<{ value: StopSalePreset; label: string }> = [
  { value: 'WEATHER_STORM', label: 'Thời tiết xấu / Bão' },
  { value: 'SHIP_TECHNICAL_ISSUE', label: 'Sự cố kỹ thuật tàu' },
  { value: 'PORT_AUTHORITY_REQUIREMENT', label: 'Yêu cầu cảng vụ / Biên phòng' },
  { value: 'COMMERCIAL_ADJUSTMENT', label: 'Điều chỉnh thương mại' },
]

export const STOP_SALE_PRESET_LABELS: Record<StopSalePreset, string> = {
  WEATHER_STORM: 'Thời tiết xấu / Bão',
  SHIP_TECHNICAL_ISSUE: 'Sự cố kỹ thuật tàu',
  PORT_AUTHORITY_REQUIREMENT: 'Yêu cầu cảng vụ / Biên phòng',
  COMMERCIAL_ADJUSTMENT: 'Điều chỉnh thương mại',
}
