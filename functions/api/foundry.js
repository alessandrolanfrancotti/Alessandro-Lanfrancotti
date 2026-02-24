// GET /api/foundry — all typefaces, ordered by position
export async function onRequestGet(context) {
  const DB = context.env.DB;

  const rows = await DB.prepare(
    'SELECT id, name, slug, tagline, description, preview_font_key, trial_zip_key, trial_license_key, styles, pricing, position FROM foundry ORDER BY position'
  ).all();

  return Response.json({
    foundry: rows.results.map(f => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      tagline: f.tagline,
      description: f.description,
      previewFontUrl: f.preview_font_key ? `/media/${f.preview_font_key}` : '',
      trialZipUrl: f.trial_zip_key ? `/media/${f.trial_zip_key}` : '',
      trialLicenseUrl: f.trial_license_key ? `/media/${f.trial_license_key}` : '',
      styles: JSON.parse(f.styles),
      pricing: JSON.parse(f.pricing),
    })),
  });
}
