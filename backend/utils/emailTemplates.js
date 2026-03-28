/**
 * Template email gửi OTP quên mật khẩu
 * @param {string} otp - Mã 6 chữ số
 * @param {number} minutesValid - Số phút hiệu lực
 */
export const otpEmailTemplate = (otp, minutesValid = 5) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực MangaShop</title>
</head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0e;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;max-width:480px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1a1a1a;">
              <p style="margin:0;font-size:22px;font-weight:600;letter-spacing:0.08em;color:#e8e2d9;">
                Manga<span style="color:#c9a84c;">Shop</span>
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;">
                Khôi phục tài khoản
              </p>
              <h1 style="margin:0 0 20px;font-size:28px;font-weight:300;color:#e8e2d9;line-height:1.2;">
                Mã xác thực của bạn
              </h1>
              <p style="margin:0 0 32px;font-size:14px;color:#888;line-height:1.8;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản MangaShop của bạn. Sử dụng mã bên dưới để tiếp tục.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center" style="background:#0e0e0e;border:1px solid #2a2a2a;padding:28px 20px;">
                    <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:0.3em;color:#c9a84c;font-family:'Courier New',monospace;">
                      ${otp}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.8;">
                ⏱ Mã có hiệu lực trong <strong style="color:#e8e2d9;">${minutesValid} phút</strong> kể từ khi nhận email này.
              </p>
              <p style="margin:0;font-size:13px;color:#666;line-height:1.8;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #1a1a1a;">
              <p style="margin:0;font-size:11px;color:#444;line-height:1.8;">
                © 2025 MangaShop · Email này được gửi tự động, vui lòng không trả lời.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;