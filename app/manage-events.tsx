"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./auth-client";
import Modal from "./modal";

type Volunteer = { RegistrationID: number; Name: string; Email: string; Status: string; HoursLogged: number; RegistrationDate: string };
type ManagedEvent = {
  OpportunityID: number; Title: string; OrgID: number; Organization: string; EventDate: string; Location: string;
  Notes: string | null; Upcoming: boolean; SiteName: string | null; OnMap: boolean; volunteers: Volunteer[];
};
type ManageData = { orgs: { OrgID: number; Organization: string }[]; events: ManagedEvent[] };
type Filter = "upcoming" | "past" | "all";

const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];
const longDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function DateBadge({ date, past }: { date: string; past: boolean }) {
  const d = new Date(`${date}T00:00:00`);
  return <span className={`date-badge${past ? " past" : ""}`}><small>{d.toLocaleDateString("en-US", { month: "short" })}</small>{d.getDate()}</span>;
}

export default function ManageEventsPage({ onSchedule }: { onSchedule: () => void }) {
  const [data, setData] = useState<ManageData | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/manage/events")
      .then(async (response) => {
        const result = (await response.json()) as ManageData & { error?: string };
        if (!response.ok) throw new Error(result.error);
        setData(result);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your events."));
  }, []);

  async function send(url: string, method: "PATCH" | "DELETE", body: object, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch(url, { method, body: JSON.stringify(body) });
      const result = (await response.json()) as ManageData & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
      setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (data?.events ?? [])
      .filter((e) => filter === "all" || (filter === "upcoming") === e.Upcoming)
      .filter((e) => !search || `${e.Title} ${e.Organization} ${e.Location} ${e.volunteers.map((v) => v.Name).join(" ")}`.toLowerCase().includes(search))
      // Upcoming soonest first; past most recent first.
      .sort((a, b) => filter === "upcoming" ? a.EventDate.localeCompare(b.EventDate) : b.EventDate.localeCompare(a.EventDate));
  }, [data, filter, query]);

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="state">Loading your events...</p>;
  if (!data.orgs.length) return <p className="site-meta">You don&apos;t manage any organization yet. Organizers manage the organizations they belong to; Admins manage all.</p>;
  const noEvents = !data.events.length;

  const selected = data.events.find((e) => e.OpportunityID === selectedId) ?? null;
  const active = (e: ManagedEvent) => e.volunteers.filter((v) => v.Status !== "Cancelled").length;

  return (
    <div className="manage-layout">
      <aside className="manage-list">
        <div className="panel-actions">
          <div className="status-filter">
            {(["upcoming", "past", "all"] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
          <button className="primary-button" onClick={onSchedule}>+ Schedule event</button>
        </div>
        <input aria-label="Search events" placeholder="Search events, organizations, volunteers..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="site-list">
          {shown.map((event) => (
            <li key={event.OpportunityID}>
              <button className={event.OpportunityID === selectedId ? "selected" : ""} onClick={() => { setSelectedId(event.OpportunityID); setMessage(""); setError(""); }}>
                <DateBadge date={event.EventDate} past={!event.Upcoming} />
                <span className="site-name"><strong>{event.Title}</strong><small>{event.Organization}</small></span>
                <span className="signup-count">{active(event)}<small>signed up</small></span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="site-meta manage-empty">No {filter === "all" ? "" : filter} events{query && " match that search"}.</li>}
        </ul>
      </aside>

      <section className="manage-detail">
        {message && <p className="notice">{message}</p>}
        {error && <p className="error">{error}</p>}
        {!selected ? <p className="state">{noEvents ? "You don't manage any events yet. Schedule one on the Planting Map and it will appear here." : "Choose an event to edit it or take attendance."}</p>
          : <EventDetail key={selected.OpportunityID} event={selected} busy={busy}
              onSave={(form) => send("/api/manage/events", "PATCH", { OpportunityID: selected.OpportunityID, ...form }, "Event details saved.")}
              onDelete={async () => { if (await send("/api/manage/events", "DELETE", { OpportunityID: selected.OpportunityID }, `"${selected.Title}" was deleted.`)) setSelectedId(null); }}
              onAttendance={(v, Status, HoursLogged) => send("/api/manage/attendance", "PATCH", { RegistrationID: v.RegistrationID, Status, HoursLogged },
                Status === "Completed" ? `${v.Name}: completed, ${HoursLogged} hrs logged.` : `${v.Name}: marked ${Status}.`)} />}
      </section>
    </div>
  );
}

type EventForm = { Title: string; EventDate: string; Location: string; Notes: string };

function EventDetail({ event, busy, onSave, onDelete, onAttendance }: {
  event: ManagedEvent; busy: boolean;
  onSave: (form: EventForm) => void; onDelete: () => void;
  onAttendance: (v: Volunteer, status: string, hours: number) => void;
}) {
  const [form, setForm] = useState<EventForm>({ Title: event.Title, EventDate: event.EventDate, Location: event.Location, Notes: event.Notes ?? "" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key: keyof EventForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const completed = event.volunteers.filter((v) => v.Status === "Completed");
  const hours = completed.reduce((sum, v) => sum + v.HoursLogged, 0);

  return (
    <>
      <div className="panel-head">
        <h2>{event.Title}</h2>
        <span>{event.Organization} · {longDate(event.EventDate)}{event.SiteName && ` · ${event.SiteName}`}</span>
      </div>

      <div className="manage-columns">
        <section>
          <h3>Event details</h3>
          <form className="record-form" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
            <label><span>Title</span><input required maxLength={150} value={form.Title} onChange={(e) => set("Title", e.target.value)} /></label>
            <div className="field-pair">
              <label><span>Date</span><input required type="date" value={form.EventDate} onChange={(e) => set("EventDate", e.target.value)} /></label>
              <label><span>Location</span><input required maxLength={150} value={form.Location} onChange={(e) => set("Location", e.target.value)} /></label>
            </div>
            <label><span>Notes for volunteers</span><textarea rows={3} maxLength={500} value={form.Notes} onChange={(e) => set("Notes", e.target.value)} /></label>
            <div className="modal-actions spread">
              <button type="button" className="text-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete event</button>
              <button className="primary-button" disabled={busy}>Save details</button>
            </div>
          </form>
        </section>

        <section>
          <h3>Attendance <small className="site-meta">{completed.length} completed · {hours} hrs logged</small></h3>
          {!event.Upcoming ? null : <p className="site-meta">Volunteers can be marked Completed and given hours once the event date arrives.</p>}
          {event.volunteers.length ? (
            <ul className="plain-list attendance">
              {event.volunteers.map((v) => <AttendanceRow key={v.RegistrationID} volunteer={v} upcoming={event.Upcoming} busy={busy} onSave={onAttendance} />)}
            </ul>
          ) : <p className="site-meta">No one has signed up yet.</p>}
        </section>
      </div>

      {confirmDelete && (
        <Modal title="Delete this event?" onClose={() => setConfirmDelete(false)}>
          <p><strong>{event.Title}</strong> and its {event.volunteers.length} sign-up{event.volunteers.length === 1 ? "" : "s"} will be permanently deleted.</p>
          <div className="modal-actions">
            <button onClick={() => setConfirmDelete(false)} disabled={busy}>Keep event</button>
            <button className="danger-button" disabled={busy} onClick={() => { setConfirmDelete(false); onDelete(); }}>Delete event</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function AttendanceRow({ volunteer, upcoming, busy, onSave }: {
  volunteer: Volunteer; upcoming: boolean; busy: boolean; onSave: (v: Volunteer, status: string, hours: number) => void;
}) {
  const [status, setStatus] = useState(volunteer.Status);
  const [hours, setHours] = useState(volunteer.HoursLogged ? String(volunteer.HoursLogged) : "");
  const dirty = status !== volunteer.Status || (status === "Completed" && Number(hours) !== volunteer.HoursLogged);
  return (
    <li className={status === "Cancelled" ? "cancelled" : ""}>
      <span><strong>{volunteer.Name}</strong><small>{volunteer.Email}</small></span>
      <span className="row-actions">
        <select aria-label={`Status for ${volunteer.Name}`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} disabled={s === "Completed" && upcoming}>{s}</option>)}
        </select>
        <input aria-label={`Hours for ${volunteer.Name}`} className="hours-input" type="number" min={0.25} max={24} step={0.25} placeholder="hrs"
          disabled={status !== "Completed"} value={status === "Completed" ? hours : ""} onChange={(e) => setHours(e.target.value)} />
        <button className="primary-button small" disabled={busy || !dirty || (status === "Completed" && !(Number(hours) > 0))}
          onClick={() => onSave(volunteer, status, Number(hours) || 0)}>Save</button>
      </span>
    </li>
  );
}
