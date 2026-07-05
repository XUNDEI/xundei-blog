// ========== Cloudflare Worker - xundei-blog ==========
// 功能：
//   1. 提供静态资源服务（通过 env.ASSETS.fetch）
//   2. /api/search?q=... 全文搜索 API（读取 search-index.json）

let searchIndexCache = null;

async function loadSearchIndex(request) {
  if (searchIndexCache) return searchIndexCache;

  // 通过 fetch() 请求自身域名的 /search-index.json，
  // worker 收到后会走 env.ASSETS.fetch(request) 返回静态文件
  try {
    const url = new URL(request.url);
    url.pathname = '/search-index.json';
    url.search = '';

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      console.error('search-index.json 加载失败:', resp.status);
      return [];
    }
    searchIndexCache = await resp.json();
    return searchIndexCache;
  } catch (e) {
    console.error('search-index.json 加载异常:', e);
    // 出错时不缓存空值，下次请求会重试
    return [];
  }
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
      const articles = await loadSearchIndex(request);
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
