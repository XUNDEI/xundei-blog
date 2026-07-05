let searchIndexCache = null;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 处理搜索 API
    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q') || '';
      console.log(`[API] 查询词: "${query}"`);

      // 加载索引（若未缓存）
      let articles = searchIndexCache;
      if (articles === null) {
        try {
          // 构造绝对 URL
          const indexUrl = new URL('/search-index.json', request.url);
          console.log(`[加载] 尝试从 ${indexUrl.toString()} 获取索引`);
          const req = new Request(indexUrl.toString());
          const resp = await env.ASSETS.fetch(req);
          console.log(`[加载] 响应状态: ${resp.status}`);

          if (!resp.ok) {
            console.error(`[加载] 失败，状态码 ${resp.status}`);
            articles = [];
          } else {
            articles = await resp.json();
            console.log(`[加载] 成功，条目数: ${articles.length}`);
            searchIndexCache = articles;
          }
        } catch (e) {
          console.error('[加载] 异常:', e);
          articles = [];
          // 如果 env.ASSETS 失败，尝试回退到内部 fetch
          try {
            console.log('[加载] 回退到内部 fetch');
            const fallbackResp = await fetch(new URL('/search-index.json', request.url).toString());
            if (fallbackResp.ok) {
              articles = await fallbackResp.json();
              console.log(`[加载] 回退成功，条目数: ${articles.length}`);
              searchIndexCache = articles;
            } else {
              console.error(`[加载] 回退失败，状态码 ${fallbackResp.status}`);
            }
          } catch (fallbackErr) {
            console.error('[加载] 回退异常:', fallbackErr);
          }
        }
      }

      console.log(`[API] 索引条目数: ${articles.length}`);

      // 搜索匹配
      const results = [];
      const q = query.toLowerCase().trim();
      if (q && articles.length) {
        for (const a of articles) {
          const searchText = (a.searchText || '').toLowerCase();
          const title = (a.title || '').toLowerCase();
          const excerpt = (a.excerpt || '').toLowerCase();
          const tags = (a.tags || '').toLowerCase();
          if (
            searchText.includes(q) ||
            title.includes(q) ||
            excerpt.includes(q) ||
            tags.includes(q)
          ) {
            results.push(a.filename);
          }
        }
      }
      console.log(`[API] 匹配结果数: ${results.length}`);

      return new Response(JSON.stringify(results), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 其他所有请求（包括 /search-index.json）由静态资源处理
    return env.ASSETS.fetch(request);
  }
};