import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
// 행 텍스트에서 날짜를 찾는 순서: 연월일 → 월-일 → 시:분(오늘 글)
const DATE_RES = [/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/, /\b\d{2}-\d{2}\b/, /\b\d{2}:\d{2}\b/];

const pad = (n) => String(n).padStart(2, '0');

function todayKst() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return { y: d.getUTCFullYear(), md: `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` };
}

// 날짜를 YYYY-MM-DD로 통일한다.
// 그누보드는 올해 글을 "MM-DD", 오늘 글을 "HH:MM"으로만 보여주므로
// 글 번호가 큰 순서(최신순)로 훑으면서 월-일이 다시 커지는 지점마다 한 해씩 거슬러 올라간다.
function normalizeDates(posts) {
  const today = todayKst();
  let year = null;
  let prevMd = null;
  for (const p of [...posts].sort((a, b) => Number(b.id) - Number(a.id))) {
    const full = p.date.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
    if (full) {
      p.date = `${full[1]}-${pad(full[2])}-${pad(full[3])}`;
      continue;
    }
    const md = /^\d{2}:\d{2}$/.test(p.date) ? today.md : p.date;
    if (!/^\d{2}-\d{2}$/.test(md)) continue;
    if (year === null) year = md > today.md ? today.y - 1 : today.y;
    else if (md > prevMd) year--;
    prevMd = md;
    p.date = `${year}-${md}`;
  }
}

// 게시판 목록 페이지에서 postPattern에 맞는 링크를 게시글로 본다.
// 같은 글을 가리키는 링크가 여러 개면(제목·요약·날짜) 처음 나온 링크의 텍스트를 제목으로 쓴다.
export async function scrapeSite(site) {
  const res = await fetch(site.url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const pattern = new RegExp(site.postPattern);
  const posts = new Map();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const m = href.match(pattern);
    if (!m) return;
    const id = m[1];
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    if (!title || posts.has(id)) return;

    const row = $(el).closest('tr, dl, li');
    const text = row.text();
    const date = DATE_RES.map((re) => text.match(re)?.[0]).find(Boolean) ?? '';
    posts.set(id, { id, title, url: new URL(href, site.url).href, date });
  });

  if (posts.size === 0) throw new Error('게시글을 하나도 찾지 못했습니다 (페이지 구조 변경 가능성)');
  const list = [...posts.values()];
  normalizeDates(list);
  return list;
}
