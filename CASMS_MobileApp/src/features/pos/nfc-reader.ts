import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { CardReadError, createCardReader } from './card-reader';

export const cardReader = createCardReader(async () => {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') throw new CardReadError('unavailable');
  let native: typeof import('react-native-nfc-manager');
  try { native = await import('react-native-nfc-manager'); }
  catch { throw new CardReadError('unavailable'); }
  const { default: manager, NfcTech, NfcError } = native;
  return {
    supported: () => manager.isSupported(), enabled: () => manager.isEnabled(), start: () => manager.start(),
    request: async () => {
      try {
        return await manager.requestTechnology(Platform.OS === 'ios'
          ? [NfcTech.MifareIOS, NfcTech.IsoDep, NfcTech.Iso15693IOS]
          : [NfcTech.NfcA, NfcTech.NfcB, NfcTech.IsoDep, NfcTech.NfcV],
        { alertMessage: 'Giữ thẻ hành khách gần vùng đọc NFC.' });
      } catch (error) {
        if (error instanceof NfcError.UserCancel) throw new CardReadError('cancelled');
        if (error instanceof NfcError.RadioDisabled) throw new CardReadError('disabled');
        throw new CardReadError('read');
      }
    },
    tag: () => manager.getTag({ readNdef: false }),
    cancel: () => manager.cancelTechnologyRequest({ throwOnError: false }),
  };
});

export function cardReadMessage(error: unknown) {
  if (error instanceof CardReadError) return {
    unavailable: 'NFC cần development build có module đọc thẻ. Expo Go và trình duyệt không hỗ trợ.',
    unsupported: 'Thiết bị này không hỗ trợ đọc thẻ NFC.',
    disabled: 'NFC đang tắt. Bật NFC trong Cài đặt rồi thử lại.',
    cancelled: 'Đã hủy đọc thẻ.', busy: 'Đang kết thúc phiên đọc trước. Vui lòng thử lại.',
    invalid: 'Không đọc được mã thẻ phù hợp. Dùng thẻ được hỗ trợ tại quầy.',
    read: 'Không đọc được thẻ. Giữ một thẻ gần vùng NFC rồi thử lại.',
  }[error.reason];
  return 'Không khởi tạo được NFC. Kiểm tra thiết bị và cấu hình development build.';
}
