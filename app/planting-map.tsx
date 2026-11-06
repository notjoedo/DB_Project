"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CircleMarker, LayerGroup, LeafletMouseEvent, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

type Status = "Proposed" | "Approved" | "Planted";
type Site = {
  SiteID: number; Name: string; Latitude: number; Longitude: number; CanopyCoverPct: number; ImperviousPct: number;
  SurfaceTempF: number; TreesNeeded: number; Status: Status; SubmittedDate: string; SubmittedBy: string | null; NeedScore: number;
  recommendations: { SpeciesID: number; CommonName: string; Quantity: number }[];
  events: { OpportunityID: number; Title: string; EventDate: string; Organization: string; SignUps: number; volunteers: { RegistrationID: number; Name: string; Status: string }[] }[];
};
type SitesSnapshot = {
  sites: Site[];
  species: { SpeciesID: number; CommonName: string; ScientificName: string; Category: string }[];
  users: { id: number; label: string }[];
};
type Match = { SiteID: number; Field: string; Value: string };
type Draft = { Name: string; SubmittedBy: string; CanopyCoverPct: string; ImperviousPct: string; SurfaceTempF: string; TreesNeeded: string; species: number[] };

const CENTER: [number, number] = [37.2296, -80.4139];
const STATUSES: Status[] = ["Proposed", "Approved", "Planted"];
const emptyDraft: Draft = { Name: "", SubmittedBy: "", CanopyCoverPct: "", ImperviousPct: "", SurfaceTempF: "", TreesNeeded: "", species: [] };

