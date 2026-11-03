import { asianPorts } from './asian-ports'

// Real port photography is editorial inspiration, not live inventory.
export const featuredVoyages = asianPorts.slice(0,3).map(port => ({ id: port.id, title: port.name + ' — ' + port.location, region: port.country.toLocaleUpperCase('vi'), detail: port.description, image: port.image }))

// The public catalogue and CruiseController support only this Home filter.
export function homeCruiseType(value: string | null) {
  return value === 'ONE_DAY' || value === 'MULTI_DAYS' ? value : ''
}
export function homeCruiseSearch(value: string | null) {
  const type = homeCruiseType(value)
  return '/cruises' + (type ? '?cruiseType=' + type : '')
}
export const destinations = asianPorts.map(port => ({ title: port.location, detail: port.name + ' · ' + port.country, image: port.image }))
