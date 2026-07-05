// ========== Cloudflare Worker - xundei-blog ==========
let searchIndexCache = null;

async function loadSearchIndex(env, request) {
  if (searchIndexCache !== null) return searchIndexCache; // 用 !== null 可缓存空数组

  // 方式1: 使用 env.ASSETS.fetch（官方推荐）
  try {
    const req = new Request('/search-index.json');
    const resp = await env.ASSETS.fetch(req);
    console.log(`[ASSETS] 状态码: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json();
      console.log(`[ASSETS] 加载成功，条目数: ${data.length}`);
      searchIndexCache = data;
      return data;
    } else {
      console.error(`[ASSETS] 加载失败，状态码: ${resp.status}`);
    }
  } catch (e) {
    console.error('[ASSETS] 异常:', e);
  }

  // 方式2: 备选，使用 fetch 请求自身域名（若 ASSETS 失败）
  try {
    const url = new URL(request.url);
    url.pathname = '/search-index.json';
    url.search = '';
    const resp = await fetch(url.toString());
    console.log(`[FETCH] 状态码: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json();
      console.log(`[FETCH] 加载成功，条目数: ${data.length}`);
      searchIndexCache = data;
      return data;
    } else {
      console.error(`[FETCH] 加载失败，状态码: ${resp.status}`);
    }
  } catch (e) {
    console.error('[FETCH] 异常:', e);
  }

  // 两种方式均失败，返回空数组并缓存（避免重复请求）
  searchIndexCache = [];
  return [];
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
      const articles = await loadSearchIndex(env, request);
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

    return env.ASSETS.fetch(request);
  }
};