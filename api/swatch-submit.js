// api/swatch-submit.js
// Vercel Serverless Function — 스와치 신청 폼 → 카페24 게시판 글 등록
//
// ============================================================
// ✏️ 수정이 필요할 수 있는 곳
//    1) 6번째 줄 CAFE24_MALL_ID — cafe24-callback.js와 동일한 값으로 맞춰야 함
//    2) 7번째 줄 BOARD_NO — 스와치 신청 게시판 번호 (지금은 27로 설정)
//    3) buildArticlePayload() 함수 안 필드명 — 첫 테스트에서 422 에러가 나면
//       에러 메시지에 어떤 필드가 문제인지 나오니, 그 필드명에 맞춰 수정
// ============================================================

const CAFE24_MALL_ID = 'amcompanyam'; // ✏️ cafe24-callback.js와 동일하게 유지
const BOARD_NO = 27; // ✏️ 스와치 신청 게시판 번호

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name,
    company,
    phone,
    address,
    memo,
    agreePrivacy,
    agreeMarketing,
    fabricList, // 문자열 (예: "로제왁스 (ROSE WAX), 럭스 (LUX)")
  } = req.body;

  if (!name || !phone || !address) {
    return res.status(400).json({ error: '성함/연락처/배송주소는 필수입니다.' });
  }

  const title = name + ' / ' + (company || '-');
  const content =
    '스와치 신청 원단 : ' + (fabricList || '-') + '\n' +
    '성함 : ' + name + '\n' +
    '업체/브랜드명 : ' + (company || '-') + '\n' +
    '연락처 : ' + phone + '\n' +
    '배송주소 : ' + address + '\n' +
    '기타 문의사항 : ' + (memo || '-') + '\n' +
    '개인정보 동의 : ' + (agreePrivacy ? '동의' : '미동의') + '\n' +
    '마케팅 동의 : ' + (agreeMarketing ? '동의' : '미동의');

  try {
    let accessToken = process.env.CAFE24_ACCESS_TOKEN;

    let result = await createArticle(accessToken, title, content, name);

    // 액세스 토큰 만료(401)면 리프레시 토큰으로 재발급 후 1회 재시도
    if (result.status === 401) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return res.status(500).json({ error: '토큰 갱신 실패. 재인증이 필요합니다.' });
      }
      accessToken = refreshed.access_token;
      result = await createArticle(accessToken, title, content, name);
      // 참고: 여기서 갱신된 accessToken/refreshToken은 이번 요청에서만 쓰이고,
      // Vercel 환경변수 자체는 자동으로 업데이트되지 않습니다.
      // 즉 CAFE24_ACCESS_TOKEN이 계속 예전 값으로 남아있으면, 2시간마다
      // 이 401 → 재발급 과정을 매번 반복하게 됩니다 (동작은 하지만 비효율적).
      // refresh_token 자체도 2주 후 만료되므로, 그 전에 한 번씩은 수동으로
      // 재인증(전에 했던 승인 URL 접속) 해주셔야 합니다.
    }

    if (result.status === 201 || result.status === 200) {
      return res.status(200).json({ success: true });
    }

    console.error('cafe24 board api error:', result.status, JSON.stringify(result.body));
    return res.status(result.status).json({ error: '게시판 등록 실패', detail: result.body });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류', detail: String(e) });
  }
};

async function createArticle(accessToken, title, content, writer) {
  const url = `https://${CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/boards/${BOARD_NO}/articles`;

  const payload = {
    shop_no: 1,
    request: {
      writer: writer,
      title: title,
      content: content,
      html_yn: 'F',
      password: '0000', // ✏️ 비회원 글쓰기에 비밀번호가 필수인 게시판일 수 있어 임시로 고정값 넣음
    },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function refreshAccessToken() {
  const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
  const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
  const refreshToken = process.env.CAFE24_REFRESH_TOKEN;
  if (!CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET || !refreshToken) return null;

  const basicAuth = Buffer.from(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`).toString('base64');

  const r = await fetch(`https://${CAFE24_MALL_ID}.cafe24api.com/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!r.ok) return null;
  return r.json();
}
