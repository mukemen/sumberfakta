// /api/github/commit.js (CommonJS)
module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const OWNER  = process.env.GH_OWNER;
    const REPO   = process.env.GH_REPO;
    const BRANCH = process.env.GH_BRANCH || "main";
    const TOKEN  = process.env.GITHUB_TOKEN;

    if (!OWNER || !REPO || !TOKEN) {
      return res.status(500).json({ error: "ENV GH_OWNER/GH_REPO/GITHUB_TOKEN belum diset" });
    }

    // Vercel otomatis parse JSON body jika header Content-Type benar
    const { path, message, contentB64, sha = null } = req.body || {};
    if (!path || !message || !contentB64) {
      return res.status(400).json({ error: "path, message, contentB64 wajib" });
    }

    const gh = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "fabaronews",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          content: contentB64,   // base64 murni (tanpa prefix)
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    const txt = await gh.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (!gh.ok) return res.status(gh.status).json({ error: txt });

    return res.json(JSON.parse(txt));
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
