// GET /api/homepage — public homepage video info
export async function onRequestGet(context) {
  const { DB } = context.env;

  const row = await DB.prepare("SELECT value FROM settings WHERE key = 'homepage_video'").first();

  if (!row?.value) {
    return Response.json({ src: null });
  }

  return Response.json({ src: `/media/${row.value}` });
}
