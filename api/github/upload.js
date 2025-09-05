// /api/github/upload.js (CommonJS)
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

    const body = req.body || {};
    const { contentB64, ext = "jpg", filename = "" } = body;
    if (!contentB64) return res.status(400).json({ error: "contentB64 wajib" });

    const safeExt = (ext || (filename.split(".").pop() || "jpg")).toLowerCase().replace(/[^a-z0-9]/g,"") || "jpg";
    const fname = `img-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
    const path  = `images/uploads/${fname}`;

    const gh = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fabaronews",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message:`chore: upload ${fname}`, content: contentB64, branch: BRANCH })
    });

    const txt = await gh.text();
    if (!gh.ok) return res.status(gh.status).json({ error: txt });

    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json({ ok:true, path, rawUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
