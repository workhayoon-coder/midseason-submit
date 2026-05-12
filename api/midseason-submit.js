// api/midseason-submit.js
// Vercel Serverless Function — with AM 26 Mid-Season 스와치 신청 → Notion DB

const NOTION_API_URL = 'https://api.notion.com/v1/pages';
const NOTION_VERSION = '2022-06-28';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    brandName,
    managerName,
    phoneNumber,
    shippingAddress,
    requests,
    selectedSwatches,
  } = req.body;

  // 필수값 체크
  if (!brandName || !managerName || !phoneNumber || !shippingAddress) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID;

  if (!NOTION_TOKEN || !NOTION_DB_ID) {
    return res.status(500).json({ error: 'Notion 환경변수가 설정되지 않았습니다.' });
  }

  // 신청 스와치 목록 → 쉼표 구분 문자열
  const swatchText = Array.isArray(selectedSwatches)
    ? selectedSwatches.join(', ')
    : (selectedSwatches || '');

  // 제출 시각 (KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const submittedAt = kst.toISOString().replace('T', ' ').slice(0, 19);

  try {
    const response = await fetch(NOTION_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties: {
          '업체명': {
            title: [{ text: { content: brandName } }],
          },
          '성함': {
            rich_text: [{ text: { content: managerName } }],
          },
          '전화번호': {
            rich_text: [{ text: { content: phoneNumber } }],
          },
          '주소': {
            rich_text: [{ text: { content: shippingAddress } }],
          },
          '신청 상품': {
            multi_select: Array.isArray(selectedSwatches)
              ? selectedSwatches.map(function(name) { return { name: name }; })
              : [],
          },
          '요청사항': {
            rich_text: [{ text: { content: requests || '' } }],
          },
          '인입 일자': {
            rich_text: [{ text: { content: submittedAt } }],
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('[Notion API Error]', errorBody);
      return res.status(500).json({ error: 'Notion 저장 실패', detail: errorBody });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[Server Error]', err);
    return res.status(500).json({ error: '서버 오류', detail: err.message });
  }
}
