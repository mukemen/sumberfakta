// /api/github/get.js (CommonJS)
module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  try {
    const OWNER  = process.env.GH_OWNER;
    const REPO   = process.env.GH_REPO;
    const BRANCH = process.env.GH_BRANCH || "main";
    const TOKEN  = process.env.GITHUB_TOKEN;

    if (!OWNER || !REPO || !TOKEN) {
      return res.status(500).json({ error: "ENV GH_OWNER/GH_REPO/GITHUB_TOKEN belum diset" });
    }

    const path = req.query.path;
    if (!path) return res.status(400).json({ error: "query ?path= wajib" });

    const gh = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "fabaronews",
        },
      }
    );

    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;

    if (gh.status === 404) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(404).json({ exists: false, sha: null, items: [], rawUrl });
    }

    const txt = await gh.text();
    if (!gh.ok) return res.status(gh.status).json({ error: txt });

    const js = JSON.parse(txt);
    const content = Buffer.from(js.content || "", "base64").toString("utf8");
    let items = [];
    try { items = JSON.parse(content); } catch {}

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json({ exists: true, sha: js.sha, items, rawUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
