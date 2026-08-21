// api/cafe24-callback.js
// Vercel Serverless Function — 카페24 OAuth 인증코드 → 액세스/리프레시 토큰 교환
// 카페24 App 설정의 Redirect URI로 이 엔드포인트를 등록해두면,
// 앱 설치(권한 승인) 시 카페24가 ?code=... 를 붙여서 이 주소로 리다이렉트해줍니다.
//
// ============================================================
// ✏️ 이 파일에서 실제로 수정해야 하는 곳은 딱 1곳(6번째 줄)입니다.
//    그 외 CLIENT_ID / CLIENT_SECRET / REDIRECT_URI 는 이 파일이 아니라
//    Vercel "Environment Variables" 설정 화면에서 넣는 값이라 코드 수정 불필요.
// ============================================================

const CAFE24_MALL_ID = 'amcompanyam'; // ✏️ 수정: 카페24 쇼핑몰ID (https://[여기].cafe24.com 의 [여기] 부분). 지금은 amcompanyam으로 맞춰뒀어요 — 다르면 이 문자열만 바꾸면 됩니다.

module.exports = async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res
      .status(400)
      .send(`카페24 인증 실패: ${error} - ${error_description || ''}`);
  }
  if (!code) {
    return res.status(400).send('인증코드(code)가 없습니다.');
  }

  // 아래 3줄은 수정 불필요 — Vercel 환경변수에서 자동으로 읽어옵니다.
  const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
  const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
  const CAFE24_REDIRECT_URI = process.env.CAFE24_REDIRECT_URI; // 카페24 App에 등록한 것과 100% 동일해야 함

  if (!CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET || !CAFE24_REDIRECT_URI) {
    return res
      .status(500)
      .send('CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET / CAFE24_REDIRECT_URI 환경변수가 설정되지 않았습니다.');
  }

  try {
    const basicAuth = Buffer.from(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`).toString('base64');

    const tokenRes = await fetch(`https://${CAFE24_MALL_ID}.cafe24api.com/api/v2/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CAFE24_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json(tokenData);
    }

    // 최초 1회용 화면 — access_token / refresh_token을 눈으로 보고
    // Vercel 환경변수(CAFE24_ACCESS_TOKEN, CAFE24_REFRESH_TOKEN)에 복사해 넣기 위한 용도입니다.
    // (이 값들은 비밀번호와 같으니 캡처해서 공유하지 말고, 확인 후 바로 이 페이지를 닫아주세요.)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <html><body style="font-family:sans-serif; padding:40px; line-height:1.8;">
        <h2>카페24 토큰 발급 완료</h2>
        <p>아래 값을 <b>Vercel 프로젝트 환경변수</b>에 등록하세요. 등록 후 이 화면은 닫으셔도 됩니다.</p>
        <p><b>CAFE24_ACCESS_TOKEN</b><br><code>${tokenData.access_token}</code></p>
        <p><b>CAFE24_REFRESH_TOKEN</b><br><code>${tokenData.refresh_token}</code></p>
        <p style="color:#888;">access_token 만료: ${tokenData.expires_at || '약 2시간'} / refresh_token 만료: ${tokenData.refresh_token_expires_at || '약 2주'}</p>
      </body></html>
    `);
  } catch (e) {
    return res.status(500).json({ error: '토큰 교환 중 오류', detail: String(e) });
  }
}
