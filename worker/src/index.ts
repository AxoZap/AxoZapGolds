import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

type Bindings = {
  axozap_golds_db: D1Database;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ADMIN_PASSWORD?: string;
};

export type Gold = {
  id?: number | string;
  placement?: number;
  name: string;
  difficulty: string;
  date: string;
  attempts?: number | null;
  clip?: string | null;
  hidden?: boolean | number;
  created_at?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "cf-access-jwt-assertion",
      "x-admin-password",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Authorization check: supports Cloudflare Access JWT and Admin Password
async function isAuthorized(c: any): Promise<boolean> {
  const reqPw =
    c.req.header("x-admin-password") ||
    c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");

  const envPw = c.env.ADMIN_PASSWORD || "axozap";
  if (reqPw && reqPw === envPw) {
    return true;
  }

  // Cloudflare Access JWT validation
  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN || "https://axozapteam.cloudflareaccess.com";
  const aud = c.env.CF_ACCESS_AUD;

  const token =
    c.req.header("cf-access-jwt-assertion") ||
    c.req.header("Cf-Access-Jwt-Assertion");

  if (teamDomain && token) {
    try {
      const jwksUrl = `${teamDomain.replace(/\/$/, "")}/cdn-cgi/access/certs`;
      const jwksRes = await fetch(jwksUrl, {
        cf: { cacheEverything: true, cacheTtl: 3600 },
      } as any);

      if (jwksRes.ok) {
        const { keys } = (await jwksRes.json()) as { keys: JsonWebKey[] };
        for (const jwk of keys) {
          try {
            const cryptoKey = await crypto.subtle.importKey(
              "jwk",
              jwk,
              { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
              false,
              ["verify"]
            );

            const parts = token.split(".");
            if (parts.length !== 3) continue;

            const [headerB64, payloadB64, sigB64] = parts;
            const signingInput = new TextEncoder().encode(
              `${headerB64}.${payloadB64}`
            );
            const sigBytes = Uint8Array.from(
              atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")),
              (ch) => ch.charCodeAt(0)
            );

            const valid = await crypto.subtle.verify(
              "RSASSA-PKCS1-v1_5",
              cryptoKey,
              sigBytes,
              signingInput
            );
            if (!valid) continue;

            const payload = JSON.parse(
              atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
            );
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) return false;
            if (payload.nbf && payload.nbf > now) return false;
            if (aud && !payload.aud?.includes(aud)) return false;

            return true;
          } catch {
            // try next key
          }
        }
      }
    } catch (err) {
      console.error("JWT validation error:", err);
    }
  }

  return false;
}

function formatGold(row: any): Gold {
  return {
    id: row.id,
    placement: row.placement != null ? Number(row.placement) : Number(row.id),
    name: row.name,
    difficulty: row.difficulty,
    date: row.date || "Initial",
    attempts: row.attempts != null && row.attempts !== "" ? Number(row.attempts) : null,
    clip: row.clip || null,
    hidden: Boolean(row.hidden),
    created_at: row.created_at,
  };
}

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Verify admin authorization
app.get("/api/admin/verify", async (c) => {
  const auth = await isAuthorized(c);
  if (!auth) return c.json({ authorized: false }, 401);
  return c.json({ authorized: true });
});

app.post("/api/admin/verify", async (c) => {
  const auth = await isAuthorized(c);
  if (!auth) return c.json({ authorized: false }, 401);
  return c.json({ authorized: true });
});

// GET golds
async function handleGetGolds(c: any) {
  const admin = await isAuthorized(c);
  const db = c.env.axozap_golds_db;

  let query = "SELECT * FROM golds ORDER BY placement ASC, id ASC";
  if (!admin) {
    query = "SELECT * FROM golds WHERE hidden = 0 ORDER BY placement ASC, id ASC";
  }

  const { results } = await db.prepare(query).all();
  const list = (results || []).map(formatGold);

  if (!admin) {
    // Sanitize sequential placement numbers for public view so hidden gaps are not revealed
    return c.json(
      list.map((item: Gold, index: number) => ({
        ...item,
        placement: index + 1,
      }))
    );
  }

  return c.json(list);
}

app.get("/golds", handleGetGolds);
app.get("/api/golds", handleGetGolds);

// POST gold
async function handlePostGold(c: any) {
  if (!(await isAuthorized(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const gold = body.gold || body;
  const db = c.env.axozap_golds_db;

  // Compute next placement
  let placement = gold.placement;
  if (placement == null) {
    const maxRow: any = await db
      .prepare("SELECT COALESCE(MAX(placement), 0) AS maxP FROM golds")
      .first();
    placement = (maxRow?.maxP || 0) + 1;
  }

  const name = String(gold.name || "").trim();
  const difficulty = String(gold.difficulty || "Easy").trim();
  const date = String(gold.date || "Initial").trim() || "Initial";
  const attempts =
    gold.attempts !== undefined && gold.attempts !== null && gold.attempts !== ""
      ? Number(gold.attempts)
      : null;
  const clip = gold.clip ? String(gold.clip).trim() : null;
  const hidden = gold.hidden ? 1 : 0;

  const result = await db
    .prepare(
      "INSERT INTO golds (placement, name, difficulty, date, attempts, clip, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(placement, name, difficulty, date, attempts, clip, hidden)
    .run();

  const newId = result.meta?.last_row_id;
  const created: any = await db
    .prepare("SELECT * FROM golds WHERE id = ?")
    .bind(newId)
    .first();

  return c.json(formatGold(created || { id: newId, placement, name, difficulty, date, attempts, clip, hidden }), 201);
}

app.post("/golds", handlePostGold);
app.post("/api/golds", handlePostGold);

// PUT gold
async function handlePutGold(c: any) {
  if (!(await isAuthorized(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const gold = body.gold || body;
  const db = c.env.axozap_golds_db;

  const name = String(gold.name || "").trim();
  const difficulty = String(gold.difficulty || "Easy").trim();
  const date = String(gold.date || "Initial").trim() || "Initial";
  const attempts =
    gold.attempts !== undefined && gold.attempts !== null && gold.attempts !== ""
      ? Number(gold.attempts)
      : null;
  const clip = gold.clip ? String(gold.clip).trim() : null;
  const hidden = gold.hidden ? 1 : 0;
  const placement = gold.placement != null ? Number(gold.placement) : null;

  if (placement != null) {
    await db
      .prepare(
        "UPDATE golds SET placement = ?, name = ?, difficulty = ?, date = ?, attempts = ?, clip = ?, hidden = ? WHERE id = ?"
      )
      .bind(placement, name, difficulty, date, attempts, clip, hidden, id)
      .run();
  } else {
    await db
      .prepare(
        "UPDATE golds SET name = ?, difficulty = ?, date = ?, attempts = ?, clip = ?, hidden = ? WHERE id = ?"
      )
      .bind(name, difficulty, date, attempts, clip, hidden, id)
      .run();
  }

  const updated: any = await db
    .prepare("SELECT * FROM golds WHERE id = ?")
    .bind(id)
    .first();

  return c.json(formatGold(updated));
}

app.put("/golds/:id", handlePutGold);
app.put("/api/golds/:id", handlePutGold);

// DELETE gold
async function handleDeleteGold(c: any) {
  if (!(await isAuthorized(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = Number(c.req.param("id"));
  const db = c.env.axozap_golds_db;

  await db.prepare("DELETE FROM golds WHERE id = ?").bind(id).run();
  return c.json({ success: true, id });
}

app.delete("/golds/:id", handleDeleteGold);
app.delete("/api/golds/:id", handleDeleteGold);

export default app;
