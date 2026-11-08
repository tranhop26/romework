# Kiểm thử RomeWork trên Hadrian

Từ checkout FreelanceGuard, chạy `npm run dev:local`. Mở [workroom](http://127.0.0.1:3000/rome) trong Chrome có ví. Trang chủ giữ giao diện FreelanceGuard và chế độ Try Demo dùng dữ liệu mẫu trong bộ nhớ.

## Kết nối và đọc số dư

1. Trong **Cài đặt và chi tiết kỹ thuật**, bấm **Kiểm tra RPC chỉ đọc**. Xác nhận Hadrian chain ID `200010`, Solana Devnet, wrapper và mint khớp cấu hình.
2. Kết nối tài khoản MetaMask testnet. Nếu cần thêm mạng, dùng thông số trong [tài liệu Hadrian](https://docs.rome.builders/networks/hadrian).
3. Ở ô Freelancer, bấm **Kết nối MetaMask Solana** hoặc **Kết nối OKX Wallet**. Extension cần cung cấp tài khoản Solana Devnet và hỗ trợ ký giao dịch Solana legacy. Với escrow đã lưu, chọn đúng địa chỉ Solana freelancer đã gắn lúc deploy.
4. Bấm **Đọc số dư testnet**. Kiểm tra USDC gas và wUSDC của client, SOL và ATA của freelancer. Nếu thiếu, dừng ở bước funding và tra [faucet chính thức](https://docs.rome.builders/resources/faucets).

## Đường ký quỹ

Workroom hiển thị bước cần làm dựa trên trạng thái escrow. Với escrow đã lưu, bấm **Đọc trạng thái** để mở đúng bước. Mỗi thao tác ghi cần xem trước và một lần ký riêng trong extension. Mức ký quỹ tối đa 1 test USDC cho một mốc. Dùng điều khoản và bàn giao thử nghiệm công khai. Contract không có hoàn tiền, phân xử hay admin cứu tiền.

1. Chuẩn bị deploy qua MetaMask. Xem phí tối đa, số dư gas và giới hạn G0 trong phần xem trước. Nếu phí tăng trước khi mở ví, chuẩn bị lại để xem báo giá mới. Sau khi ký, kiểm tra constructor, receipt và runtime trước khi chấp nhận.
2. Freelancer accept. Đối chiếu địa chỉ synthetic trong sự kiện Transition. Provision và tạo ATA nếu thiếu.
3. Chuẩn bị wUSDC, grant wrapper khi thiếu, allowance đúng số tiền cho đúng escrow. Grant SPL dành cho wrapper có phạm vi đến uint64 max, tách biệt allowance của escrow.
   Workroom đọc số dư và quyền trên Hadrian rồi chỉ hiển thị bước còn thiếu. Nếu phí allowance vượt 0,10 test USDC nhưng không quá 0,30 test USDC, người thử có thể duyệt trần riêng cho bản xem trước đang mở. Ví vẫn yêu cầu ký riêng.
4. Lưu snapshot `baseline` trước fund. Client fund. Freelancer bàn giao. Client approve để tạo quyền claim.
5. Freelancer claim vào synthetic. Reload, kết nối lại đúng ví và đối chiếu trước khi sweep về ATA. Xác nhận mint, owner, địa chỉ ATA và chênh lệch số dư.
6. Trong **Cài đặt và chi tiết kỹ thuật**, tải manifest và run bundle. Đối chiếu biên nhận Hadrian, giao dịch Solana đã finalized và số dư USDC trước và sau giao dịch như trong [hồ sơ bằng chứng](HADRIAN-SUBMISSION-EVIDENCE.md).

Khi thấy `UNKNOWN` hoặc timeout, bấm **Đọc trạng thái** để đối chiếu giao dịch cũ. Với giao dịch MetaMask bị mất hash, lấy hash công khai từ Activity rồi dùng **Đối chiếu hash** trong phần kỹ thuật để kiểm tra caller, nonce, calldata và đích. Chỉ tiếp tục khi giao dịch cũ đã được xác định. Trạng thái approve, claim và sweep được ghi riêng.