// Same formula as the SitePriority view in volunteer_db.sql.
function needScore(canopy: number, impervious: number, temp: number) {
  return Math.round(0.5 * (100 - canopy) + 0.3 * impervious + 0.2 * Math.min(100, Math.max(0, (temp - 85) * 4)));
}
function needLevel(site: Pick<Site, "Status" | "NeedScore">) {
  if (site.Status === "Planted") return "planted";
  return site.NeedScore >= 70 ? "high" : site.NeedScore >= 50 ? "medium" : "low";
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const COLORS = { high: "#b8432f", medium: "#d98a2b", low: "#b9b04a", planted: "#2f6b3d" };

export default function PlantingMap({ onChange }: { onChange?: () => void }) {
  const [data, setData] = useState<SitesSnapshot>({ sites: [], species: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Status | "All">("All");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [proposing, setProposing] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Map<number, Match[]> | null>(null);
  const [searching, setSearching] = useState(false);

  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const proposingRef = useRef(proposing);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sites");
      const result = (await response.json()) as SitesSnapshot & { error?: string };
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
      markers.current = L.layerGroup().addTo(map.current);
      map.current.on("click", (event: LeafletMouseEvent) => {
        if (proposingRef.current) setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Search runs in MySQL; the list and map only show sites the query matched.
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
        const grouped = new Map<number, Match[]>();
        for (const match of result.matches ?? []) grouped.set(match.SiteID, [...(grouped.get(match.SiteID) ?? []), match]);
        setMatches(grouped);
      } catch (cause) {
        if (!controller.signal.aborted) setMessage(cause instanceof Error ? cause.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, data.sites]);

  const visibleSites = useMemo(() => data.sites.filter((site) => (filter === "All" || site.Status === filter) && (!matches || matches.has(site.SiteID))), [data.sites, filter, matches]);
  const selected = data.sites.find((site) => site.SiteID === selectedId) ?? null;

  useEffect(() => {
    const L = leaflet.current;
    if (!mapReady || !L || !markers.current) return;
    markers.current.clearLayers();
    for (const site of visibleSites) {
      const color = COLORS[needLevel(site)];
      const isSelected = site.SiteID === selectedId;
      const marker: CircleMarker = L.circleMarker([site.Latitude, site.Longitude], {
        radius: 7 + Math.sqrt(site.TreesNeeded) * 1.2,
        color: isSelected ? "#1c3a25" : "white",
        weight: isSelected ? 3 : 1.5,
        fillColor: color,
        fillOpacity: 0.85,
      });
      marker.bindTooltip(`<strong>${escapeHtml(site.Name)}</strong><br>Need ${site.NeedScore} · ${site.Status}`, { direction: "top", offset: [0, -6] });
      marker.on("click", () => { if (!proposingRef.current) setSelectedId(site.SiteID); });
      marker.addTo(markers.current);
    }
    if (point) {
      L.circleMarker([point.lat, point.lng], { radius: 11, color: "#1c3a25", weight: 2, dashArray: "4 3", fillColor: "#ffffff", fillOpacity: 0.7 })
        .bindTooltip("New site", { permanent: true, direction: "top", offset: [0, -8] })
        .addTo(markers.current);
    }
  }, [mapReady, visibleSites, selectedId, point]);

  useEffect(() => {
    const L = leaflet.current;
    if (!matches || !matches.size || !L || !map.current) return;
    const found = data.sites.filter((site) => matches.has(site.SiteID));
    map.current.fitBounds(L.latLngBounds(found.map((site) => [site.Latitude, site.Longitude])), { padding: [40, 40], maxZoom: 15 });
  }, [matches, data.sites]);

  useEffect(() => {
    if (selected && map.current) map.current.flyTo([selected.Latitude, selected.Longitude], Math.max(map.current.getZoom(), 15), { duration: 0.6 });
  }, [selected]);

  useEffect(() => {
    proposingRef.current = proposing;
    host.current?.classList.toggle("placing", proposing);
  }, [proposing]);

  async function send(method: "POST" | "PATCH", body: object, success: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/sites", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as { error?: string; id?: number; snapshot: SitesSnapshot };
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

  async function saveSite(event: React.FormEvent) {
    event.preventDefault();
    if (!point) return;
    const result = await send("POST", { ...draft, Latitude: point.lat, Longitude: point.lng }, `"${draft.Name.trim()}" saved to PlantingSite.`);
    if (result?.id) {
      cancelProposal();
      setFilter("All");
      setSelectedId(result.id);
    }
  }

  function cancelProposal() {
    setProposing(false);
    setPoint(null);
    setDraft(emptyDraft);
  }

  const set = (name: keyof Draft, value: string) => setDraft((current) => ({ ...current, [name]: value }));
  const previewScore = draft.CanopyCoverPct && draft.ImperviousPct && draft.SurfaceTempF
    ? needScore(Number(draft.CanopyCoverPct), Number(draft.ImperviousPct), Number(draft.SurfaceTempF)) : null;
  const totals = useMemo(() => ({
    open: data.sites.filter((site) => site.Status !== "Planted").length,
    trees: data.sites.filter((site) => site.Status !== "Planted").reduce((sum, site) => sum + site.TreesNeeded, 0),
  }), [data.sites]);

  return (
    <div className="map-layout">
      <div className="map-stage">
        <div className="map-canvas" ref={host} />
        {proposing && !point && <p className="map-hint">Click the map where the new trees should go</p>}
        <div className="map-legend" aria-label="Legend">
          <span><i style={{ background: COLORS.high }} />High need</span>
          <span><i style={{ background: COLORS.medium }} />Medium</span>
          <span><i style={{ background: COLORS.low }} />Low</span>
          <span><i style={{ background: COLORS.planted }} />Planted</span>
        </div>
      </div>

      <aside className="map-panel">
        {message && <p className="notice">{message}</p>}
        {error && <div className="error"><span>{error}</span><button onClick={load}>Try again</button></div>}

        {proposing ? (
          <form className="record-form site-form" onSubmit={saveSite}>
            <div className="panel-head">
              <h2>Propose a planting site</h2>
              <span>{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "No location yet — click the map"}</span>
            </div>
            <label><span>Site name</span><input required maxLength={100} value={draft.Name} onChange={(e) => set("Name", e.target.value)} placeholder="e.g. Clay Street Sidewalk" /></label>
            <label><span>Submitted by</span><select required value={draft.SubmittedBy} onChange={(e) => set("SubmittedBy", e.target.value)}>
              <option value="">Choose a user</option>{data.users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
            </select></label>
            <div className="field-pair">
              <label><span>Tree canopy %</span><input required type="number" min={0} max={100} step={0.1} value={draft.CanopyCoverPct} onChange={(e) => set("CanopyCoverPct", e.target.value)} /></label>
              <label><span>Paved surface %</span><input required type="number" min={0} max={100} step={0.1} value={draft.ImperviousPct} onChange={(e) => set("ImperviousPct", e.target.value)} /></label>
            </div>
            <div className="field-pair">
              <label><span>Summer surface °F</span><input required type="number" min={0} max={150} step={0.1} value={draft.SurfaceTempF} onChange={(e) => set("SurfaceTempF", e.target.value)} /></label>
              <label><span>Trees needed</span><input required type="number" min={1} max={5000} step={1} value={draft.TreesNeeded} onChange={(e) => set("TreesNeeded", e.target.value)} /></label>
            </div>
            <fieldset className="species-picker">
              <legend>Recommended species</legend>
              {data.species.map((species) => (
                <label key={species.SpeciesID} title={species.ScientificName}>
                  <input type="checkbox" checked={draft.species.includes(species.SpeciesID)} onChange={(e) => setDraft((current) => ({
                    ...current,
                    species: e.target.checked ? [...current.species, species.SpeciesID] : current.species.filter((id) => id !== species.SpeciesID),
                  }))} />
                  {species.CommonName}
                </label>
              ))}
            </fieldset>
            {previewScore !== null && <p className="score-preview">Estimated need score <strong>{previewScore}</strong> / 100</p>}
            <div className="modal-actions">
              <button type="button" onClick={cancelProposal} disabled={saving}>Cancel</button>
              <button className="primary-button" disabled={saving || !point}>{saving ? "Saving..." : "Save site"}</button>
            </div>
          </form>
        ) : selected ? (
          <SiteDetail site={selected} saving={saving} onBack={() => setSelectedId(null)}
            onStatus={(status) => send("PATCH", { id: selected.SiteID, Status: status }, `${selected.Name} marked ${status}.`)} />
        ) : (
          <>
            <div className="panel-head">
              <h2>Where trees are needed most</h2>
              <span>{totals.open} open sites · {totals.trees} trees still needed</span>
            </div>
            <div className="site-search">
              <input type="search" aria-label="Search sites" placeholder="Search sites, species, events, volunteers..." value={query}
                onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQuery("")} />
              {query.trim() && <span>{searching ? "Searching..." : `${visibleSites.length} of ${data.sites.length} sites match`}</span>}
            </div>
            <div className="panel-actions">
              <div className="status-filter" role="group" aria-label="Filter by status">
                {(["All", ...STATUSES] as const).map((status) => (
                  <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status}</button>
                ))}
              </div>
              <button className="primary-button" onClick={() => { setProposing(true); setSelectedId(null); setMessage(""); }}>+ Propose site</button>
            </div>
            {loading ? <p className="state">Loading sites...</p> : (
              <ol className="site-list">
                {visibleSites.map((site) => (
                  <li key={site.SiteID}>
                    <button onClick={() => setSelectedId(site.SiteID)}>
                      <span className="site-score" style={{ background: COLORS[needLevel(site)] }}>{site.NeedScore}</span>
                      <span className="site-name"><strong>{site.Name}</strong><small>{site.TreesNeeded} trees · {site.CanopyCoverPct}% canopy</small>
                        {matches?.get(site.SiteID) && <small className="match-reason">{matches.get(site.SiteID)!.map((match) => `${match.Field}: ${match.Value}`).join(" · ")}</small>}</span>
                      <span className={`status-tag ${site.Status.toLowerCase()}`}>{site.Status}</span>
                    </button>
                  </li>
                ))}
                {!visibleSites.length && <li className="state">{query.trim() ? "No sites match your search." : "No sites with this status."}</li>}
              </ol>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function SiteDetail({ site, saving, onBack, onStatus }: { site: Site; saving: boolean; onBack: () => void; onStatus: (status: Status) => void }) {
  const next: Partial<Record<Status, { status: Status; label: string }>> = {
    Proposed: { status: "Approved", label: "Approve site" },
    Approved: { status: "Planted", label: "Mark as planted" },
  };
  return (
    <div className="site-detail">
      <button className="back-link" onClick={onBack}>‹ All sites</button>
      <div className="panel-head">
        <h2>{site.Name}</h2>
        <span className={`status-tag ${site.Status.toLowerCase()}`}>{site.Status}</span>
      </div>
      <div className="need-meter">
        <strong style={{ color: COLORS[needLevel(site)] }}>{site.NeedScore}</strong>
        <div><span>Need score out of 100</span><div className="meter"><i style={{ width: `${site.NeedScore}%`, background: COLORS[needLevel(site)] }} /></div></div>
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
      {site.events.length ? (
        <ul className="plain-list">{site.events.map((event) => (
          <li key={event.OpportunityID} className="event-item">
            <div><span><strong>{event.Title}</strong><small>{event.Organization} · {event.EventDate}</small></span><span>{event.SignUps} signed up</span></div>
            {event.volunteers?.length > 0 && <ul className="volunteer-list">{event.volunteers.map((volunteer) => (
              <li key={volunteer.RegistrationID} className={volunteer.Status === "Cancelled" ? "cancelled" : ""}>{volunteer.Name}<small>{volunteer.Status}</small></li>
            ))}</ul>}
          </li>
        ))}</ul>
      ) : <p className="site-meta">No events scheduled yet.</p>}

      <div className="modal-actions">
        {site.Status !== "Proposed" && <button disabled={saving} onClick={() => onStatus("Proposed")}>Reset to proposed</button>}
        {next[site.Status] && <button className="primary-button" disabled={saving} onClick={() => onStatus(next[site.Status]!.status)}>{saving ? "Saving..." : next[site.Status]!.label}</button>}
      </div>
    </div>
  );
}
