import pool from './config/neon.js';

export default async function handler(req, res) {
  try {
    if (req.url.includes('/version')) {
      res.json({
        now: new Date().toISOString(),
        vercel: {
          env: process.env.VERCEL || null,
          region: process.env.VERCEL_REGION || null,
          url: process.env.VERCEL_URL || null,
          gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
          gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
          gitRepoSlug: process.env.VERCEL_GIT_REPO_SLUG || null,
        },
        node: {
          version: process.version,
          pid: process.pid,
          cwd: process.cwd(),
        },
      });
    } else if (req.url.includes('/tables')) {
      const result = await pool.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
        `
      );
      res.json({ ok: true, tables: result.rows.map((r) => r.table_name) });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
