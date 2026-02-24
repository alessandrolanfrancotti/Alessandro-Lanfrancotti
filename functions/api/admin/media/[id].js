// DELETE /api/admin/media/:id — delete file from R2 and D1
export async function onRequestDelete(context) {
  const { DB, R2_BUCKET } = context.env;
  const id = context.params.id;

  const row = await DB.prepare('SELECT id, r2_key FROM media WHERE id = ?').bind(id).first();
  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  await R2_BUCKET.delete(row.r2_key);
  await DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();

  return Response.json({ success: true });
}
