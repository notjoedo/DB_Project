import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database, fail } from "@/lib/server";
import { species, opportunities } from "@/lib/data";
async function profile() {
  const u = await getChatGPTUser();
  if (!u) return null;
  const db = database();
  await db
    .prepare(
      "INSERT INTO profiles (id,email,name) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(u.userId, u.email, u.fullName ?? u.email.split("@")[0])
    .run();
  if (
    (env as any).TREEFINDER_ADMIN_EMAIL?.toLowerCase() === u.email.toLowerCase()
  )
    await db
      .prepare(
        "UPDATE profiles SET role='admin',requested_role=NULL WHERE id=?",
      )
      .bind(u.userId)
      .run();
  return await db
    .prepare("SELECT * FROM profiles WHERE id=?")
    .bind(u.userId)
    .first<any>();
}
export async function GET() {
  try {
    const db = database();
    const me = await profile();
    const publicRows = await db
      .prepare(
        "SELECT * FROM records WHERE (status='approved' OR kind='question') ORDER BY created DESC LIMIT 150",
      )
      .all();
    const own = me
      ? await db
          .prepare(
            "SELECT * FROM records WHERE owner=? ORDER BY created DESC LIMIT 150",
          )
          .bind(me.id)
          .all()
      : { results: [] };
    const registrations = me
      ? await db
          .prepare("SELECT * FROM registrations WHERE owner=?")
          .bind(me.id)
          .all()
      : { results: [] };
    const votes = await db
      .prepare("SELECT species,count(*) as count FROM votes GROUP BY species")
      .all();
    const favorite = me
      ? await db
          .prepare("SELECT species FROM votes WHERE owner=?")
          .bind(me.id)
          .first()
      : null;
    const review =
      me && ["admin", "arborist"].includes(me.role)
        ? await db
            .prepare(
              "SELECT * FROM records WHERE status='pending' ORDER BY created DESC LIMIT 100",
            )
            .all()
        : { results: [] };
    const people =
      me?.role === "admin"
        ? await db
            .prepare("SELECT * FROM profiles ORDER BY name LIMIT 100")
            .all()
        : { results: [] };
    return Response.json({
      me,
      records: publicRows.results,
      own: own.results,
      registrations: registrations.results,
      votes: votes.results,
      favorite,
      review: review.results,
      people: people.results,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const me = await profile();
    if (!me)
      return Response.json(
        { error: "Sign in to join the Treefinder community." },
        { status: 401 },
      );
    const db = database();
    const b = (await request.json()) as any;
    const str = (v: unknown, max = 3000) =>
      typeof v === "string" ? v.trim().slice(0, max) : "";
    const id = crypto.randomUUID();
    const created = new Date().toISOString();
    if (b.action === "profile") {
      const name = str(b.name, 80);
      if (!name)
        return Response.json(
          { error: "Enter your display name." },
          { status: 400 },
        );
      const requestedRole = ["volunteer", "arborist", "admin"].includes(
        b.requestedRole,
      )
        ? b.requestedRole
        : null;
      await db
        .prepare(
          "UPDATE profiles SET name=?,bio=?,certification=?,requested_role=? WHERE id=?",
        )
        .bind(
          name,
          str(b.bio, 1000),
          str(b.certification, 200),
          requestedRole,
          me.id,
        )
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "register" || b.action === "cancel") {
      const event = str(b.event, 100);
      const exists =
        opportunities.some((x) => x.id === event) ||
        (await db
          .prepare(
            "SELECT id FROM records WHERE id=? AND kind='opportunity' AND status='approved'",
          )
          .bind(event)
          .first());
      if (!exists)
        return Response.json(
          { error: "This event is unavailable." },
          { status: 400 },
        );
      if (b.action === "cancel")
        await db
          .prepare("DELETE FROM registrations WHERE owner=? AND event=?")
          .bind(me.id, event)
          .run();
      else
        await db
          .prepare(
            "INSERT INTO registrations (id,owner,event,created) VALUES (?,?,?,?) ON CONFLICT(owner,event) DO NOTHING",
          )
          .bind(id, me.id, event, created)
          .run();
      return Response.json({ ok: true });
    }
    if (b.action === "vote") {
      if (
        !species.some((s) => s.id === b.species) &&
        !(await db
          .prepare(
            "SELECT id FROM records WHERE id=? AND kind='species' AND status='approved'",
          )
          .bind(b.species)
          .first())
      )
        return Response.json(
          { error: "Choose a tree from the catalog." },
          { status: 400 },
        );
      await db
        .prepare(
          "INSERT INTO votes (owner,species) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET species=excluded.species",
        )
        .bind(me.id, b.species)
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "submit") {
      const kind = str(b.kind, 20);
      if (
        ![
          "site",
          "question",
          "hours",
          "organization",
          "opportunity",
          "species",
          "guide",
          "answer",
        ].includes(kind)
      )
        return Response.json(
          { error: "Unknown submission type." },
          { status: 400 },
        );
      if (kind === "guide" && !["arborist", "admin"].includes(me.role))
        return Response.json(
          {
            error:
              "A verified arborist or admin can manage catalog information and care guides.",
          },
          { status: 403 },
        );
      const name = str(b.name, 150);
      if (!name)
        return Response.json(
          { error: "A title is required." },
          { status: 400 },
        );
      const allowed: Record<string, string[]> = {
        site: [
          "area",
          "lat",
          "lng",
          "priority",
          "soil",
          "sun",
          "water",
          "space",
          "zone",
          "text",
        ],
        question: ["text", "topic"],
        hours: ["event", "date", "hours", "text"],
        organization: ["focus", "url"],
        opportunity: ["org", "place", "date", "time", "hours", "type", "text"],
        species: [
          "baseId",
          "latin",
          "description",
          "habit",
          "height",
          "width",
          "zone",
          "sun",
          "soil",
          "water",
          "native",
          "wildlife",
          "source",
        ],
        guide: ["text", "url"],
        answer: ["question", "text"],
      };
      const payload: any = Object.fromEntries(
        allowed[kind]
          .filter((k) => b.payload?.[k] !== undefined)
          .map((k) => [k, b.payload[k]]),
      );
      if (kind === "site") {
        payload.canopy = 0;
        payload.status = "Community suggested";
        payload.example = false;
      }
      if (JSON.stringify(payload).length > 16000)
        return Response.json(
          { error: "Your submission is too long." },
          { status: 400 },
        );
      if (
        kind === "site" &&
        (!["High", "Medium", "Low"].includes(payload.priority) ||
          !["Clay", "Loam", "Sand"].includes(payload.soil) ||
          !["Full sun", "Partial shade"].includes(payload.sun) ||
          !["Moist", "Moderate"].includes(payload.water) ||
          !Number.isFinite(Number(payload.lat)) ||
          !Number.isFinite(Number(payload.lng)) ||
          Math.abs(Number(payload.lat)) > 90 ||
          Math.abs(Number(payload.lng)) > 180 ||
          Number(payload.space) <= 0 ||
          Number(payload.zone) < 1 ||
          Number(payload.zone) > 13)
      )
        return Response.json(
          { error: "Enter valid coordinates, canopy space, and climate zone." },
          { status: 400 },
        );
      if (kind === "hours") {
        const hours = Number(payload.hours);
        if (
          !Number.isFinite(hours) ||
          hours <= 0 ||
          hours > 24 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "") ||
          payload.date > created.slice(0, 10)
        )
          return Response.json(
            { error: "Enter 0–24 hours and a valid past participation date." },
            { status: 400 },
          );
        if (
          !(await db
            .prepare("SELECT id FROM registrations WHERE owner=? AND event=?")
            .bind(me.id, payload.event)
            .first())
        )
          return Response.json(
            { error: "Register for the event before logging hours." },
            { status: 400 },
          );
        const seededEvent = opportunities.find((e) => e.id === payload.event);
        const storedEvent = seededEvent
          ? null
          : await db
              .prepare(
                "SELECT payload FROM records WHERE id=? AND kind='opportunity' AND status='approved'",
              )
              .bind(payload.event)
              .first<any>();
        const eventDate =
          seededEvent?.date ??
          (storedEvent ? JSON.parse(storedEvent.payload).date : null);
        if (!eventDate || payload.date < eventDate)
          return Response.json(
            { error: "Participation must be on or after the event date." },
            { status: 400 },
          );
      }
      if (kind === "answer") {
        if (
          !(await db
            .prepare("SELECT id FROM records WHERE id=? AND kind='question'")
            .bind(payload.question)
            .first())
        )
          return Response.json(
            { error: "Question not found." },
            { status: 400 },
          );
        payload.verified = ["admin", "arborist"].includes(me.role);
        payload.author = me.name;
      }
      if (kind === "question") payload.author = me.name;
      if (
        ["question", "answer", "guide"].includes(kind) &&
        (!str(payload.text) || typeof payload.text !== "string")
      )
        return Response.json(
          { error: "Enter the text of your contribution." },
          { status: 400 },
        );
      if (["organization", "opportunity"].includes(kind)) {
        if (payload.url && !/^https:\/\//.test(payload.url))
          return Response.json(
            { error: "Organization links must use HTTPS." },
            { status: 400 },
          );
      }
      if (
        kind === "opportunity" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "") ||
          payload.date < created.slice(0, 10) ||
          !Number.isFinite(payload.hours) ||
          payload.hours <= 0 ||
          payload.hours > 24 ||
          !payload.org ||
          !payload.place ||
          !payload.time)
      )
        return Response.json(
          {
            error:
              "Enter a future event date, valid duration, organization, location, and time.",
          },
          { status: 400 },
        );
      if (
        kind === "species" &&
        (!Number.isFinite(payload.height) ||
          !Number.isFinite(payload.width) ||
          !Array.isArray(payload.zone) ||
          !payload.zone.every((x: any) => Number.isFinite(x)) ||
          !Array.isArray(payload.sun) ||
          !payload.sun.every((x: string) =>
            ["Full sun", "Partial shade"].includes(x),
          ) ||
          !Array.isArray(payload.soil) ||
          !payload.soil.every((x: string) =>
            ["Clay", "Loam", "Sand"].includes(x),
          ) ||
          !payload.latin ||
          !payload.source ||
          !/^https:\/\//.test(payload.source) ||
          !Array.isArray(payload.zone) ||
          payload.zone[0] < 1 ||
          payload.zone[1] > 13 ||
          payload.zone[0] > payload.zone[1] ||
          payload.width <= 0 ||
          payload.height <= 0 ||
          !Array.isArray(payload.sun) ||
          !Array.isArray(payload.soil))
      )
        return Response.json(
          {
            error:
              "Provide scientific name, HTTPS source, valid sizes, zones, sunlight, and soil requirements.",
          },
          { status: 400 },
        );
      const status =
        ["question", "answer"].includes(kind) ||
        (["species", "guide"].includes(kind) &&
          ["admin", "arborist"].includes(me.role))
          ? "approved"
          : "pending";
      await db
        .prepare(
          "INSERT INTO records (id,kind,owner,name,payload,status,created) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(id, kind, me.id, name, JSON.stringify(payload), status, created)
        .run();
      return Response.json({ ok: true, id, status });
    }
    if (b.action === "review") {
      if (!["arborist", "admin"].includes(me.role))
        return Response.json(
          { error: "Verified reviewer access is required." },
          { status: 403 },
        );
      const row = await db
        .prepare("SELECT * FROM records WHERE id=?")
        .bind(b.id)
        .first<any>();
      if (!row || !["approved", "rejected"].includes(b.status))
        return Response.json(
          { error: "Submission not found." },
          { status: 400 },
        );
      if (
        me.role === "arborist" &&
        !["site", "species", "question", "answer", "guide"].includes(row.kind)
      )
        return Response.json(
          {
            error: "An admin reviews organizations, opportunities, and hours.",
          },
          { status: 403 },
        );
      await db
        .prepare("UPDATE records SET status=? WHERE id=?")
        .bind(b.status, b.id)
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "role") {
      if (me.role !== "admin")
        return Response.json(
          { error: "Admin access is required." },
          { status: 403 },
        );
      if (
        !["general", "volunteer", "arborist", "admin"].includes(b.role) ||
        b.id === me.id
      )
        return Response.json(
          { error: "Choose a valid role for another member." },
          { status: 400 },
        );
      await db
        .prepare("UPDATE profiles SET role=?,requested_role=NULL WHERE id=?")
        .bind(b.role, b.id)
        .run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
