import haLong from '../assets/ha-long.png'
import lanHa from '../assets/lan-ha.png'
// Editorial Figma examples, not live inventory or availability.
export const featuredVoyages = [
  { id:'ha-long-lan-ha', title:'Hạ Long — Lan Hạ', region:'CẢM HỨNG KHÁM PHÁ', detail:'Những dãy đảo đá và khoảng trời rộng trên vịnh.', image:haLong },
  { id:'cat-ba-lan-ha', title:'Cát Bà — Lan Hạ', region:'CẢM HỨNG NGHỈ NGƠI', detail:'Sắc xanh của đảo và những vùng nước yên.', image:lanHa },
  { id:'ha-long-signature', title:'Một nhịp nghỉ trên vịnh', region:'CẢM HỨNG TRÊN BOONG', detail:'Dành thời gian ngắm cảnh và tận hưởng không gian biển.', image:haLong },
]

// The public catalogue and CruiseController support only this Home filter.
export function homeCruiseType(value: string | null) {
  return value === 'ONE_DAY' || value === 'MULTI_DAYS' ? value : ''
}
export function homeCruiseSearch(value: string | null) {
  const type = homeCruiseType(value)
  return '/cruises' + (type ? '?cruiseType=' + type : '')
}
export const destinations = [
  { title:'Hạ Long', detail:'Đảo đá vôi · vịnh mở', image:haLong },
  { title:'Lan Hạ', detail:'Vùng nước yên · kayak', image:lanHa },
  { title:'Cát Bà', detail:'Đảo xanh · nhịp nghỉ chậm', image:haLong },
]
