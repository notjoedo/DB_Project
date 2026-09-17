"use client";
import { useState } from "react";
import {
  Leaf,
  Search,
  ArrowUpRight,
  Heart,
  MapPin,
  CalendarDays,
  Clock,
  Users,
  ShieldCheck,
  Plus,
  MessageCircle,
  ChevronRight,
  BookOpen,
  Check,
  TreePine,
  Sun,
  Droplets,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  species,
  opportunities,
  groups,
  matchTree,
  type Species,
  type Site,
} from "@/lib/data";
export type RecordData = {
  id: string;
  name: string;
  kind: string;
  owner: string;
  payload: string;
  status: string;
  created: string;
};
export type Community = {
  me: any;
  records: RecordData[];
  own: RecordData[];
  registrations: any[];
  votes: any[];
  favorite: any;
  review: RecordData[];
  people: any[];
};
export const blankCommunity: Community = {
  me: null,
  records: [],
  own: [],
  registrations: [],
  votes: [],
  favorite: null,
  review: [],
  people: [],
};
export function parseRecord(r: RecordData) {
  try {
    return JSON.parse(r.payload);
  } catch {
    return {};
  }
}
export function catalogData(data: Community) {
  const list = [...species];
  [...data.records]
    .reverse()
    .filter((r) => r.kind === "species")
    .forEach((r) => {
      const p = parseRecord(r);
      const t = { ...p, id: p.baseId ?? r.id, name: r.name };
      const i = list.findIndex((s) => s.id === p.baseId);
      if (i >= 0) list[i] = t;
      else list.push(t);
    });
  return list as Species[];
}
export function eventData(data: Community) {
  return [
    ...opportunities,
    ...data.records
      .filter((r) => r.kind === "opportunity")
      .map((r) => ({
        id: r.id,
        title: r.name,
        ...parseRecord(r),
        example: false,
      })),
  ];
}
const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export default function WorkspaceViews({
  view,
  data,
  site,
  onAction,
  onForm,
  user,
}: {
  view: string;
  data: Community;
  site: Site;
  onAction: (p: any) => Promise<any>;
  onForm: (kind: string, initial?: any) => void;
  user: any;
}) {
  const [search, setSearch] = useState("");
  const [sun, setSun] = useState("all");
  const [size, setSize] = useState("all");
  const [zone, setZone] = useState("all");
  const [detail, setDetail] = useState<Species | null>(null);
  const [discussion, setDiscussion] = useState<string | null>(null);
  const trees = catalogData(data);
  const events = eventData(data);
  const staff = ["admin", "arborist"].includes(data.me?.role);
  const approvedHours = data.own
    .filter((r) => r.kind === "hours" && r.status === "approved")
    .reduce((sum, r) => sum + Number(parseRecord(r).hours || 0), 0);
  const pendingHours = data.own
    .filter((r) => r.kind === "hours" && r.status === "pending")
    .reduce((sum, r) => sum + Number(parseRecord(r).hours || 0), 0);
  if (view === "Tree catalog")
    return (
      <>
        <div className="view-toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Search species"
              placeholder="Search common or scientific name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Select value={sun} onValueChange={setSun}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["all", "Full sun", "Partial shade"].map((x) => (
                <SelectItem key={x} value={x}>
                  {x === "all" ? "All sunlight" : x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              <SelectItem value="small">Small · up to 30 ft</SelectItem>
              <SelectItem value="large">Large · over 30 ft</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {Array.from({ length: 13 }, (_, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  Zone {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            className="outline-btn compact"
            onClick={() => onForm("species")}
          >
            <Plus size={16} />
            Contribute species
          </button>
        </div>
        <div className="catalog-context">
          <Leaf size={17} />
          <span>
            Matching trees for <strong>{site.name}</strong> · {site.sun} ·{" "}
            {site.soil} · Zone {site.zone}
          </span>
        </div>
        <div className="catalog-grid">
          {trees
            .filter(
              (t) =>
                `${t.name} ${t.latin} ${t.native} ${t.soil.join(" ")}`
                  .toLowerCase()
                  .includes(search.toLowerCase()) &&
                (sun === "all" || t.sun.includes(sun)) &&
                (size === "all" ||
                  (size === "small" ? t.height <= 30 : t.height > 30)) &&
                (zone === "all" || (+zone >= t.zone[0] && +zone <= t.zone[1])),
            )
            .map((t) => (
              <article className="species-card" key={t.id}>
                <div className="species-card-top">
                  <span className="species-icon">
                    <TreePine size={35} />
                  </span>
                  <span className="native-badge">{t.native}</span>
                  <button
                    aria-label={`Vote for ${t.name}`}
                    className={`heart-button ${data.favorite?.species === t.id ? "favorited" : ""}`}
                    onClick={() => onAction({ action: "vote", species: t.id })}
                  >
                    <Heart
                      size={19}
                      fill={
                        data.favorite?.species === t.id
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                </div>
                <h2>{t.name}</h2>
                <em>{t.latin}</em>
                <p>{t.description}</p>
                <div className="species-facts">
                  <span>
                    <TreePine size={15} />
                    Up to {t.height} ft tall
                  </span>
                  <span>
                    <Sun size={15} />
                    {t.sun.join(" / ")}
                  </span>
                  <span>
                    <Droplets size={15} />
                    {t.water} water
                  </span>
                  <span>
                    <MapPin size={15} />
                    Zones {t.zone.join("–")}
                  </span>
                </div>
                <div className="species-bottom">
                  <span>{matchTree(t, site).score}% site match</span>
                  <button onClick={() => setDetail(t)}>
                    View species <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
            ))}
        </div>
        {!trees.some(
          (t) =>
            `${t.name} ${t.latin} ${t.native} ${t.soil.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (sun === "all" || t.sun.includes(sun)) &&
            (size === "all" ||
              (size === "small" ? t.height <= 30 : t.height > 30)) &&
            (zone === "all" || (+zone >= t.zone[0] && +zone <= t.zone[1])),
        ) && (
          <div className="empty-state">
            <Leaf />
            <h2>No trees match these filters</h2>
            <p>Try another size, sunlight level, or hardiness zone.</p>
          </div>
        )}
        <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <SheetContent className="species-sheet">
            <SheetHeader>
              <SheetTitle>{detail?.name}</SheetTitle>
              <SheetDescription>{detail?.latin}</SheetDescription>
            </SheetHeader>
            {detail && (
              <div className="species-detail">
                <span className="species-icon">
                  <TreePine size={42} />
                </span>
                <p>{detail.description}</p>
                <dl>
                  {[
                    ["Growth habit", detail.habit],
                    [
                      "Mature size",
                      `Up to ${detail.height} ft tall × ${detail.width} ft wide`,
                    ],
                    ["Soil", detail.soil.join(", ")],
                    ["Sunlight", detail.sun.join(" or ")],
                    ["Hardiness", `USDA zones ${detail.zone.join("–")}`],
                    ["Native range", detail.native],
                    ["Water needs", detail.water],
                    ["Wildlife & pollinators", detail.wildlife],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <h3>Match for {site.name}</h3>
                {matchTree(detail, site).checks.map((c) => (
                  <div className="match-check" key={c.name}>
                    <span>{c.name}</span>
                    <span className={c.ok ? "check-good" : "check-warn"}>
                      {c.ok ? "Compatible" : "Needs assessment"}
                    </span>
                  </div>
                ))}
                <a
                  className="outline-btn"
                  href={detail.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the botanical source <ArrowUpRight size={16} />
                </a>
                <button
                  className="primary-btn"
                  onClick={() =>
                    onAction({ action: "vote", species: detail.id })
                  }
                >
                  <Heart size={16} />
                  Vote for this tree
                </button>
                <button
                  className="text-link"
                  onClick={() =>
                    onForm("species", { ...detail, baseId: detail.id })
                  }
                >
                  {staff
                    ? "Edit catalog information"
                    : "Submit a catalog correction"}
                </button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </>
    );
  if (view === "Volunteer")
    return (
      <>
        <Tabs defaultValue="events">
          <div className="view-tabs-header">
            <TabsList variant="line">
              <TabsTrigger value="events">Opportunities</TabsTrigger>
              <TabsTrigger value="groups">Local organizations</TabsTrigger>
            </TabsList>
            <button
              className="outline-btn compact"
              onClick={() => onForm("opportunity")}
            >
              <Plus size={16} />
              Post an opportunity
            </button>
          </div>
          <TabsContent value="events">
            <div className="volunteer-feature">
              <div>
                <span className="eyebrow">YOUR NEIGHBORHOOD NEEDS YOU</span>
                <h2>
                  Spend a morning.
                  <br />
                  Grow something lasting.
                </h2>
                <p>Plant, care for, and learn about the trees around you.</p>
                <span className="feature-note">
                  Example events demonstrate registration; they are not real
                  scheduled activities.
                </span>
              </div>
              <img
                src="https://images.unsplash.com/photo-1697906427792-62201cad5990?auto=format&fit=crop&w=900&q=80"
                alt="Sunlight through the canopy of a mature oak tree"
              />
              <a
                className="photo-credit"
                href="https://unsplash.com/photos/sunlight-filters-through-large-oak-tree-branches-XQm4Z9T9ZKI"
                target="_blank"
                rel="noreferrer"
              >
                Photo on Unsplash
              </a>
            </div>
            <div className="event-grid">
              {events.map((e) => {
                const registered = data.registrations.some(
                  (r) => r.event === e.id,
                );
                return (
                  <article key={e.id} className="event-card">
                    <div className="event-date">
                      <CalendarDays size={18} />
                      {dateLabel(e.date)}
                      {e.example && (
                        <span className="small-tag">Example event</span>
                      )}
                    </div>
                    <span className="event-type">{e.type}</span>
                    <h2>{e.title}</h2>
                    <p className="event-org">{e.org}</p>
                    <div className="event-metadata">
                      <span>
                        <MapPin size={15} />
                        {e.place}
                      </span>
                      <span>
                        <Clock size={15} />
                        {e.time} · {e.hours} hours
                      </span>
                    </div>
                    <button
                      className={registered ? "outline-btn" : "primary-btn"}
                      onClick={() =>
                        onAction({
                          action: registered ? "cancel" : "register",
                          event: e.id,
                        })
                      }
                    >
                      {registered ? (
                        <>
                          <Check size={15} />
                          Registered · cancel
                        </>
                      ) : (
                        <>
                          Join this event <ArrowUpRight size={15} />
                        </>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="groups">
            <div className="view-toolbar">
              <h2 className="view-section-title">Grow with a local group</h2>
              <button
                className="outline-btn compact"
                onClick={() => onForm("organization")}
              >
                <Plus size={16} />
                Submit an organization
              </button>
            </div>
            <div className="group-grid">
              {[
                ...groups,
                ...data.records
                  .filter((r) => r.kind === "organization")
                  .map((r) => ({ name: r.name, ...parseRecord(r) })),
              ].map((g) => (
                <article key={g.name} className="group-card">
                  <span className="species-icon">
                    <Users size={26} />
                  </span>
                  <h2>{g.name}</h2>
                  <p>{g.focus}</p>
                  <a
                    className="outline-btn"
                    href={g.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit organization <ArrowUpRight size={16} />
                  </a>
                </article>
              ))}
            </div>
            <p className="source-note">
              Organization links open their own websites. Check current
              opportunities directly with each group.
            </p>
          </TabsContent>
        </Tabs>
      </>
    );
  if (view === "Community") {
    const questions = data.records.filter((r) => r.kind === "question");
    return (
      <>
        <div className="view-toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Search community questions"
              placeholder="Search community questions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="primary-btn" onClick={() => onForm("question")}>
            <Plus size={16} />
            Ask a question
          </button>
        </div>
        <div className="community-layout">
          <div>
            {questions
              .filter((r) =>
                `${r.name} ${parseRecord(r).text}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((r) => {
                const p = parseRecord(r);
                const answers = data.records.filter(
                  (a) =>
                    a.kind === "answer" && parseRecord(a).question === r.id,
                );
                return (
                  <article className="question-card" key={r.id}>
                    <span className="question-topic">
                      {p.topic ?? "Tree care"}
                    </span>
                    <h2>{r.name}</h2>
                    <p>{p.text}</p>
                    <div className="question-meta">
                      <span>
                        {p.author ?? "Community member"} ·{" "}
                        {new Date(r.created).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() =>
                          setDiscussion(discussion === r.id ? null : r.id)
                        }
                      >
                        <MessageCircle size={15} />
                        {answers.length} replies <ChevronDown size={14} />
                      </button>
                    </div>
                    {discussion === r.id && (
                      <div className="answers">
                        {answers.map((a) => (
                          <div className="answer" key={a.id}>
                            <strong>
                              {parseRecord(a).author ?? "Community member"}{" "}
                              {parseRecord(a).verified && (
                                <span className="verified">
                                  <ShieldCheck size={13} />
                                  Verified arborist
                                </span>
                              )}
                            </strong>
                            <p>{parseRecord(a).text}</p>
                          </div>
                        ))}
                        {!answers.length && (
                          <p className="source-note">
                            Be the first to help this neighbor.
                          </p>
                        )}
                        <button
                          className="outline-btn compact"
                          onClick={() =>
                            onForm("answer", {
                              question: r.id,
                              name: `Reply to ${r.name}`,
                            })
                          }
                        >
                          Write a reply
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            {!questions.length && (
              <div className="empty-state">
                <MessageCircle />
                <h2>Every growing question belongs here.</h2>
                <p>
                  Ask about a tree, share a challenge, or learn from a local
                  arborist.
                </p>
                <button
                  className="primary-btn"
                  onClick={() => onForm("question")}
                >
                  Start a conversation
                </button>
              </div>
            )}
          </div>
          <aside className="community-aside">
            <ShieldCheck />
            <h3>Advice you can grow with</h3>
            <p>
              Answers from certified arborists carry a verification badge.
              Community advice is shared experience and may need a site visit.
            </p>
            <h3>Keep it rooted in kindness</h3>
            <p>
              Be helpful, cite your sources, and respect your neighbors. Share
              locations responsibly.
            </p>
          </aside>
        </div>
      </>
    );
  }
  if (view === "Care guides")
    return (
      <>
        <div className="view-toolbar">
          <h2 className="view-section-title">
            Help a tree thrive, from day one.
          </h2>
          {staff && (
            <button className="primary-btn" onClick={() => onForm("guide")}>
              <Plus size={16} />
              Publish care guide
            </button>
          )}
        </div>
        <div className="guide-grid">
          {[
            {
              id: "plant",
              title: "Before you plant",
              category: "SITE PLANNING",
              text: "Check the mature canopy and root space, sunlight, drainage, and local planting requirements. Have site conditions confirmed before choosing a species.",
              url: "https://www.nycgovparks.org/trees/street-tree-planting",
            },
            {
              id: "care",
              title: "Care for a street tree",
              category: "EVERYDAY STEWARDSHIP",
              text: "Learn how to water, mulch, and care for a neighborhood tree. Follow local guidance and keep mulch away from the trunk.",
              url: "https://treesny.org/community-resources/",
            },
            {
              id: "native",
              title: "Choose a native species",
              category: "RIGHT TREE, RIGHT PLACE",
              text: "Explore NYC Parks’ native planting guide to understand local habitats and plant communities.",
              url: "https://www.nycgovparks.org/pagefiles/76/nrg-native-species-planting-guide-091714.pdf",
            },
            ...data.records
              .filter((r) => r.kind === "guide")
              .map((r) => ({
                id: r.id,
                title: r.name,
                category: "ARBORIST GUIDE",
                text: parseRecord(r).text,
                url: parseRecord(r).url,
              })),
          ].map((g) => (
            <article className="guide-card" key={g.id}>
              <span className="guide-number">
                <BookOpen size={25} />
              </span>
              <span className="eyebrow">{g.category}</span>
              <h2>{g.title}</h2>
              <p>{g.text}</p>
              {g.url && (
                <a href={g.url} target="_blank" rel="noreferrer">
                  Read the guide <ArrowUpRight size={16} />
                </a>
              )}
            </article>
          ))}
        </div>
      </>
    );
  if (view === "My activity")
    return (
      <>
        {!user ? (
          <div className="empty-state">
            <Users />
            <h2>Put down roots in your community.</h2>
            <p>
              Create your profile, join events, and keep track of the time you
              give.
            </p>
            <a
              className="primary-btn"
              href="/signin-with-chatgpt?return_to=%2F"
              target="_top"
            >
              Sign in with ChatGPT <ArrowUpRight size={16} />
            </a>
          </div>
        ) : (
          <>
            <div className="activity-top">
              <div className="profile-card">
                <span className="large-avatar">
                  {(data.me?.name ?? user.name)[0].toUpperCase()}
                </span>
                <div>
                  <h2>{data.me?.name ?? user.name}</h2>
                  <span className="role-badge">
                    {data.me?.role ?? "general"} member
                  </span>
                  <p>
                    {data.me?.bio ||
                      "Tell your community a little about yourself."}
                  </p>
                  {data.me?.requested_role && (
                    <span className="source-note">
                      {data.me.requested_role} verification requested
                    </span>
                  )}
                </div>
                <button
                  className="outline-btn compact"
                  onClick={() =>
                    onForm("profile", data.me ?? { name: user.name })
                  }
                >
                  Edit profile
                </button>
              </div>
              <div className="hours-card">
                <span className="eyebrow">YOUR VOLUNTEER CONTRIBUTION</span>
                <strong>
                  {approvedHours}
                  <small>verified hours</small>
                </strong>
                <Progress value={Math.min(100, (approvedHours / 20) * 100)} />
                <p>{pendingHours} hours awaiting review</p>
              </div>
            </div>
            <div className="activity-columns">
              <div>
                <div className="view-toolbar">
                  <h2 className="view-section-title">Your registered events</h2>
                </div>
                {data.registrations.map((r) => {
                  const e = events.find((e) => e.id === r.event);
                  return (
                    e && (
                      <article className="registration-card" key={r.id}>
                        <CalendarDays />
                        <div>
                          <h3>{e.title}</h3>
                          <p>
                            {dateLabel(e.date)} · {e.place}
                          </p>
                        </div>
                        <button
                          className="text-link"
                          disabled={
                            e.date > new Date().toISOString().slice(0, 10)
                          }
                          title={
                            e.date > new Date().toISOString().slice(0, 10)
                              ? "Available after the event"
                              : "Log participation"
                          }
                          onClick={() =>
                            onForm("hours", { event: e.id, name: e.title })
                          }
                        >
                          {e.date > new Date().toISOString().slice(0, 10)
                            ? "Hours open after event"
                            : "Log hours"}{" "}
                          <Plus size={14} />
                        </button>
                      </article>
                    )
                  );
                })}
                {!data.registrations.length && (
                  <p className="empty">
                    You haven’t joined an event yet. Explore Volunteer to find a
                    place to help.
                  </p>
                )}
                <h2 className="view-section-title activity-section">
                  Participation history
                </h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.own
                      .filter((r) => r.kind === "hours")
                      .map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{parseRecord(r).date}</TableCell>
                          <TableCell>{parseRecord(r).hours}</TableCell>
                          <TableCell>
                            <span className={`review-status ${r.status}`}>
                              {r.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {!data.own.some((r) => r.kind === "hours") && (
                  <p className="empty">
                    Logged hours will appear here after your first event.
                  </p>
                )}
              </div>
              <aside className="submissions-card">
                <h2>Your contributions</h2>
                {data.own
                  .filter((r) => r.kind !== "hours")
                  .map((r) => (
                    <div className="submission" key={r.id}>
                      <strong>{r.name}</strong>
                      <span>
                        {r.kind}{" "}
                        <i className={`review-status ${r.status}`}>
                          {r.status}
                        </i>
                      </span>
                    </div>
                  ))}
                {!data.own.some((r) => r.kind !== "hours") && (
                  <p>
                    Suggest a planting site or start a community conversation.
                    Your contributions will appear here.
                  </p>
                )}
                <a
                  className="text-link"
                  href="/signout-with-chatgpt?return_to=%2F"
                  target="_top"
                >
                  Sign out
                </a>
              </aside>
            </div>
          </>
        )}
      </>
    );
  if (view === "Review center")
    return (
      <>
        {!staff ? (
          <div className="empty-state">
            <ShieldCheck />
            <h2>Community knowledge, carefully reviewed.</h2>
            <p>
              Certified arborists review planting sites and catalog
              contributions. Admins verify organizations, events, and volunteer
              hours.
            </p>
            <button
              className="primary-btn"
              onClick={() =>
                onForm(
                  "profile",
                  data.me ?? {
                    name: user?.name ?? "",
                    requested_role: "arborist",
                  },
                )
              }
            >
              Request verified access
            </button>
            <p className="source-note">
              Access is granted by an administrator after certification review.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="submissions">
            <TabsList variant="line">
              <TabsTrigger value="submissions">
                Review queue · {data.review.length}
              </TabsTrigger>
              {data.me.role === "admin" && (
                <TabsTrigger value="members">Manage members</TabsTrigger>
              )}
              <TabsTrigger value="content">Moderate content</TabsTrigger>
            </TabsList>
            <TabsContent value="submissions">
              {data.review
                .filter(
                  (r) =>
                    data.me.role === "admin" ||
                    ["site", "species", "guide", "question", "answer"].includes(
                      r.kind,
                    ),
                )
                .map((r) => (
                  <article className="review-card" key={r.id}>
                    <span className="event-type">{r.kind}</span>
                    <h2>{r.name}</h2>
                    <dl className="review-payload">
                      {Object.entries(parseRecord(r)).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>
                            {typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="review-buttons">
                      <button
                        className="primary-btn"
                        onClick={() =>
                          onAction({
                            action: "review",
                            id: r.id,
                            status: "approved",
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="outline-btn compact"
                        onClick={() =>
                          onAction({
                            action: "review",
                            id: r.id,
                            status: "rejected",
                          })
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))}
              {!data.review.length && (
                <div className="empty-state">
                  <Check />
                  <h2>All caught up.</h2>
                  <p>
                    New community contributions will appear here for review.
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="members">
              <div className="usage-strip">
                <span>{data.people.length} members</span>
                <span>{data.records.length} published contributions</span>
                <span>{data.review.length} pending reviews</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Certification / request</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.people.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.name}
                        <small className="table-email">{p.email}</small>
                      </TableCell>
                      <TableCell>
                        {p.certification || "—"}
                        <small className="table-email">
                          {p.requested_role
                            ? `Requested: ${p.requested_role}`
                            : ""}
                        </small>
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={p.id === data.me.id}
                          value={p.role}
                          onValueChange={(role) =>
                            onAction({ action: "role", id: p.id, role })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["general", "volunteer", "arborist", "admin"].map(
                              (role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="content">
              {data.records
                .filter(
                  (r) =>
                    data.me.role === "admin" ||
                    ["site", "species", "guide", "question", "answer"].includes(
                      r.kind,
                    ),
                )
                .map((r) => (
                  <article className="moderate-row" key={r.id}>
                    <div>
                      <span className="eyebrow">{r.kind}</span>
                      <h3>{r.name}</h3>
                    </div>
                    <button
                      className="text-link"
                      onClick={() =>
                        onAction({
                          action: "review",
                          id: r.id,
                          status: "rejected",
                        })
                      }
                    >
                      Unpublish
                    </button>
                  </article>
                ))}
            </TabsContent>
          </Tabs>
        )}
      </>
    );
  return null;
}
