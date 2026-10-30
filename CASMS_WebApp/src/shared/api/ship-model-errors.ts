/** Localize model API responses without discarding the server's specific reason. */
const messages: Record<string,string> = {
  'This GLB content has already been uploaded twice; reuse an uploaded model to create more ships':'Nội dung mô hình này đã được tải lên hai lần. Chọn mô hình đã tải lên để tạo thêm tàu.',
  'Supply shipName when the model has no ship name (maximum 100 characters)':'Mô hình chưa có tên tàu. Bổ sung tên tàu, tối đa 100 ký tự.',
  'Supply a positive totalCapacity when the model has no passengerCapacity':'Mô hình chưa có sức chứa hành khách. Bổ sung sức chứa lớn hơn 0.',
  'Supply a positive totalDecks when the model has no passenger decks or deckCount':'Mô hình chưa có số boong hành khách. Bổ sung số boong lớn hơn 0.',
  'Commission date cannot be in the future':'Ngày đưa tàu vào hoạt động không được ở tương lai.',
  'Ship dimensions, when supplied, must be finite positive values':'Chiều dài và chiều rộng tàu phải là số lớn hơn 0.',
  'Manifest modelId is required to provision a Ship':'Tệp mô tả thiếu mã mô hình để tạo tàu.',
  'Manifest name must be text':'Tên tàu trong tệp mô tả phải là văn bản.',
  'Manifest commissionDate must be an ISO date':'Ngày đưa tàu vào hoạt động trong tệp mô tả phải có định dạng năm-tháng-ngày.',

  'checksums.json must contain a JSON object':'Tệp checksums.json phải chứa một đối tượng JSON.',
  'checksums.json does not cover every uploaded asset':'Tệp checksums.json chưa liệt kê đủ các tệp đã tải lên.',
  'GLB file is truncated':'Tệp GLB bị thiếu dữ liệu.',
  'Invalid GLB header':'Phần đầu tệp GLB không hợp lệ.',
  'Unsupported or invalid GLB JSON chunk':'Phần dữ liệu JSON trong tệp GLB không hợp lệ hoặc không được hỗ trợ.',
  'Truncated GLB JSON chunk':'Phần dữ liệu JSON trong tệp GLB bị thiếu.',
  'Invalid JSON in GLB document':'Dữ liệu JSON trong tệp GLB không hợp lệ.',
  'Manifest deck is missing its GLB asset':'Boong trong tệp mô tả chưa có tệp GLB tương ứng.',
  'Manifest model ID, revision, units or axes are invalid':'Mã mô hình, bản sửa đổi, đơn vị đo hoặc hệ trục trong tệp mô tả không hợp lệ.',
  'Manifest is missing decks or cabins':'Tệp mô tả thiếu danh sách boong hoặc phòng.',
  'Manifest contains an invalid or duplicate deck':'Tệp mô tả có boong không hợp lệ hoặc bị trùng.',
  'Manifest contains a duplicate cabin or a cabin without a deck':'Tệp mô tả có phòng bị trùng hoặc chưa thuộc boong nào.',
  'Invalid model key or asset version':'Mã mô hình hoặc phiên bản mô hình không hợp lệ.',
  'Invalid model asset path':'Đường dẫn tệp mô hình không hợp lệ.',
  'ZIP contains too many files':'Tệp ZIP chứa quá nhiều tệp.',
  'ZIP must include manifest.json and checksums.json':'Tệp ZIP phải có đủ manifest.json và checksums.json.',
  'Expanded ZIP exceeds the 2 GiB upload limit':'Dung lượng sau khi giải nén vượt giới hạn 2 GiB.',
  'A non-empty ZIP up to 2 GiB is required':'Cần chọn tệp ZIP có dữ liệu và dung lượng không quá 2 GiB.',
  'Cannot read the uploaded model ZIP':'Không đọc được tệp ZIP mô hình đã tải lên.',
  'This model asset version is already stored':'Phiên bản mô hình này đã được tải lên.',
  'Model asset bundle is not uploaded to the database':'Gói mô hình chưa được tải lên hệ thống.',
  'Model asset version is already registered on this ship':'Phiên bản mô hình này đã được đăng ký cho tàu.',
  'Manifest identity is already linked to another Ship':'Mã tàu trong tệp mô tả đã được liên kết với tàu khác.',
  'Ship is already linked to a different manifest identity':'Tàu đã được liên kết với một mã tàu khác trong tệp mô tả.',
  'Mappings can only be edited on a DRAFT model':'Chỉ có thể sửa liên kết dữ liệu khi mô hình ở trạng thái bản nháp.',
  'Manifest revision changed; register a new asset version':'Tệp mô tả mô hình đã thay đổi. Cần đăng ký phiên bản mô hình mới.',
}
const patterns: Array<[RegExp,(value:string)=>string]> = [
  [/^Duplicate asset path in ZIP: (.+)$/, file=>`Tệp ZIP có đường dẫn bị trùng: “${file}”.`],
  [/^Checksum mismatch or missing file: (.+)$/, file=>`Tệp “${file}” bị thiếu hoặc có mã kiểm tra không khớp.`],
  [/^Asset exceeds the per-file size limit: (.+)$/, file=>`Tệp “${file}” vượt giới hạn dung lượng cho mỗi tệp.`],
  [/^Invalid GLB header or declared length: (.+)$/, file=>`Phần đầu hoặc dung lượng khai báo của tệp GLB “${file}” không hợp lệ.`],
  [/^Invalid JSON asset: (.+)$/, file=>`Dữ liệu JSON trong tệp “${file}” không hợp lệ.`],
  [/^(.+) exceeds the JSON size limit$/, file=>`Tệp “${file}” vượt giới hạn dung lượng JSON.`],
  [/^Manifest is missing its (.+) GLB asset$/, field=>`Tệp mô tả thiếu tệp GLB cho mục “${field}”.`],
  [/^ZIP entries must be under (.+)$/, path=>`Các tệp trong ZIP phải nằm trong thư mục “${path}”.`],
  [/^ZIP is missing manifest asset: (.+)$/, file=>`Tệp ZIP thiếu tệp “${file}” được khai báo trong tệp mô tả mô hình.`],
]
export function shipModelErrorMessage(path:string,message:string):string|undefined {
  if(!/^\/(?:ship-model-assets(?:\/|$)|ships\/[^/]+\/(?:models|imports)(?:\/|$))/.test(path)) return undefined
  if(!message.trim()) return undefined
  if(messages[message]) return messages[message]
  for(const [pattern,translate] of patterns) {
    const match=pattern.exec(message)
    if(match) return translate(match[1])
  }
  // A new server reason remains visible instead of being replaced with unrelated copy.
  return message
}
