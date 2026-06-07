export async function onRequest(context) {
  const { env } = context;
  // 返回 env 对象中所有的键名（不含值，保护隐私）
  const debugInfo = {
    allKeys: Object.keys(env),
    emailType: typeof env.email,
    emailValue: env.email,
  };
  return new Response(JSON.stringify(debugInfo, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}