// api/github/get.js
const OWNER  = process.env.GH_OWNER;
const REPO   = process.env.GH_REPO;
const BRANCH = process.env.GH_BRANCH || "main";
const TOKEN  = process.env.GITHUB_TOKEN;

module.exports = async (req, res) => {
  // CORS (optional)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  try {
    const path = req.query.path;
    if (!path) return res.status(400).json({ error: "path required" });

    const gh = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`, {
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fabaronews"
      }
    });

    if (gh.status === 404) {
      // raw URL tetap kita kembalikan untuk kenyamanan
      const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
      return res.status(404).json({ exists:false, sha:null, items:[], rawUrl });
    }
    if (!gh.ok) {
      const t = await gh.text();
      return res.status(gh.status).json({ error: t });
    }

    const js = await gh.json();
    const content = Buffer.from(js.content || "", "base64").toString("utf8");
    let items = [];
    try { items = JSON.parse(content); } catch { items = []; }

    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json({ exists:true, sha: js.sha, items, rawUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
