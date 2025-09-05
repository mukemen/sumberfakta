// api/github/dispatch.js
const OWNER  = process.env.GH_OWNER;
const REPO   = process.env.GH_REPO;
const BRANCH = process.env.GH_BRANCH || "main";
const TOKEN  = process.env.GITHUB_TOKEN;

module.exports = async (req, res) => {
  try {
    const gh = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/build-news.yml/dispatches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fabaronews",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref: BRANCH })
    });
    const txt = await gh.text();
    // GitHub kadang balas 204 tanpa body; anggap sukses
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(gh.ok ? 200 : gh.status).json(gh.ok ? { ok:true } : { error: txt });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
