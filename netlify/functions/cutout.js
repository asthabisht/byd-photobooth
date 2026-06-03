// POST { imageBase64, name }  ->  { png: "data:image/png;base64,..." }
// Bria RMBG 2.0 via Replicate (model "bria/remove-background"), using the official client.
// REPLICATE_API_TOKEN stays server-side. Returns a same-origin data URI so the kiosk
// composites the cut-out without tainting the canvas (a replicate.delivery URL is cross-origin).

import Replicate from "replicate";

const replicate = new Replicate();                                  // reads process.env.REPLICATE_API_TOKEN
const MODEL = process.env.REPLICATE_MODEL || "bria/remove-background";

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (!process.env.REPLICATE_API_TOKEN) return json(500, { error: "REPLICATE_API_TOKEN not configured" });

  let imageBase64;
  try { ({ imageBase64 } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "bad JSON body" }); }
  if (!imageBase64) return json(400, { error: "imageBase64 required" });

  try {
    // Replicate file inputs accept a base64 data URI directly (no separate upload needed).
    const dataUri = `data:image/jpeg;base64,${imageBase64}`;
    const output = await replicate.run(MODEL, { input: { image: dataUri } });

    // Normalize Replicate output to a URL string (FileOutput | string | array of either).
    let url = output;
    if (Array.isArray(url)) url = url[0];
    if (url && typeof url.url === "function") url = url.url();     // FileOutput -> URL object
    if (url && typeof url === "object" && url.href) url = url.href;
    if (typeof url !== "string") return json(502, { error: "unexpected Replicate output" });

    // Fetch the cut-out bytes and hand back a data URI (same-origin for the client).
    const imgRes = await fetch(url);
    if (!imgRes.ok) return json(502, { error: "fetch result " + imgRes.status });
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get("content-type") || "image/png";
    return json(200, { png: `data:${mime};base64,${buf.toString("base64")}` });
  } catch (e) {
    return json(502, { error: "cutout failed", detail: String(e).slice(0, 300) });
  }
}
