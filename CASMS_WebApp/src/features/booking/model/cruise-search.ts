import type { Cruise, CruiseSearchQuery, CruiseSearchResult } from './booking-types'

export function searchCruiseFixtures(cruises:Cruise[], query:CruiseSearchQuery):CruiseSearchResult {
 const items=cruises.filter(c=>(!query.destination||c.title.includes(query.destination))
  &&(!query.port||c.port===query.port)
  &&(!query.month||c.departure.startsWith(query.month))
  &&(!query.quick.includes('3–5 ngày')||(c.duration>=3&&c.duration<=5))
  &&(!query.quick.includes('Ban công')||c.balcony)
  &&(!query.quick.includes('Dưới 6 triệu')||c.price<6000000)
  &&(!query.quick.includes('Khởi hành tháng 11')||c.departure.startsWith('2026-11')))
 if(query.sort==='price')items.sort((a,b)=>a.price-b.price)
 if(query.sort==='date')items.sort((a,b)=>a.departure.localeCompare(b.departure))
 return {items,totalResults:items.length,certainty:'fixture'}
}
