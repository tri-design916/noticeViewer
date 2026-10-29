import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const DATE_RE = /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})|(\d{2}-\d{2})/;

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
    const date = (row.text().match(DATE_RE) || [])[0] || '';
    posts.set(id, { id, title, url: new URL(href, site.url).href, date });
  });

  if (posts.size === 0) throw new Error('게시글을 하나도 찾지 못했습니다 (페이지 구조 변경 가능성)');
  return [...posts.values()];
}
