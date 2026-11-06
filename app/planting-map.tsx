"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, LeafletMouseEvent, Map as LeafletMap, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { canopyColor, canopyGradient } from "@/lib/canopy";
import { apiFetch, useAuth } from "./auth-client";

type Status = "Proposed" | "Approved" | "Planted";
type Site = {
  SiteID: number; Name: string; Latitude: number; Longitude: number; CanopyCoverPct: number; ImperviousPct: number;
  SurfaceTempF: number; TreesNeeded: number; Status: Status; SubmittedDate: string; SubmittedBy: string | null; NeedScore: number;
  recommendations: { SpeciesID: number; CommonName: string; Quantity: number }[];
};
type Volunteer = { RegistrationID: number; UserID: number; Name: string; Status: string };
type VolunteerEvent = {
  OpportunityID: number; Title: string; EventDate: string; Location: string; Latitude: number; Longitude: number; Upcoming: boolean;
  OrgID: number; Organization: string; SiteID: number | null; SiteName: string | null; CreatedBy: string | null; SignUps: number;
  volunteers: Volunteer[];
};
type MapData = { sites: Site[]; events: VolunteerEvent[] };
type Membership = { OrgID: number; Organization: string; OrgRole: string };
type Match = { Kind: "event" | "site"; ID: number; Field: string; Value: string };
type Selection = { kind: "event" | "site"; id: number } | null;
type Point = { lat: number; lng: number };
type CanopyReading = { canopy: number | null; landCover: string | null; developed: boolean; error?: string };
type Draft = { OrgID: string; Title: string; EventDate: string; Location: string };

const CENTER: [number, number] = [37.2296, -80.4139];
const STATUSES: Status[] = ["Proposed", "Approved", "Planted"];
const EVENT_FILTERS = ["Upcoming", "Past", "All"] as const;
const SITE_RADIUS_METERS = 300;
const NEED_COLORS = { high: "#b8432f", medium: "#d98a2b", low: "#9a9440", planted: "#2f6b3d" };
const SCHEDULER_ROLES = ["Coordinator", "Officer", "Director"];
const emptyData: MapData = { sites: [], events: [] };
const emptyDraft: Draft = { OrgID: "", Title: "Tree planting", EventDate: "", Location: "" };

