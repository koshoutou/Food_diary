// 图片访问路由 /dish/* → 从 R2 读取并返回
// 对应 PHP 版：图片直接由 Web 服务器以静态文件方式提供（uploads/ 目录）

export async function onRequestGet(context) {
  const { request, env } = context;
  const { IMAGES } = env;

  const url = new URL(request.url);
  // /dish/filename.jpg → dish/filename.jpg（URL 解码以兼容中文文件名）
  const pathParts = url.pathname.split('/');
  const filename = decodeURIComponent(pathParts.slice(2).join('/'));

  if (!filename) return new Response('Not Found', { status: 404 });

  // 阻断目录穿越
  if (filename.includes('..')) return new Response('Bad Request', { status: 400 });

  const storageKey = `dish/${filename}`;
  const object = await IMAGES.get(storageKey);

  if (!object) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}
