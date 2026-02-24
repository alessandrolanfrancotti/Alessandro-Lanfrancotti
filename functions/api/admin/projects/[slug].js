// PUT /api/admin/projects/:slug — update project
export async function onRequestPut(context) {
  const { DB } = context.env;
  const slug = context.params.slug;
  const body = await context.request.json();

  const project = await DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first();
  if (!project) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const newSlug = body.slug || slug;

  await DB.prepare(
    'UPDATE projects SET title = ?, slug = ?, work_type = ?, abstract = ? WHERE id = ?'
  ).bind(body.title || '', newSlug, body.workType || '', body.abstract || '', project.id).run();

  // Handle media: body.media is array of { id, r2_key }
  if (Array.isArray(body.media)) {
    // Get current media
    const current = await DB.prepare(
      'SELECT id, r2_key FROM project_media WHERE project_id = ?'
    ).bind(project.id).all();
    const keepIds = new Set(body.media.map(m => m.id));

    // Delete removed media rows (R2 files managed separately via /api/admin/media)
    const toDelete = current.results.filter(m => !keepIds.has(m.id));
    for (const m of toDelete) {
      await DB.prepare('DELETE FROM project_media WHERE id = ?').bind(m.id).run();
    }

    // Update positions for kept media
    const stmts = body.media.map((m, i) =>
      DB.prepare('UPDATE project_media SET position = ? WHERE id = ?').bind(i, m.id)
    );
    if (stmts.length) await DB.batch(stmts);
  }

  return Response.json({ success: true, slug: newSlug });
}

// DELETE /api/admin/projects/:slug — delete project + its media
export async function onRequestDelete(context) {
  const { DB, R2_BUCKET } = context.env;
  const slug = context.params.slug;

  const project = await DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first();
  if (!project) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Get all media for this project
  const media = await DB.prepare(
    'SELECT r2_key FROM project_media WHERE project_id = ?'
  ).bind(project.id).all();

  // Delete files from R2
  for (const m of media.results) {
    await R2_BUCKET.delete(m.r2_key);
    await DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(m.r2_key).run();
  }

  // Delete project (CASCADE will delete project_media rows)
  await DB.prepare('DELETE FROM project_media WHERE project_id = ?').bind(project.id).run();
  await DB.prepare('DELETE FROM projects WHERE id = ?').bind(project.id).run();

  // Renumber remaining projects
  const remaining = await DB.prepare('SELECT id FROM projects ORDER BY position').all();
  const stmts = remaining.results.map((p, i) =>
    DB.prepare('UPDATE projects SET position = ? WHERE id = ?').bind(i, p.id)
  );
  if (stmts.length) await DB.batch(stmts);

  return Response.json({ success: true });
}

// POST /api/admin/projects/:slug — add media to project (upload)
export async function onRequestPost(context) {
  const { DB, R2_BUCKET } = context.env;
  const slug = context.params.slug;

  const project = await DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first();
  if (!project) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

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
  const last = await DB.prepare(
    'SELECT MAX(position) as maxPos FROM project_media WHERE project_id = ?'
  ).bind(project.id).first();
  const position = (last?.maxPos ?? -1) + 1;

  await DB.batch([
    DB.prepare(
      'INSERT INTO media (id, r2_key, filename, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, r2Key, filename, contentType, file.size),
    DB.prepare(
      'INSERT INTO project_media (id, project_id, r2_key, position) VALUES (?, ?, ?, ?)'
    ).bind(id, project.id, r2Key, position),
  ]);

  return Response.json({
    id,
    r2_key: r2Key,
    src: `/media/${r2Key}`,
    filename,
  }, { status: 201 });
}
