import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PassengerScaffold } from '@/components/passenger/PassengerScaffold';
import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { SectionHeading, ui } from '@/components/passenger/PassengerUI';
import { PassengerButton } from '@/components/passenger/PassengerButton';
import { brand, lightTheme, statusColors } from '@/constants/ocevie';
import { useAuth } from '@/features/auth/session-store';

const questions = [
  { id: 'ticket', title: 'Tôi tìm thẻ lên tàu ở đâu?', answer: 'Chọn Thẻ lên tàu ở giữa thanh điều hướng. Mã QR chỉ xuất hiện sau khi thông tin hành khách được xác nhận. Nếu chưa có thẻ, vui lòng kiểm tra với quầy dịch vụ.' },
  { id: 'time', title: 'Giờ tập trung và giờ tàu ở đâu?', answer: 'Vào Hải trình, chọn ngày rồi mở thông tin điểm dừng hoặc tour. Kiểm tra múi giờ, giờ tập trung và hạn có mặt trên tàu. Thông báo trực tiếp của thủy thủ đoàn luôn cần được tuân thủ.' },
  { id: 'connection', title: 'Tôi phải làm gì khi mất kết nối?', answer: 'Kiểm tra Wi-Fi hoặc kết nối dữ liệu rồi thử tải lại. Dữ liệu cũ có thể không phản ánh thay đổi mới nhất. Hỏi nhân sự trên tàu trước khi rời tàu hoặc tham gia hoạt động.' },
  { id: 'services', title: 'Làm sao để đặt dịch vụ trên tàu?', answer: 'Mục Khám phá giới thiệu các loại trải nghiệm. Vui lòng liên hệ quầy dịch vụ để xác nhận giá, lịch phục vụ và chỗ trống. Ứng dụng hiện chưa hỗ trợ đặt dịch vụ trực tiếp.' },
];
export function PassengerSupportScreen({ recovery = false }: { recovery?: boolean }) {
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const authenticated = useAuth(state => state.status === 'authenticated');
  return <PassengerScaffold detail title={recovery ? 'Hỗ trợ đăng nhập' : 'Trung tâm hỗ trợ'}>
    <ScrollView contentContainerStyle={ui.content}>
      <View style={styles.hero}><View style={styles.heroIcon}><MaterialIcon name="support_agent" color={brand.teal} size={34} /></View>
        <Text style={ui.eyebrow}>OCEVIE LUÔN BÊN BẠN</Text><Text accessibilityRole="header" style={ui.title}>{recovery ? 'Cùng bạn trở lại hành trình.' : 'Bạn cần chúng tôi giúp gì?'}</Text>
        <Text style={ui.body}>{recovery ? 'Liên hệ đơn vị đã cấp tài khoản OceVie để được hướng dẫn khôi phục quyền truy cập.' : 'Tìm câu trả lời nhanh hoặc trao đổi trực tiếp với đội ngũ trên tàu.'}</Text>
      </View>
      {recovery && <View style={ui.card}><Text style={ui.sectionTitle}>Khôi phục mật khẩu</Text><Text style={ui.body}>Chuẩn bị tên đăng nhập và thông tin chuyến đi khi liên hệ. Không gửi mật khẩu hay mã xác thực cho người khác.</Text><Text style={ui.caption}>Chức năng tự đặt lại mật khẩu chưa được mở trên ứng dụng.</Text></View>}
      <View style={[styles.safety, topic === 'safety' && styles.focusSafety]}>
        <MaterialIcon name="error" color={statusColors.error.foreground} size={26} />
        <View style={{ flex: 1, gap: 8 }}><Text style={styles.safetyTitle}>Cần trợ giúp khẩn cấp?</Text><Text style={ui.body}>Báo ngay cho nhân sự gần nhất hoặc đến quầy lễ tân. Tuân theo chỉ dẫn của thủy thủ đoàn và sơ đồ an toàn tại cabin.</Text><Text style={ui.caption}>Không chờ phản hồi trong ứng dụng khi có tình huống khẩn cấp.</Text></View>
      </View>
      <View style={ui.card}><Text style={ui.eyebrow}>HỖ TRỢ TRỰC TIẾP</Text><Text style={ui.sectionTitle}>Quầy dịch vụ hành khách</Text><Text style={ui.body}>Đội ngũ trên tàu có thể hỗ trợ check-in, thẻ hành khách, dịch vụ và thông tin chuyến đi.</Text><Text style={ui.caption}>Số điện thoại và vị trí quầy theo tàu chưa được cập nhật. Vui lòng hỏi nhân sự gần nhất.</Text></View>
      <View style={styles.faq}><SectionHeading title="Câu hỏi thường gặp" />
        {questions.map(item => <View key={item.id} style={styles.question}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === item.id }} onPress={() => setExpanded(value => value === item.id ? null : item.id)} style={styles.questionButton}>
            <Text style={styles.questionTitle}>{item.title}</Text><MaterialIcon name={expanded === item.id ? 'expand_less' : 'expand_more'} color={brand.teal} size={20} />
          </Pressable>{expanded === item.id && <Text style={styles.answer}>{item.answer}</Text>}
        </View>)}
      </View>
      {!authenticated && <PassengerButton label="Về đăng nhập" onPress={() => router.replace('/login')} />}
    </ScrollView>
  </PassengerScaffold>;
}
const styles = StyleSheet.create({
  hero: { gap: 12, paddingVertical: 12 }, heroIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: brand.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  safety: { flexDirection: 'row', gap: 12, padding: 18, borderRadius: 18, backgroundColor: statusColors.error.background, borderWidth: 1, borderColor: statusColors.error.background },
  focusSafety: { borderColor: statusColors.error.foreground }, safetyTitle: { color: statusColors.error.foreground, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  faq: { gap: 10 }, question: { backgroundColor: lightTheme.surface, borderRadius: 16, borderWidth: 1, borderColor: lightTheme.divider },
  questionButton: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 18, minHeight: 60 },
  questionTitle: { flex: 1, color: brand.navy, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  answer: { paddingHorizontal: 18, paddingBottom: 18, color: lightTheme.textSecondary, fontSize: 14, lineHeight: 23 },
});
