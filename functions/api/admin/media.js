// GET /api/admin/media — list all media
export async function onRequestGet(context) {
  const { DB } = context.env;

  const { results } = await DB.prepare(
    'SELECT id, r2_key, filename, content_type, size_bytes, uploaded_at FROM media ORDER BY uploaded_at DESC'
  ).all();

  return Response.json({
    media: results.map(m => ({ ...m, src: `/media/${m.r2_key}` })),
  });
}

// POST /api/admin/media — upload a file to R2
export async function onRequestPost(context) {
  const { DB, R2_BUCKET } = context.env;

  const formData = await context.request.formData();
  const file = formData.get('file');
  const filename = formData.get('filename') || file?.name || 'file';

  if (!file) {
    return Response.json({ error: 'File required' }, { status: 400 });
  }

  const ext = filename.split('.').pop().toLowerCase();
  const contentType = file.type || guessContentType(ext);
  const r2Key = crypto.randomUUID() + '.' + ext;
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await R2_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
  });

  await DB.prepare(
    'INSERT INTO media (id, r2_key, filename, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, r2Key, filename, contentType, file.size).run();

  return Response.json({
    id,
    r2_key: r2Key,
    src: `/media/${r2Key}`,
    filename,
    content_type: contentType,
    size_bytes: file.size,
  }, { status: 201 });
}

function guessContentType(ext) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogg: 'video/ogg',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    zip: 'application/zip', pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}
