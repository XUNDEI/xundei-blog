// ========== Cloudflare Worker - xundei-blog ==========
// 功能：
//   1. 提供静态资源服务（通过 env.ASSETS.fetch）
//   2. /api/search?q=... 全文搜索 API（读取 search-index.json）

// 缓存 search-index.json，避免每次请求都读取
let searchIndexCache = null;
let searchIndexPromise = null;

async function loadSearchIndex(env) {
  if (searchIndexCache) return searchIndexCache;
  if (searchIndexPromise) return searchIndexPromise;

  searchIndexPromise = (async () => {
    try {
      const resp = await env.ASSETS.fetch('https://fake/search-index.json');
      if (!resp.ok) {
        console.error('search-index.json 加载失败:', resp.status);
        return [];
      }
      searchIndexCache = await resp.json();
      return searchIndexCache;
    } catch (e) {
      console.error('search-index.json 加载异常:', e);
      return [];
    }
  })();

  return searchIndexPromise;
}

function searchArticles(articles, query) {
  if (!query || !articles || !articles.length) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // 在所有可搜索字段中匹配
  const results = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const title = (a.title || '').toLowerCase();
    const excerpt = (a.excerpt || '').toLowerCase();
    const tags = (a.tags || '').toLowerCase();
    const searchText = (a.searchText || '').toLowerCase();

    if (
      title.indexOf(q) !== -1 ||
      excerpt.indexOf(q) !== -1 ||
      tags.indexOf(q) !== -1 ||
      searchText.indexOf(q) !== -1
    ) {
      results.push(a.filename);
    }
  }

  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ===== 搜索 API =====
    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q') || '';
      const articles = await loadSearchIndex(env);
      const results = searchArticles(articles, query);

      return new Response(JSON.stringify(results), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // ===== 静态资源 =====
    return env.ASSETS.fetch(request);
  }
};
