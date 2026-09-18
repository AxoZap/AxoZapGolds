import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

type Bindings = {
  axozap_golds_db: D1Database;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
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
  group_name?: string | null;
  completed?: boolean | number;
  created_at?: string;
};

export type LevelGroup = {
  id?: number | string;
  name: string;
  description?: string | null;
  date?: string | null;
  url?: string | null;
  attempts?: number | null;
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
      "Cf-Access-Jwt-Assertion",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Validate a Cloudflare Access JWT properly using the team's public JWKS.
// Returns true only if the token is signed by Cloudflare and the AUD matches.
async function isAuthorized(c: any): Promise<boolean> {
  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = c.env.CF_ACCESS_AUD;

  // Both secrets/vars must be configured - fail closed if missing
  if (!teamDomain || !aud) {
    console.error("CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD not configured");
    return false;
  }

  const token =
    c.req.header("cf-access-jwt-assertion") || // passed by frontend JS
    c.req.header("Cf-Access-Jwt-Assertion");   // injected by CF Access proxy

  if (!token) return false;

  try {
    const jwksUrl = `${teamDomain.replace(/\/$/, "")}/cdn-cgi/access/certs`;
    const jwksRes = await fetch(jwksUrl, {
      cf: { cacheEverything: true, cacheTtl: 3600 },
    } as any);

    if (!jwksRes.ok) {
      console.error("Failed to fetch JWKS:", jwksRes.status);
      return false;
    }

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
        const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
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
        if (!payload.aud?.includes(aud)) return false;

        return true;
      } catch {
        // try next key
      }
    }
    return false;
  } catch (err) {
    console.error("JWT validation error:", err);
    return false;
  }
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
    group_name: row.group_name ? String(row.group_name).trim() : null,
    completed: row.completed === 0 || row.completed === false ? false : true,
    created_at: row.created_at,
  };
}

function formatGroup(row: any): LevelGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    date: row.date || null,
    url: row.url || null,
    attempts: row.attempts != null && row.attempts !== "" ? Number(row.attempts) : null,
    created_at: row.created_at,
  };
}

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/api/health", (c) => c.json({ status: "ok" }));

// GET golds
async function handleGetGolds(c: any) {
  const admin = await isAuthorized(c);
  const db = c.env.axozap_golds_db;

  let query = "SELECT * FROM golds ORDER BY id ASC";
  if (!admin) {
    query = "SELECT * FROM golds WHERE hidden = 0 ORDER BY id ASC";
  }

  const { results } = await db.prepare(query).all();
  const list = (results || []).map(formatGold);

  return c.json(list);
}

app.get("/golds", handleGetGolds);
app.get("/api/golds", handleGetGolds);

