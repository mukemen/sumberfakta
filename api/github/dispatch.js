// /api/github/dispatch.js (CommonJS)
module.exports = async (_req, res) => {
  try {
    const OWNER  = process.env.GH_OWNER;
    const REPO   = process.env.GH_REPO;
    const BRANCH = process.env.GH_BRANCH || "main";
    const TOKEN  = process.env.GITHUB_TOKEN;
    if (!OWNER || !REPO || !TOKEN) {
      return res.status(500).json({ error: "ENV GH_OWNER/GH_REPO/GITHUB_TOKEN belum diset" });
    }

    const r = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/build-news.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "fabaronews",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: BRANCH }),
      }
    );

    const txt = await r.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(r.ok ? 200 : r.status).json(r.ok ? { ok: true } : { error: txt });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
