import type { MaterialIconName } from '@/components/passenger/MaterialIcon';
export const serviceCategories = [
  { key: 'all', label: 'Tất cả' }, { key: 'dining', label: 'Ẩm thực' },
  { key: 'wellness', label: 'Thư giãn' }, { key: 'experience', label: 'Trải nghiệm' },
] as const;
export type ServiceCategory = typeof serviceCategories[number]['key'];
export type ServiceGuide = { id: string; category: Exclude<ServiceCategory, 'all'>; title: string; subtitle: string; description: string; icon: MaterialIconName; tag: string };
/** Editorial introductions, not reservable inventory or availability data. */
export const serviceGuides: ServiceGuide[] = [
  { id: 'dining', category: 'dining', title: 'Hương vị trên biển', subtitle: 'Ẩm thực & nhà hàng', icon: 'restaurant', tag: 'ẨM THỰC', description: 'Khám phá trải nghiệm ẩm thực trong hành trình. Thực đơn, khung giờ phục vụ và yêu cầu ăn uống cần được xác nhận với đội ngũ nhà hàng trên tàu.' },
  { id: 'wellness', category: 'wellness', title: 'Một khoảng bình yên', subtitle: 'Spa & chăm sóc sức khỏe', icon: 'spa', tag: 'THƯ GIÃN', description: 'Dành thời gian nghỉ ngơi trong chuyến đi. Liên hệ quầy dịch vụ để tìm hiểu các liệu trình, điều kiện sử dụng và lịch phục vụ thực tế.' },
  { id: 'shore', category: 'experience', title: 'Câu chuyện mỗi điểm đến', subtitle: 'Tour tham quan & khám phá', icon: 'explore', tag: 'TRẢI NGHIỆM', description: 'Xem tour ở từng điểm dừng trong mục Hải trình. Kiểm tra giờ tập trung, địa điểm và hạn quay lại tàu trước khi tham gia hoạt động.' },
  { id: 'onboard', category: 'experience', title: 'Tận hưởng từng khoảnh khắc', subtitle: 'Hoạt động trên tàu', icon: 'sailing', tag: 'TRÊN TÀU', description: 'Tìm hiểu những hoạt động phù hợp với bạn trong thời gian trên biển. Chương trình thực tế tùy thuộc từng chuyến đi và được đội ngũ OceVie thông báo trên tàu.' },
];
export function filterServiceGuides(category: ServiceCategory, search: string) {
  const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const query = normalize(search.trim());
  return serviceGuides.filter(item => (category === 'all' || item.category === category) && normalize(`${item.title} ${item.subtitle} ${item.tag}`).includes(query));
}
