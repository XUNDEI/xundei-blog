// /functions/api/contacts.js
export async function onRequest(context) {
  const { env } = context;
  const contacts = {
    email: env.EMAIL || '',
    qq: env.QQ || '',
    github: env.GITHUB || '',
    wechat: env.WECHAT || '',
    bilibili: env.BILIBILI || ''
  };

  return new Response(JSON.stringify(contacts), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}