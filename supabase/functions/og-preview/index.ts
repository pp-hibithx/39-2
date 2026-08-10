const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function decodeHtml(s = "") {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const p of patterns) { const m = html.match(p); if (m) return decodeHtml(m[1].trim()); }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POSTのみ対応しています。" }, 405);
  try {
    const suppliedKey = req.headers.get("apikey") || "";
    let allowedKeys: string[] = [];
    try {
      const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}";
      allowedKeys = Object.values(JSON.parse(raw));
    } catch {}
    const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (legacyAnon) allowedKeys.push(legacyAnon);
    if (!suppliedKey || !allowedKeys.includes(suppliedKey)) return json({ error: "認証できませんでした。" }, 401);

    const { url } = await req.json();
    if (!url || typeof url !== "string") return json({ error: "URLがありません。" }, 400);
    let target: URL;
    try { target = new URL(url); } catch { return json({ error: "URLの形式が正しくありません。" }, 400); }
    if (!/^https?:$/.test(target.protocol)) return json({ error: "http/https URLのみ対応しています。" }, 400);
    const host = target.hostname.toLowerCase();
    if (!(host === "booth.pm" || host.endsWith(".booth.pm"))) {
      return json({ error: "現在の自動取得はBOOTHのURLに対応しています。" }, 400);
    }

    const r = await fetch(target.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; 39x2-LinkPreview/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.8",
      },
    });
    if (!r.ok) return json({ error: `リンク先を取得できませんでした（${r.status}）` }, 502);
    const type = r.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) return json({ error: "HTMLページではありません。" }, 415);
    const html = await r.text();
    const title = meta(html, "og:title") || decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g," ").trim());
    let image = meta(html, "og:image:secure_url") || meta(html, "og:image") || meta(html, "twitter:image");
    if (image) { try { image = new URL(image, r.url).href; } catch { image = ""; } }
    const description = meta(html, "og:description") || meta(html, "description");
    return json({ url: r.url, title, image, description });
  } catch (e) {
    console.error(e);
    return json({ error: "リンク先の情報を取得できませんでした。" }, 500);
  }
});
