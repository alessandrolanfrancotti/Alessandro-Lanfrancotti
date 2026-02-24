// PUT /api/admin/about — update about section
export async function onRequestPut(context) {
  const { DB, R2_BUCKET } = context.env;
  const body = await context.request.json();

  // Upsert about row
  await DB.prepare(`
    INSERT INTO about (id, statement, lines, contacts)
    VALUES ('main', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      statement = excluded.statement,
      lines = excluded.lines,
      contacts = excluded.contacts
  `).bind(
    body.statement || '',
    JSON.stringify(body.lines || []),
    JSON.stringify(body.contacts || [])
  ).run();

  // Handle media: body.media is an array of { id, r2_key } for existing, or we handle new uploads separately
  if (Array.isArray(body.media)) {
    // Delete media that are no longer referenced
    const currentMedia = await DB.prepare('SELECT id, r2_key FROM about_media').all();
    const keepIds = new Set(body.media.map(m => m.id));

    for (const row of currentMedia.results) {
      if (!keepIds.has(row.id)) {
        await R2_BUCKET.delete(row.r2_key);
        await DB.prepare('DELETE FROM about_media WHERE id = ?').bind(row.id).run();
        await DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(row.r2_key).run();
      }
    }

    // Update positions
    const stmts = body.media.map((m, i) =>
      DB.prepare('UPDATE about_media SET position = ? WHERE id = ?').bind(i, m.id)
    );
    if (stmts.length) await DB.batch(stmts);
  }

  return Response.json({ success: true });
}

// POST /api/admin/about — add media to about section (upload)
export async function onRequestPost(context) {
  const { DB, R2_BUCKET } = context.env;

  const formData = await context.request.formData();
  const file = formData.get('file');
  const filename = formData.get('filename') || file?.name || 'file';

  if (!file) {
    return Response.json({ error: 'File required' }, { status: 400 });
  }

  const ext = filename.split('.').pop().toLowerCase();
  const contentType = file.type || 'application/octet-stream';
  const r2Key = crypto.randomUUID() + '.' + ext;
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await R2_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
  });

  // Get next position
  const last = await DB.prepare('SELECT MAX(position) as maxPos FROM about_media').first();
  const position = (last?.maxPos ?? -1) + 1;

  await DB.batch([
    DB.prepare(
      'INSERT INTO media (id, r2_key, filename, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, r2Key, filename, contentType, file.size),
    DB.prepare(
      'INSERT INTO about_media (id, r2_key, position) VALUES (?, ?, ?)'
    ).bind(id, r2Key, position),
  ]);

  return Response.json({
    id,
    r2_key: r2Key,
    src: `/media/${r2Key}`,
    filename,
  }, { status: 201 });
}
