// PUT /api/admin/homepage — upload/update homepage video
export async function onRequestPut(context) {
  const { DB, R2_BUCKET } = context.env;

  const formData = await context.request.formData();
  const file = formData.get('file');

  if (!file) {
    return Response.json({ error: 'File required' }, { status: 400 });
  }

  const r2Key = 'video-homepage.mp4';
  const contentType = file.type || 'video/mp4';

  // Overwrite in R2
  await R2_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
  });

  // Upsert setting
  await DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('homepage_video', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(r2Key).run();

  return Response.json({ success: true, src: `/media/${r2Key}` });
}

// GET /api/admin/homepage — get homepage video info
export async function onRequestGet(context) {
  const { DB } = context.env;

  const row = await DB.prepare("SELECT value FROM settings WHERE key = 'homepage_video'").first();
  const r2Key = row?.value || 'video-homepage.mp4';

  return Response.json({ src: `/media/${r2Key}` });
}
