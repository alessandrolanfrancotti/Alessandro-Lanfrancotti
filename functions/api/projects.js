// GET /api/projects — all projects with media, ordered by position
export async function onRequestGet(context) {
  const DB = context.env.DB;

  const projects = await DB.prepare(
    'SELECT id, title, slug, work_type, abstract, position FROM projects ORDER BY position'
  ).all();

  const allMedia = await DB.prepare(
    'SELECT id, project_id, r2_key, position FROM project_media ORDER BY position'
  ).all();

  // Group media by project_id
  const mediaByProject = {};
  for (const m of allMedia.results) {
    if (!mediaByProject[m.project_id]) mediaByProject[m.project_id] = [];
    mediaByProject[m.project_id].push({
      id: m.id,
      src: `/media/${m.r2_key}`,
    });
  }

  return Response.json({
    projects: projects.results.map(p => ({
      title: p.title,
      slug: p.slug,
      workType: p.work_type,
      abstract: p.abstract,
      media: mediaByProject[p.id] || [],
    })),
  });
}
