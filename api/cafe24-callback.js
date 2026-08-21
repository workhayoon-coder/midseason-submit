// api/cafe24-callback.js
// Vercel Serverless Function — 카페24 OAuth 인증코드 → 액세스/리프레시 토큰 교환
// 카페24 App 설정의 Redirect URI로 이 엔드포인트를 등록해두면,
// 앱 설치(권한 승인) 시 카페24가 ?code=... 를 붙여서 이 주소로 리다이렉트해줍니다.

const CAFE24_MALL_ID = 'amcompanyam'; // ✏️ 수정: 카페24 쇼핑몰ID. 다르면 이 문자열만 바꾸면 됩니다.

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

  const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
  const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
  const CAFE24_REDIRECT_URI = process.env.CAFE24_REDIRECT_URI;

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
};
