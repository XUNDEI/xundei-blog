// ========== Cloudflare Worker - xundei-blog ==========
// 功能：
//   1. 提供静态资源服务（通过 env.ASSETS.fetch）
//   2. /api/search?q=... 全文搜索 API（读取 search-index.json）

let searchIndexCache = null;

/**
 * 加载全文搜索索引
 * @param {object} env - Worker 环境变量（包含 ASSETS 绑定）
 * @returns {Promise<Array>} 索引数组
 */
async function loadSearchIndex(env) {
  if (searchIndexCache) return searchIndexCache;

  try {
    // 直接通过 ASSETS 绑定读取静态文件，路径为站点根目录下的 search-index.json
    // （因为 dist/ 被设为站点根目录，所以直接使用 /search-index.json）
    const req = new Request('/search-index.json');
    const resp = await env.ASSETS.fetch(req);

    if (!resp.ok) {
      console.error(`search-index.json 加载失败，状态码: ${resp.status}`);
      return [];
    }

    searchIndexCache = await resp.json();
    return searchIndexCache;
  } catch (e) {
    console.error('search-index.json 加载异常:', e);
    return [];
  }
}

/**
 * 在索引中搜索匹配的文章文件名
 * @param {Array} articles - 索引数组
 * @param {string} query - 搜索关键词
 * @returns {Array<string>} 匹配的文章文件名列表
 */
function searchArticles(articles, query) {
  if (!query || !articles || !articles.length) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

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