// POST gold (Admin only)
async function handlePostGold(c: any) {
  if (!(await isAuthorized(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const gold = body.gold || body;
  const db = c.env.axozap_golds_db;

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
  const group_name = gold.group_name && String(gold.group_name).trim() ? String(gold.group_name).trim() : null;
  const completed = gold.completed === false || gold.completed === 0 ? 0 : 1;

  const result = await db
    .prepare(
      "INSERT INTO golds (placement, name, difficulty, date, attempts, clip, hidden, group_name, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(placement, name, difficulty, date, attempts, clip, hidden, group_name, completed)
    .run();

  const newId = result.meta?.last_row_id;
  const created: any = await db
    .prepare("SELECT * FROM golds WHERE id = ?")
    .bind(newId)
    .first();

  return c.json(formatGold(created || { id: newId, placement, name, difficulty, date, attempts, clip, hidden, group_name, completed }), 201);
}

app.post("/golds", handlePostGold);
app.post("/api/golds", handlePostGold);

// PUT gold (Admin only)
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
  const group_name = gold.group_name && String(gold.group_name).trim() ? String(gold.group_name).trim() : null;
  const completed = gold.completed === false || gold.completed === 0 ? 0 : 1;

  if (placement != null) {
    await db
      .prepare(
        "UPDATE golds SET placement = ?, name = ?, difficulty = ?, date = ?, attempts = ?, clip = ?, hidden = ?, group_name = ?, completed = ? WHERE id = ?"
      )
      .bind(placement, name, difficulty, date, attempts, clip, hidden, group_name, completed, id)
      .run();
  } else {
    await db
      .prepare(
        "UPDATE golds SET name = ?, difficulty = ?, date = ?, attempts = ?, clip = ?, hidden = ?, group_name = ?, completed = ? WHERE id = ?"
      )
      .bind(name, difficulty, date, attempts, clip, hidden, group_name, completed, id)
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

// DELETE gold (Admin only)
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

// ================= LEVEL GROUPS API =================

// GET /groups
async function handleGetGroups(c: any) {
  const db = c.env.axozap_golds_db;
  const { results } = await db.prepare("SELECT * FROM level_groups ORDER BY name ASC").all();
  return c.json((results || []).map(formatGroup));
}
app.get("/groups", handleGetGroups);
app.get("/api/groups", handleGetGroups);

// POST /groups (Admin only)
async function handlePostGroup(c: any) {
  if (!(await isAuthorized(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const group = body.group || body;
  const db = c.env.axozap_golds_db;

  const name = String(group.name || "").trim();
  if (!name) {
    return c.json({ error: "Group name is required" }, 400);
  }

  const description = group.description ? String(group.description).trim() : null;
  const date = group.date ? String(group.date).trim() : null;
  const url = group.url ? String(group.url).trim() : null;
  const attempts =
    group.attempts !== undefined && group.attempts !== null && group.attempts !== ""
      ? Number(group.attempts)
      : null;

  try {
    const result = await db
      .prepare(
        "INSERT INTO level_groups (name, description, date, url, attempts) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(name, description, date, url, attempts)
      .run();

    const newId = result.meta?.last_row_id;
    const created: any = await db
      .prepare("SELECT * FROM level_groups WHERE id = ?")
      .bind(newId)
      .first();

    return c.json(formatGroup(created || { id: newId, name, description, date, url, attempts }), 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create group" }, 400);
  }
}
app.post("/groups", handlePostGroup);
app.post("/api/groups", handlePostGroup);

// PUT /groups/:id (Admin only) - Also cascades name updates to golds.group_name
async function handlePutGroup(c: any) {
  if (!(await isAuthorized(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const group = body.group || body;
  const db = c.env.axozap_golds_db;

  const existing: any = await db
    .prepare("SELECT * FROM level_groups WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Group not found" }, 404);
  }

  const oldName = existing.name;
  const newName = String(group.name || "").trim();
  if (!newName) {
    return c.json({ error: "Group name is required" }, 400);
  }

  const description = group.description ? String(group.description).trim() : null;
  const date = group.date ? String(group.date).trim() : null;
  const url = group.url ? String(group.url).trim() : null;
  const attempts =
    group.attempts !== undefined && group.attempts !== null && group.attempts !== ""
      ? Number(group.attempts)
      : null;

  try {
    await db
      .prepare(
        "UPDATE level_groups SET name = ?, description = ?, date = ?, url = ?, attempts = ? WHERE id = ?"
      )
      .bind(newName, description, date, url, attempts, id)
      .run();

    // If group name changed, cascade to all gold levels in this group
    if (oldName !== newName) {
      await db
        .prepare("UPDATE golds SET group_name = ? WHERE group_name = ?")
        .bind(newName, oldName)
        .run();
    }

    const updated: any = await db
      .prepare("SELECT * FROM level_groups WHERE id = ?")
      .bind(id)
      .first();

    return c.json(formatGroup(updated));
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update group" }, 400);
  }
}
app.put("/groups/:id", handlePutGroup);
app.put("/api/groups/:id", handlePutGroup);

// DELETE /groups/:id (Admin only)
async function handleDeleteGroup(c: any) {
  if (!(await isAuthorized(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = Number(c.req.param("id"));
  const db = c.env.axozap_golds_db;

  const existing: any = await db
    .prepare("SELECT * FROM level_groups WHERE id = ?")
    .bind(id)
    .first();

  if (existing) {
    // Ungroup levels belonging to this group
    await db
      .prepare("UPDATE golds SET group_name = NULL WHERE group_name = ?")
      .bind(existing.name)
      .run();

    await db.prepare("DELETE FROM level_groups WHERE id = ?").bind(id).run();
  }

  return c.json({ success: true, id });
}
app.delete("/groups/:id", handleDeleteGroup);
app.delete("/api/groups/:id", handleDeleteGroup);

export default app;

