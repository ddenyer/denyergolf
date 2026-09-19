// Validates an access code by calling the custom WordPress endpoint.
// Returns the coupon's tool, membership and usage data, or a reason for rejection.
//
// This is a copy of api/validate-code.js in the changebefore-tools repo, with the
// Supabase session_config lookup removed: this tool has no facilitator step, so
// there is never a session_config to find. The response shape is unchanged, so the
// two files can be kept in step.
//
// Env vars required on this Vercel project:
//   WP_APP_USER      vercel-api-bot
//   WP_APP_PASSWORD  that user's WordPress application password
//
// NOTE: WordPress does not filter by tool. Every valid coupon on the site comes
// back valid, with a `tool` field naming the membership it belongs to. Keeping
// other tools' codes out is done in the page, not here.

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.method === 'GET'
    ? req.query.code
    : (req.body && req.body.code);

  if (!code || typeof code !== 'string' || code.length > 50) {
    return res.status(400).json({ valid: false, reason: 'invalid_code_format' });
  }

  const cleanCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
    return res.status(400).json({ valid: false, reason: 'invalid_code_format' });
  }

  const wpUser = process.env.WP_APP_USER;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpUser || !wpPass) {
    console.error('validate-code: WP_APP_USER or WP_APP_PASSWORD is not set');
    return res.status(500).json({ valid: false, reason: 'server_misconfigured' });
  }

  try {
    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
    const r = await fetch(
      `https://changebefore.com/wp-json/changebefore/v1/validate-coupon/${cleanCode}`,
      { headers: { 'Authorization': `Basic ${auth}` } }
    );

    if (!r.ok) {
      console.error('WP validate-coupon non-OK:', r.status);
      return res.status(502).json({ valid: false, reason: 'upstream_error' });
    }

    let data;
    try {
      data = await r.json();
    } catch (e) {
      // Usually a SiteGround HTML block page rather than JSON. Clears itself in about an hour.
      console.error('WP validate-coupon returned non-JSON:', e);
      return res.status(502).json({ valid: false, reason: 'non_json_response' });
    }

    if (data) data.session_config = null;

    res.setHeader('Cache-Control', data && data.valid ? 'public, max-age=60, s-maxage=60' : 'no-store');
    return res.status(200).json(data);
  } catch (err) {
    console.error('validate-code handler error:', err);
    return res.status(500).json({ valid: false, reason: 'upstream_unreachable' });
  }
}
