"use client";
import { useState, useEffect, useCallback } from "react";
import WorkspaceViews, {
  blankCommunity,
  parseRecord,
  catalogData,
  type Community,
} from "./workspace-views";
import ContributionForm from "./contribution-form";
import { toast } from "sonner";
import { distance, type Site } from "@/lib/data";
import MapView from "./map-view";
import { Toaster } from "@/components/ui/sonner";
import {
  TreePine,
  Map,
  Leaf,
  HandHeart,
  MessageCircle,
  BookOpen,
  ArrowUpRight,
  Plus,
  Search,
  MapPin,
  SlidersHorizontal,
  ChevronRight,
  Sprout,
  LocateFixed,
  Sun,
  Droplets,
  Layers,
  Users,
  ShieldCheck,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { sites, species, matchTree } from "@/lib/data";
function MobileNavigation({ view }: { view: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => setOpenMobile(false), [view, setOpenMobile]);
  return null;
}
export default function Treefinder({
  user,
}: {
  user: { id: string; name: string; email: string } | null;
}) {
  const [view, setView] = useState("Explore map");
  const [selected, setSelected] = useState(sites[0]);
  const [priority, setPriority] = useState("All priorities");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Community>(blankCommunity);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ kind: string; initial: any } | null>(null);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/community");
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  async function action(payload: any) {
    try {
      const r = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success(
        payload.action === "register"
          ? "You are registered. Find this event in My activity."
          : payload.action === "cancel"
            ? "Registration cancelled."
            : payload.action === "vote"
              ? "Your favorite tree vote has been saved."
              : j.status === "pending"
                ? "Submitted. Your contribution is awaiting review."
                : "Saved to your community.",
      );
      await refresh();
      return j;
    } catch (e: any) {
      toast.error(e.message);
      return { ok: false };
    }
  }
  const allSites: Site[] = [
    ...sites,
    ...data.records
      .filter((r) => r.kind === "site")
      .map((r) => ({
        id: r.id,
        name: r.name,
        ...parseRecord(r),
        example: false,
      })),
  ];
  const filtered = allSites
    .filter(
      (s) =>
        (priority === "All priorities" || s.priority === priority) &&
        `${s.name} ${s.area}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      location
        ? distance(...location, a.lat, a.lng) -
          distance(...location, b.lat, b.lng)
        : 0,
    );
  const trees = catalogData(data);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: "explore_planting_site",
          description:
            "Select a planting site and display its conditions and tree matches.",
          inputSchema: {
            type: "object",
            properties: { siteId: { type: "string" } },
            required: ["siteId"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute(input: any) {
            const site = allSites.find((s) => s.id === input.siteId);
            if (!site) throw new Error("Unknown planting site");
            setSelected(site);
            setView("Explore map");
            return {
              siteId: site.id,
              name: site.name,
              recommendations: trees
                .map((t) => ({ name: t.name, score: matchTree(t, site).score }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 3),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [data.records]);
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "238px" } as React.CSSProperties}
    >
      <MobileNavigation view={view} />
      <Toaster position="bottom-right" />
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <a href="/" className="brand">
            <span>
              <TreePine size={25} />
            </span>
            treefinder<span className="brand-period">.</span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>DISCOVER</SidebarGroupLabel>
            <SidebarMenu>
              {[
                [Map, "Explore map"],
                [Leaf, "Tree catalog"],
                [HandHeart, "Volunteer"],
                [MessageCircle, "Community"],
                [BookOpen, "Care guides"],
              ].map(([Icon, label]: any) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    isActive={view === label}
                    onClick={() => setView(label)}
                    className="nav-item"
                  >
                    <Icon />
                    <span>{label}</span>
                    {view === label && <span className="nav-indicator" />}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>YOUR SPACE</SidebarGroupLabel>
            <SidebarMenu>
              {[
                [Users, "My activity"],
                [ShieldCheck, "Review center"],
              ].map(([Icon, label]: any) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    onClick={() => setView(label)}
                    isActive={view === label}
                    className="nav-item"
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <div className="sidebar-mission">
            <div className="mission-icon">
              <Sprout />
            </div>
            <h3>
              A little care.
              <br />A lasting impact.
            </h3>
            <p>Find your next opportunity to grow a greener neighborhood.</p>
            <button onClick={() => setView("Volunteer")}>
              Get involved <ArrowUpRight size={16} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button
            className="profile-button"
            onClick={() => setView("My activity")}
          >
            <span className="avatar">
              {user ? user.name[0].toUpperCase() : "TF"}
            </span>
            <span>
              <strong>
                {user
                  ? (data.me?.name ?? user.name).split("@")[0]
                  : "Your Treefinder"}
              </strong>
              <small>
                {user
                  ? data.me?.role === "admin"
                    ? "Administrator"
                    : data.me?.role === "arborist"
                      ? "Certified arborist"
                      : "Community member"
                  : "Join the community"}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="mobile-toggle">
            <SidebarTrigger />
          </div>
          <span className="breadcrumb">
            Discover <ChevronRight size={14} /> <strong>{view}</strong>
          </span>
          <div className="top-actions">
            <span className="location-label">
              <MapPin size={16} /> New York City, NY
            </span>
            {user ? (
              <span className="mini-avatar">{user.name[0].toUpperCase()}</span>
            ) : (
              <a
                href="/signin-with-chatgpt?return_to=%2F"
                target="_top"
                className="text-button"
              >
                Sign in <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> GROW A GREENER CITY
              </div>
              <h1>
                {view === "Explore map"
                  ? "Find a place to make a difference."
                  : view === "Tree catalog"
                    ? "Meet your next neighborhood tree."
                    : view === "Volunteer"
                      ? "Your time can help a tree take root."
                      : view === "Community"
                        ? "Good questions. Greener neighborhoods."
                        : view === "My activity"
                          ? "Your roots in the community."
                          : view === "Care guides"
                            ? "A little knowledge goes a long way."
                            : "Keep our community growing well."}
              </h1>
              <p>
                {view === "Explore map"
                  ? "Discover where trees are needed. Find the right tree. Help it take root."
                  : view === "Tree catalog"
                    ? "Explore native species, growing conditions, and the life each tree supports."
                    : view === "Volunteer"
                      ? "Find local events and organizations. Put your knowledge into action."
                      : view === "Community"
                        ? "Learn from neighbors and certified arborists. Share what you know."
                        : view === "My activity"
                          ? "Manage your profile, contributions, and volunteer participation."
                          : view === "Care guides"
                            ? "Practical guidance for planting and caring for the trees around you."
                            : "Review contributions, verify information, and support trusted stewardship."}
              </p>
            </div>
            <button
              className="primary-btn"
              onClick={() =>
                setForm({
                  kind: "site",
                  initial: {
                    lat: selected.lat,
                    lng: selected.lng,
                    zone: selected.zone,
                    space: 35,
                  },
                })
              }
            >
              <Plus size={17} /> Suggest a planting site
            </button>
          </div>
          {error && (
            <div className="storage-error">
              <span>{error}</span>
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          {view === "Explore map" ? (
            <>
              <div className="stats-strip">
                <div>
                  <span className="stat-icon amber">
                    <MapPin />
                  </span>
                  <div>
                    <strong>
                      {allSites.length} <small>planting areas</small>
                    </strong>
                    <p>Explore neighborhood opportunities</p>
                  </div>
                </div>
                <div>
                  <span className="stat-icon green">
                    <Leaf />
                  </span>
                  <div>
                    <strong>
                      {trees.length} <small>tree species</small>
                    </strong>
                    <p>The right tree for the right place</p>
                  </div>
                </div>
                <div>
                  <span className="stat-icon purple">
                    <HandHeart />
                  </span>
                  <div>
                    <strong>
                      3 <small>community events</small>
                    </strong>
                    <p>Put down roots, together</p>
                  </div>
                </div>
                <span className="sample-tag">Preview data</span>
              </div>
              <section className="explore-grid">
                <div className="map-column">
                  <div className="map-toolbar">
                    <label className="search-box">
                      <Search size={18} />
                      <input
                        aria-label="Search neighborhoods"
                        placeholder="Search a neighborhood or planting site"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="filter-select">
                        <SlidersHorizontal size={16} />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["All priorities", "High", "Medium", "Low"].map(
                          (p) => (
                            <SelectItem value={p} key={p}>
                              {p}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <MapView
                    sites={filtered}
                    selected={selected}
                    onSelect={setSelected}
                    onLocation={(lat, lng) => setLocation([lat, lng])}
                  />
                  <div className="area-list-head">
                    <h2>
                      Planting areas nearby <span>{filtered.length}</span>
                    </h2>
                    <span>
                      {location
                        ? "Sorted by distance from you"
                        : "Example & community sites"}{" "}
                      · assessment required
                    </span>
                  </div>
                  <div className="area-list">
                    {filtered.map((s) => (
                      <button
                        key={s.id}
                        className={`area-card ${selected.id === s.id ? "selected" : ""}`}
                        onClick={() => setSelected(s)}
                      >
                        <span
                          className={`area-pin ${s.priority.toLowerCase()}`}
                        >
                          <MapPin size={21} />
                        </span>
                        <div>
                          <h3>{s.name}</h3>
                          <p>{s.area}</p>
                        </div>
                        <span
                          className={`priority-badge ${s.priority.toLowerCase()}`}
                        >
                          {s.priority} priority
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                    {!filtered.length && (
                      <p className="empty">
                        No areas match your search. Try another neighborhood.
                      </p>
                    )}
                  </div>
                </div>
                <aside className="site-panel">
                  <div className="panel-top">
                    <span className="eyebrow">PLANTING SITE INSIGHTS</span>
                    <span
                      className={`priority-badge ${selected.priority.toLowerCase()}`}
                    >
                      {selected.priority} priority
                    </span>
                  </div>
                  <h2>{selected.name}</h2>
                  <p className="site-address">
                    <MapPin size={14} />
                    {selected.area}
                  </p>
                  <div className="canopy-box">
                    <div>
                      <span>
                        {selected.example
                          ? "Illustrative canopy coverage"
                          : "Canopy coverage"}
                      </span>
                      <strong>
                        {selected.example ? selected.canopy : "—"}
                        <small>{selected.example ? "%" : ""}</small>
                      </strong>
                    </div>
                    <div className="canopy-track">
                      <i style={{ width: `${selected.canopy}%` }} />
                    </div>
                    <p>
                      {selected.example
                        ? "Example conditions, pending a local site assessment."
                        : "Community-reported conditions; canopy has not been measured."}
                    </p>
                  </div>
                  <h3 className="section-label">Know the growing conditions</h3>
                  <div className="condition-grid">
                    <div>
                      <Sprout />
                      <span>Soil type</span>
                      <strong>{selected.soil}</strong>
                    </div>
                    <div>
                      <Sun />
                      <span>Sunlight</span>
                      <strong>{selected.sun}</strong>
                    </div>
                    <div>
                      <Droplets />
                      <span>Water</span>
                      <strong>{selected.water}</strong>
                    </div>
                    <div>
                      <TreePine />
                      <span>Canopy space</span>
                      <strong>{selected.space} ft</strong>
                    </div>
                  </div>
                  <div className="zone-line">
                    <span>USDA hardiness zone</span>
                    <strong>
                      {selected.zone}{" "}
                      <small>
                        ({selected.example ? "example" : "reported"})
                      </small>
                    </strong>
                  </div>
                  <div className="recommend-head">
                    <h3>Right trees for this place</h3>
                    <Leaf size={17} />
                  </div>
                  <p className="recommend-desc">
                    Matched to sunlight, soil, space, water and zone.
                  </p>
                  {[...trees]
                    .sort(
                      (a, b) =>
                        matchTree(b, selected).score -
                        matchTree(a, selected).score,
                    )
                    .slice(0, 3)
                    .map((t) => (
                      <button
                        className="tree-match"
                        key={t.id}
                        onClick={() => setView("Tree catalog")}
                      >
                        <span className="tree-icon">
                          <TreePine />
                        </span>
                        <div>
                          <strong>{t.name}</strong>
                          <em>{t.latin}</em>
                        </div>
                        <span>
                          {matchTree(t, selected).score}%<small>match</small>
                        </span>
                      </button>
                    ))}
                  <button
                    className="outline-btn"
                    onClick={() => setView("Tree catalog")}
                  >
                    Explore the tree catalog <ArrowUpRight size={15} />
                  </button>
                  <div className="site-note">
                    <ShieldCheck size={17} />
                    <p>
                      Recommendations guide exploration. An arborist should
                      verify conditions before planting.
                    </p>
                  </div>
                </aside>
              </section>
            </>
          ) : (
            <WorkspaceViews
              view={view}
              data={data}
              site={selected}
              user={user}
              onAction={action}
              onForm={(kind, initial = {}) => setForm({ kind, initial })}
            />
          )}
          <ContributionForm
            kind={form?.kind ?? null}
            initial={form?.initial}
            user={user}
            onClose={() => setForm(null)}
            onSave={action}
          />
        </main>
        <footer>
          <span>
            <TreePine size={14} /> Better places. One tree at a time.
          </span>
          <span>
            Map © OpenStreetMap contributors{" "}
            <span className="footer-divider">|</span> Treefinder community
          </span>
        </footer>
      </div>
    </SidebarProvider>
  );
}
