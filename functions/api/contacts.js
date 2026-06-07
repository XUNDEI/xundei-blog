export async function onRequest(context) {
  const { env } = context;
  const contacts = {
    email: env.email || '',
    qq: env.qq || '',
    github: env.github || '',
    wechat: env.wechat || '',
    bilibili: env.bilibili || ''
  };

  return new Response(JSON.stringify(contacts), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}