function needLevel(site: Pick<Site, "Status" | "NeedScore">) {
  if (site.Status === "Planted") return "planted";
  return site.NeedScore >= 70 ? "high" : site.NeedScore >= 50 ? "medium" : "low";
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const today = () => new Date().toLocaleDateString("en-CA");
const formatDate = (date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-US", options);
const pointKey = (point: Point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
function metersBetween(a: Point, b: Point) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export default function PlantingMap({ onChange }: { onChange?: () => void }) {
  const { user, hasRole, promptLogin } = useAuth();
  const [myOrgs, setMyOrgs] = useState<Membership[] | null>(null);
  const [data, setData] = useState<MapData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"events" | "sites">("events");
  const [eventFilter, setEventFilter] = useState<(typeof EVENT_FILTERS)[number]>("Upcoming");
  const [siteFilter, setSiteFilter] = useState<Status | "All">("All");
  const [selection, setSelection] = useState<Selection>(null);
  const [scheduling, setScheduling] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [readings, setReadings] = useState<Record<string, CanopyReading>>({});
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Map<string, Match[]> | null>(null);
  const [searching, setSearching] = useState(false);
  const [layers, setLayers] = useState({ canopy: true, sites: true, events: true });

  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const canopyLayer = useRef<TileLayer | null>(null);
  const siteLayer = useRef<LayerGroup | null>(null);
  const eventLayer = useRef<LayerGroup | null>(null);
  const draftLayer = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const schedulingRef = useRef(scheduling);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sites");
      const result = (await response.json()) as MapData & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Database unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Leaflet touches `window`, so it is loaded only in the browser.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !host.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(host.current, { zoomControl: true }).setView(CENTER, 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current);
      canopyLayer.current = L.tileLayer("/api/canopy/tiles/{z}/{x}/{y}", {
        maxZoom: 19, maxNativeZoom: 15, opacity: 0.6,
        attribution: 'Tree canopy &amp; land cover: <a href="https://www.mrlc.gov/">NLCD 2021</a>',
      }).addTo(map.current);
      siteLayer.current = L.layerGroup().addTo(map.current);
      eventLayer.current = L.layerGroup().addTo(map.current);
      draftLayer.current = L.layerGroup().addTo(map.current);
      map.current.on("click", (event: LeafletMouseEvent) => {
        if (schedulingRef.current) setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    schedulingRef.current = scheduling;
    host.current?.classList.toggle("placing", scheduling);
  }, [scheduling]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const pairs = [[canopyLayer.current, layers.canopy], [siteLayer.current, layers.sites], [eventLayer.current, layers.events]] as const;
    for (const [layer, on] of pairs) {
      if (!layer) continue;
      if (on) layer.addTo(map.current);
      else layer.remove();
    }
  }, [mapReady, layers]);

  // Search runs in MySQL; lists and markers only show what the query matched.
  useEffect(() => {
    const text = query.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!text) { setMatches(null); return; }
      setSearching(true);
      try {
        const response = await fetch(`/api/sites?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const result = (await response.json()) as { matches?: Match[]; error?: string };
        if (!response.ok) throw new Error(result.error);
        const grouped = new Map<string, Match[]>();
        for (const match of result.matches ?? []) {
          const key = `${match.Kind}:${match.ID}`;
          grouped.set(key, [...(grouped.get(key) ?? []), match]);
        }
        setMatches(grouped);
      } catch (cause) {
        if (!controller.signal.aborted) setMessage(cause instanceof Error ? cause.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, data]);

  // Real canopy % at the chosen spot, from the National Land Cover Database.
  const activePoint = scheduling ? point : null;
  const selectedEvent = selection?.kind === "event" ? data.events.find((event) => event.OpportunityID === selection.id) ?? null : null;
  const selectedSite = selection?.kind === "site" ? data.sites.find((site) => site.SiteID === selection.id) ?? null : null;
  const readingPoint = activePoint ?? (selectedEvent ? { lat: selectedEvent.Latitude, lng: selectedEvent.Longitude } : null);
  const readingKey = readingPoint ? pointKey(readingPoint) : null;
  useEffect(() => {
    if (!readingKey || readings[readingKey]) return;
    const [lat, lng] = readingKey.split(",");
    const controller = new AbortController();
    fetch(`/api/canopy?lat=${lat}&lng=${lng}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as CanopyReading & { error?: string };
        setReadings((current) => ({ ...current, [readingKey]: response.ok ? result : { canopy: null, landCover: null, developed: false, error: result.error } }));
      })
      .catch(() => {
        if (!controller.signal.aborted) setReadings((current) => ({ ...current, [readingKey]: { canopy: null, landCover: null, developed: false, error: "Tree canopy data is unavailable right now." } }));
      });
    return () => controller.abort();
  }, [readingKey, readings]);
  const reading = readingKey ? readings[readingKey] ?? null : null;

  const matchesFor = (kind: "event" | "site", id: number) => matches?.get(`${kind}:${id}`);
  const visibleEvents = useMemo(() => data.events.filter((event) =>
    (eventFilter === "All" || event.Upcoming === (eventFilter === "Upcoming")) && (!matches || matches.has(`event:${event.OpportunityID}`))),
  [data.events, eventFilter, matches]);
  const visibleSites = useMemo(() => data.sites.filter((site) =>
    (siteFilter === "All" || site.Status === siteFilter) && (!matches || matches.has(`site:${site.SiteID}`))),
  [data.sites, siteFilter, matches]);
  const nearestSite = useMemo(() => {
    if (!point) return null;
    const ranked = data.sites.map((site) => ({ site, meters: metersBetween(point, { lat: site.Latitude, lng: site.Longitude }) })).sort((a, b) => a.meters - b.meters);
    return ranked[0] && ranked[0].meters <= SITE_RADIUS_METERS ? ranked[0].site : null;
  }, [point, data.sites]);

  useEffect(() => {
    const L = leaflet.current;
    if (!mapReady || !L || !siteLayer.current) return;
    siteLayer.current.clearLayers();
    for (const site of visibleSites) {
      const color = NEED_COLORS[needLevel(site)];
      const selected = selection?.kind === "site" && selection.id === site.SiteID;
      L.circle([site.Latitude, site.Longitude], {
        radius: 160, color, weight: selected ? 4 : 2, dashArray: selected ? undefined : "6 4", fillColor: color, fillOpacity: selected ? 0.25 : 0.12,
      })
        .bindTooltip(`<strong>${escapeHtml(site.Name)}</strong><br>Planting area · need ${site.NeedScore} · ${site.Status}`, { direction: "top" })
        .on("click", () => { if (!schedulingRef.current) { setSelection({ kind: "site", id: site.SiteID }); setTab("sites"); } })
        .addTo(siteLayer.current);
    }
  }, [mapReady, visibleSites, selection]);

  useEffect(() => {
    const L = leaflet.current;
    if (!mapReady || !L || !eventLayer.current) return;
    eventLayer.current.clearLayers();
    for (const event of visibleEvents) {
      const selected = selection?.kind === "event" && selection.id === event.OpportunityID;
      L.marker([event.Latitude, event.Longitude], {
        icon: L.divIcon({ className: "", html: `<span class="event-pin${event.Upcoming ? "" : " past"}${selected ? " selected" : ""}"></span>`, iconSize: [26, 26], iconAnchor: [13, 26] }),
        zIndexOffset: selected ? 1000 : 0,
      })
        .bindTooltip(`<strong>${escapeHtml(event.Title)}</strong><br>${formatDate(event.EventDate)} · ${event.SignUps} signed up`, { direction: "top", offset: [0, -24] })
        .on("click", () => { if (!schedulingRef.current) { setSelection({ kind: "event", id: event.OpportunityID }); setTab("events"); } })
        .addTo(eventLayer.current);
    }
  }, [mapReady, visibleEvents, selection]);

  useEffect(() => {
    const L = leaflet.current;
    if (!mapReady || !L || !draftLayer.current) return;
    draftLayer.current.clearLayers();
    if (activePoint) {
      L.marker([activePoint.lat, activePoint.lng], {
        icon: L.divIcon({ className: "", html: '<span class="event-pin draft"></span>', iconSize: [26, 26], iconAnchor: [13, 26] }),
      }).bindTooltip("New event", { permanent: true, direction: "top", offset: [0, -24] }).addTo(draftLayer.current);
    }
  }, [mapReady, activePoint]);

  useEffect(() => {
    const L = leaflet.current;
    if (!matches || !matches.size || !L || !map.current) return;
    const points: [number, number][] = [
      ...data.events.filter((event) => matches.has(`event:${event.OpportunityID}`)).map((event) => [event.Latitude, event.Longitude] as [number, number]),
      ...data.sites.filter((site) => matches.has(`site:${site.SiteID}`)).map((site) => [site.Latitude, site.Longitude] as [number, number]),
    ];
    if (points.length) map.current.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
  }, [matches, data]);

  const focus = selectedEvent ? [selectedEvent.Latitude, selectedEvent.Longitude] : selectedSite ? [selectedSite.Latitude, selectedSite.Longitude] : null;
  const focusKey = focus?.join(",");
  useEffect(() => {
    if (!focusKey || !map.current) return;
    const [lat, lng] = focusKey.split(",").map(Number);
    map.current.flyTo([lat, lng], Math.max(map.current.getZoom(), 15), { duration: 0.6 });
  }, [focusKey]);

  async function send(url: string, method: "POST" | "PATCH" | "DELETE", body: object, success: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch(url, { method, body: JSON.stringify(body) });
      const result = (await response.json()) as { error?: string; id?: number; snapshot: MapData };
      if (!response.ok) throw new Error(result.error);
      setData(result.snapshot);
      setMessage(success);
      onChange?.();
      return result;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // Scheduling acts as the logged-in user, using the organizations they coordinate.
  function startScheduling(at?: Site) {
    if (!user) { promptLogin(); return; }
    setMyOrgs(null);
    apiFetch("/api/auth/me")
      .then(async (response) => {
        const result = (await response.json()) as { memberships?: Membership[] };
        const orgs = (result.memberships ?? []).filter((m) => SCHEDULER_ROLES.includes(m.OrgRole));
        setMyOrgs(orgs);
        if (orgs.length === 1) setDraft((current) => ({ ...current, OrgID: String(orgs[0].OrgID) }));
      })
      .catch(() => setMyOrgs([]));
    setScheduling(true);
    setSelection(null);
    setMessage("");
    setPoint(at ? { lat: at.Latitude, lng: at.Longitude } : null);
    setDraft({ ...emptyDraft, EventDate: today(), Location: at?.Name ?? "" });
  }

  // Leave scheduling mode if the user logs out mid-way.
  if (scheduling && !user) {
    setScheduling(false);
    setPoint(null);
  }

  function stopScheduling() {
    setScheduling(false);
    setPoint(null);
    setDraft(emptyDraft);
  }

  async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!point) return;
    const result = await send("/api/events", "POST", { ...draft, Latitude: point.lat, Longitude: point.lng }, `"${draft.Title.trim()}" scheduled for ${formatDate(draft.EventDate)}.`);
    if (result?.id) {
      stopScheduling();
      setTab("events");
      setEventFilter("Upcoming");
      setQuery("");
      setSelection({ kind: "event", id: result.id });
    }
  }

  const upcomingCount = data.events.filter((event) => event.Upcoming).length;
  const searchActive = Boolean(query.trim());

  return (
    <div className="map-layout">
      <div className="map-stage">
        <div className="map-canvas" ref={host} />
        {scheduling && !point && <p className="map-hint">Click the map where the event will happen</p>}
        <div className="map-legend" aria-label="Legend">
          <strong>Where trees are needed</strong>
          <div className="canopy-scale" style={{ background: canopyGradient }} />
          <div className="canopy-labels"><span>0% canopy</span><span>30%</span><span>60%+</span></div>
          <p className="legend-scope"><strong>Developed land only</strong> (cities, towns, neighborhoods). Forests, farmland, deserts, and water aren&apos;t shaded.</p>
          <small>Tree canopy data: NLCD 2021</small>
          <label><input type="checkbox" checked={layers.canopy} onChange={(e) => setLayers({ ...layers, canopy: e.target.checked })} />Canopy color scale</label>
          <label><input type="checkbox" checked={layers.sites} onChange={(e) => setLayers({ ...layers, sites: e.target.checked })} /><i className="legend-ring" />Planting areas</label>
          <label><input type="checkbox" checked={layers.events} onChange={(e) => setLayers({ ...layers, events: e.target.checked })} /><i className="legend-pin" />Volunteer events</label>
        </div>
      </div>

      <aside className="map-panel">
        {message && <p className="notice">{message}</p>}
        {error && <div className="error"><span>{error}</span><button onClick={load}>Try again</button></div>}

        {scheduling ? (
          <ScheduleForm orgs={myOrgs} draft={draft} setDraft={setDraft} point={point} reading={reading} nearestSite={nearestSite}
            saving={saving} onCancel={stopScheduling} onSubmit={saveEvent} />
        ) : selectedEvent ? (
          <EventDetail event={selectedEvent} userId={user?.UserID ?? null} reading={reading} saving={saving}
            onBack={() => setSelection(null)}
            onSite={(id) => { setSelection({ kind: "site", id }); setTab("sites"); }}
            onLogin={() => promptLogin()}
            onSignUp={() => send("/api/registrations", "POST", { OpportunityID: selectedEvent.OpportunityID }, `You're signed up for ${selectedEvent.Title}.`)}
            onCancel={() => send("/api/registrations", "DELETE", { OpportunityID: selectedEvent.OpportunityID }, `Your sign-up for ${selectedEvent.Title} was cancelled.`)} />
        ) : selectedSite ? (
          <SiteDetail site={selectedSite} events={data.events.filter((event) => event.SiteID === selectedSite.SiteID)} saving={saving}
            canReview={hasRole("Admin", "Arborist")}
            onBack={() => setSelection(null)}
            onEvent={(id) => { setSelection({ kind: "event", id }); setTab("events"); }}
            onSchedule={() => startScheduling(selectedSite)}
            onStatus={(status) => send("/api/sites", "PATCH", { id: selectedSite.SiteID, Status: status }, `${selectedSite.Name} marked ${status}.`)} />
        ) : (
          <>
            <div className="panel-tabs" role="tablist">
              <button role="tab" aria-selected={tab === "events"} className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>
                Volunteer events <span>{searchActive ? visibleEvents.length : upcomingCount}</span>
              </button>
              <button role="tab" aria-selected={tab === "sites"} className={tab === "sites" ? "active" : ""} onClick={() => setTab("sites")}>
                Planting areas <span>{searchActive ? visibleSites.length : data.sites.length}</span>
              </button>
            </div>
            <div className="site-search">
              <input type="search" aria-label="Search events and planting areas" placeholder="Search events, organizations, volunteers, areas..." value={query}
                onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQuery("")} />
              {searchActive && <span>{searching ? "Searching..." : `${visibleEvents.length} events · ${visibleSites.length} planting areas match`}</span>}
            </div>

            {tab === "events" ? (
              <>
                <div className="panel-actions">
                  <div className="status-filter" role="group" aria-label="Filter events">
                    {EVENT_FILTERS.map((filter) => <button key={filter} className={eventFilter === filter ? "active" : ""} onClick={() => setEventFilter(filter)}>{filter}</button>)}
                  </div>
                  <button className="primary-button" onClick={() => startScheduling()}>+ Schedule event</button>
                </div>
                {loading ? <p className="state">Loading events...</p> : (
                  <ol className="site-list">
                    {visibleEvents.map((event) => (
                      <li key={event.OpportunityID}>
                        <button onClick={() => setSelection({ kind: "event", id: event.OpportunityID })}>
                          <span className={`date-badge${event.Upcoming ? "" : " past"}`}>
                            <small>{formatDate(event.EventDate, { month: "short" })}</small>{formatDate(event.EventDate, { day: "numeric" })}
                          </span>
                          <span className="site-name"><strong>{event.Title}</strong><small>{event.Organization} · {event.Location}</small>
                            <MatchReason matches={matchesFor("event", event.OpportunityID)} /></span>
                          <span className="signup-count">{event.SignUps}<small>signed up</small></span>
                        </button>
                      </li>
                    ))}
                    {!visibleEvents.length && <li className="state">{searchActive ? "No events match your search." : `No ${eventFilter.toLowerCase()} events on the map.`}</li>}
                  </ol>
                )}
              </>
            ) : (
              <>
                <div className="panel-actions">
                  <div className="status-filter" role="group" aria-label="Filter planting areas">
                    {(["All", ...STATUSES] as const).map((status) => <button key={status} className={siteFilter === status ? "active" : ""} onClick={() => setSiteFilter(status)}>{status}</button>)}
                  </div>
                </div>
                {loading ? <p className="state">Loading planting areas...</p> : (
                  <ol className="site-list">
                    {visibleSites.map((site) => (
                      <li key={site.SiteID}>
                        <button onClick={() => setSelection({ kind: "site", id: site.SiteID })}>
                          <span className="site-score" style={{ background: NEED_COLORS[needLevel(site)] }}>{site.NeedScore}</span>
                          <span className="site-name"><strong>{site.Name}</strong><small>{site.TreesNeeded} trees · {site.CanopyCoverPct}% canopy</small>
                            <MatchReason matches={matchesFor("site", site.SiteID)} /></span>
                          <span className={`status-tag ${site.Status.toLowerCase()}`}>{site.Status}</span>
                        </button>
                      </li>
                    ))}
                    {!visibleSites.length && <li className="state">{searchActive ? "No planting areas match your search." : "No planting areas with this status."}</li>}
                  </ol>
                )}
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function MatchReason({ matches }: { matches?: Match[] }) {
  return matches ? <small className="match-reason">{matches.map((match) => `${match.Field}: ${match.Value}`).join(" · ")}</small> : null;
}

function CanopyNote({ reading }: { reading: CanopyReading | null }) {
  if (!reading) return <p className="canopy-note">Checking tree canopy here...</p>;
  if (reading.error) return <p className="canopy-note">{reading.error}</p>;
  if (reading.canopy === null) return <p className="canopy-note">No tree canopy data here (outside the lower 48 states).</p>;
  const [r, g, b] = canopyColor(reading.canopy);
  return (
    <p className="canopy-note">
      <i style={{ background: `rgb(${r} ${g} ${b})` }} />
      <span><strong>{reading.canopy}% tree canopy</strong> · {reading.landCover}
        {!reading.developed && <small>Not developed land, so it isn&apos;t shaded on the map. Most community planting happens along streets, in neighborhoods, and in parks.</small>}
      </span>
    </p>
  );
}

function ScheduleForm({ orgs, draft, setDraft, point, reading, nearestSite, saving, onCancel, onSubmit }: {
  orgs: Membership[] | null; draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>; point: Point | null; reading: CanopyReading | null;
  nearestSite: Site | null; saving: boolean; onCancel: () => void; onSubmit: (event: React.FormEvent) => void;
}) {
  const set = (name: keyof Draft, value: string) => setDraft((current) => ({ ...current, [name]: value }));

  return (
    <form className="record-form site-form" onSubmit={onSubmit}>
      <div className="panel-head">
        <h2>Schedule a volunteer event</h2>
        <span>{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · click the map to move it` : "Click the map where the event will happen"}</span>
      </div>
      {point && <CanopyNote reading={reading} />}
      {point && nearestSite && <p className="site-meta">Inside planting area <strong>{nearestSite.Name}</strong> (need {nearestSite.NeedScore}). The event will be linked to it.</p>}
      {orgs === null ? <p className="state">Checking your organizations...</p> : !orgs.length ? (
        <p className="error">You need to be a Coordinator, Officer, or Director of an organization to schedule its events. Ask an organization admin to update your role.</p>
      ) : (
        <label><span>Organization</span><select required value={draft.OrgID} onChange={(e) => set("OrgID", e.target.value)}>
          <option value="">Choose one of your organizations</option>
          {orgs.map((org) => <option key={org.OrgID} value={org.OrgID}>{org.Organization} ({org.OrgRole})</option>)}
        </select></label>
      )}
      <label><span>Event title</span><input required maxLength={150} value={draft.Title} onChange={(e) => set("Title", e.target.value)} /></label>
      <div className="field-pair">
        <label><span>Date</span><input required type="date" min={today()} value={draft.EventDate} onChange={(e) => set("EventDate", e.target.value)} /></label>
        <label><span>Meeting spot</span><input required maxLength={150} value={draft.Location} onChange={(e) => set("Location", e.target.value)} placeholder="e.g. Corner of Main & Roanoke" /></label>
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="primary-button" disabled={saving || !point || !orgs?.length}>{saving ? "Saving..." : "Schedule event"}</button>
      </div>
    </form>
  );
}

function EventDetail({ event, userId, reading, saving, onBack, onSite, onLogin, onSignUp, onCancel }: {
  event: VolunteerEvent; userId: number | null; reading: CanopyReading | null; saving: boolean;
  onBack: () => void; onSite: (id: number) => void; onLogin: () => void; onSignUp: () => void; onCancel: () => void;
}) {
  const mine = event.volunteers.find((volunteer) => volunteer.UserID === userId && volunteer.Status !== "Cancelled");
  return (
    <div className="site-detail">
      <button className="back-link" onClick={onBack}>‹ Volunteer events</button>
      <div className="panel-head">
        <h2>{event.Title}</h2>
        <span className={`status-tag ${event.Upcoming ? "approved" : "past"}`}>{event.Upcoming ? "Upcoming" : "Past"}</span>
      </div>
      <dl className="detail-list">
        <div><dt>Date</dt><dd>{formatDate(event.EventDate)}</dd></div>
        <div><dt>Organization</dt><dd>{event.Organization}</dd></div>
        <div><dt>Meeting spot</dt><dd>{event.Location}</dd></div>
        <div><dt>Scheduled by</dt><dd>{event.CreatedBy ?? "—"}</dd></div>
        {event.SiteID && <div><dt>Planting area</dt><dd><button className="text-link" onClick={() => onSite(event.SiteID!)}>{event.SiteName}</button></dd></div>}
      </dl>
      <CanopyNote reading={reading} />

      <h3>Volunteers ({event.SignUps})</h3>
      {event.volunteers.length ? (
        <ul className="plain-list">{event.volunteers.map((volunteer) => (
          <li key={volunteer.RegistrationID} className={volunteer.Status === "Cancelled" ? "cancelled" : ""}>
            <span>{volunteer.Name}{volunteer.UserID === userId && <em className="you-tag">You</em>}</span><span>{volunteer.Status}</span>
          </li>
        ))}</ul>
      ) : <p className="site-meta">Nobody has signed up yet.</p>}

      {event.Upcoming && (
        <div className="signup-form">
          {userId === null ? <button className="primary-button" onClick={onLogin}>Log in to sign up</button>
            : mine ? <><span className="site-meta">You&apos;re signed up ({mine.Status}).</span><button disabled={saving} onClick={onCancel}>Cancel my sign-up</button></>
            : <button className="primary-button" disabled={saving} onClick={onSignUp}>{saving ? "Saving..." : "Sign me up"}</button>}
        </div>
      )}
    </div>
  );
}

function SiteDetail({ site, events, saving, canReview, onBack, onEvent, onSchedule, onStatus }: {
  site: Site; events: VolunteerEvent[]; saving: boolean; canReview: boolean;
  onBack: () => void; onEvent: (id: number) => void; onSchedule: () => void; onStatus: (status: Status) => void;
}) {
  const next: Partial<Record<Status, { status: Status; label: string }>> = {
    Proposed: { status: "Approved", label: "Approve area" },
    Approved: { status: "Planted", label: "Mark as planted" },
  };
  const color = NEED_COLORS[needLevel(site)];
  return (
    <div className="site-detail">
      <button className="back-link" onClick={onBack}>‹ Planting areas</button>
      <div className="panel-head">
        <h2>{site.Name}</h2>
        <span className={`status-tag ${site.Status.toLowerCase()}`}>{site.Status}</span>
      </div>
      <div className="need-meter">
        <strong style={{ color }}>{site.NeedScore}</strong>
        <div><span>Need score out of 100</span><div className="meter"><i style={{ width: `${site.NeedScore}%`, background: color }} /></div></div>
      </div>
      <dl className="site-stats">
        <div><dt>Tree canopy</dt><dd>{site.CanopyCoverPct}%</dd></div>
        <div><dt>Paved surface</dt><dd>{site.ImperviousPct}%</dd></div>
        <div><dt>Summer surface</dt><dd>{site.SurfaceTempF}°F</dd></div>
        <div><dt>Trees needed</dt><dd>{site.TreesNeeded}</dd></div>
      </dl>
      <p className="site-meta">Submitted by {site.SubmittedBy ?? "a deleted user"} on {site.SubmittedDate}</p>

      <h3>Recommended trees</h3>
      {site.recommendations.length ? (
        <ul className="plain-list">{site.recommendations.map((rec) => <li key={rec.SpeciesID}><span>{rec.CommonName}</span><span>{rec.Quantity}</span></li>)}</ul>
      ) : <p className="site-meta">No species chosen yet.</p>}

      <h3>Volunteer events here</h3>
      {events.length ? (
        <ul className="plain-list">{events.map((event) => (
          <li key={event.OpportunityID}>
            <button className="text-link" onClick={() => onEvent(event.OpportunityID)}>{event.Title}<small>{formatDate(event.EventDate)}</small></button>
            <span>{event.SignUps} signed up</span>
          </li>
        ))}</ul>
      ) : <p className="site-meta">No events scheduled yet.</p>}

      <div className="modal-actions">
        <button className="primary-button" onClick={onSchedule}>+ Schedule event here</button>
      </div>
      {canReview && <div className="modal-actions status-actions">
        {site.Status !== "Proposed" && <button disabled={saving} onClick={() => onStatus("Proposed")}>Reset to proposed</button>}
        {next[site.Status] && <button disabled={saving} onClick={() => onStatus(next[site.Status]!.status)}>{saving ? "Saving..." : next[site.Status]!.label}</button>}
      </div>}
    </div>
  );
}
