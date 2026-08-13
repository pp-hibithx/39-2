const SITE_BASE_URL = (Deno.env.get("SITE_BASE_URL") || "https://pp-hibithx.github.io/39-2").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] || c));
}

function versionedImage(raw: string, version: string) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.searchParams.set("saku_og", version || String(Date.now()));
    return u.href;
  } catch { return raw; }
}

async function getSharedPage(id: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_page`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_id: id })
  });
  if (!r.ok) throw new Error(`shared page ${r.status}`);
  return await r.json();
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const id = (u.searchParams.get("id") || "").trim();
  const urlVersion = (u.searchParams.get("v") || "").trim();
  const target = `${SITE_BASE_URL}/share/?id=${encodeURIComponent(id)}${urlVersion ? `&v=${encodeURIComponent(urlVersion)}` : ""}`;

  if (!id) return new Response("share id required", { status: 400 });

  let p: any = null;
  try { p = await getSharedPage(id); } catch (_) {}

  const isLibrary = p && p.kind === "library-session";
  const title = isLibrary && p.title ? `${p.title}｜SAKU+MERU` : "SAKU+MERU";
  const desc = isLibrary
    ? [p.date || "", p.system || "", p.role || ""].filter(Boolean).join(" / ") || "SAKU+MERUで共有されたセッション記録です。"
    : "「一緒に」探す・遊ぶ・記録・共有。卓のあれこれをサクッとまとめるサイト。";
  const version = String(p?.ogVersion || urlVersion || Date.now());
  const image = isLibrary ? versionedImage(String(p.image || ""), version) : "";

  const imageMeta = image ? `\n<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:image" content="${esc(image)}">` : "";
  const card = image ? "summary_large_image" : "summary";
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="SAKU+MERU">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(u.href)}">${imageMeta}
<meta name="twitter:card" content="${card}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><p><a href="${esc(target)}">SAKU+MERUの共有ページを開く</a></p>
<script>location.replace(${JSON.stringify(target)})<\/script></body></html>`;

  return new Response(req.method === "HEAD" ? null : html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=60"
    }
  });
});
