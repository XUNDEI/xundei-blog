// ========== Cloudflare Worker - xundei-blog ==========
let searchIndexCache = null;

async function loadSearchIndex(request) {
  if (searchIndexCache !== null) return searchIndexCache;

  // 构造自身域名的 /search-index.json URL
  const url = new URL(request.url);
  url.pathname = '/search-index.json';
  url.search = '';

  try {
    console.log(`[加载] 尝试从 ${url.toString()} 获取索引`);
    const resp = await fetch(url.toString());
    console.log(`[加载] 响应状态: ${resp.status}`);

    if (!resp.ok) {
      console.error(`[加载] 失败，状态码 ${resp.status}`);
      searchIndexCache = [];
      return [];
    }

    const data = await resp.json();
    console.log(`[加载] 成功，条目数: ${data.length}`);
    searchIndexCache = data;
    return data;
  } catch (e) {
    console.error('[加载] 异常:', e);
    searchIndexCache = [];
    return [];
  }
}

function searchArticles(articles, query) {
  if (!query || !articles || !articles.length) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = [];
  for (const a of articles) {
    const title = (a.title || '').toLowerCase();
    const excerpt = (a.excerpt || '').toLowerCase();
    const tags = (a.tags || '').toLowerCase();
    const searchText = (a.searchText || '').toLowerCase();

    if (
      title.includes(q) ||
      excerpt.includes(q) ||
      tags.includes(q) ||
      searchText.includes(q)
    ) {
      results.push(a.filename);
    }
  }
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q') || '';
      console.log(`[API] 查询词: "${query}"`);

      const articles = await loadSearchIndex(request);
      console.log(`[API] 索引条目数: ${articles.length}`);

      const results = searchArticles(articles, query);
      console.log(`[API] 匹配结果数: ${results.length}`);

      return new Response(JSON.stringify(results), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 静态资源（包括 /search-index.json）由 env.ASSETS 正常处理
    return env.ASSETS.fetch(request);
  }
};