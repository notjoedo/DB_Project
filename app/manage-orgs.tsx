"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./auth-client";
import Modal from "./modal";

type Member = { MembershipID: number; UserID: number; Name: string; Email: string; OrgRole: string; JoinDate: string };
type OrgEvent = { OpportunityID: number; Title: string; EventDate: string; Upcoming: boolean; SignUps: number };
type Org = { OrgID: number; Name: string; Type: string; ContactEmail: string; Events: number; events: OrgEvent[]; members: Member[] };
type Person = { UserID: number; Name: string; Email: string };
type OrgData = { canCreate: boolean; organizations: Org[]; people: Person[] };
type Details = { Name: string; Type: string; ContactEmail: string };

const TYPES = ["Nonprofit", "Government", "School", "Community Group", "Business"];
const ORG_ROLES = ["Member", "Coordinator", "Officer", "Director"];
const joined = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const X = <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;

/** initialOrgId opens that organization (e.g. from an event's "Hosted by" link); onOpenEvent jumps to Manage Events. */
export default function ManageOrgsPage({ onOpenEvent, initialOrgId = null }: { onOpenEvent: (eventId: number) => void; initialOrgId?: number | null }) {
  const [data, setData] = useState<OrgData | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialOrgId);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/manage/organizations")
      .then(async (response) => {
        const result = (await response.json()) as OrgData & { error?: string };
        if (!response.ok) throw new Error(result.error);
        setData(result);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load organizations."));
  }, []);

  async function send(method: "POST" | "PATCH" | "DELETE", body: object, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/manage/organizations", { method, body: JSON.stringify(body) });
      const result = (await response.json()) as OrgData & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
      setMessage(success);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (data?.organizations ?? []).filter((org) => !search
      || `${org.Name} ${org.Type} ${org.members.map((m) => m.Name).join(" ")}`.toLowerCase().includes(search));
  }, [data, query]);

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="state">Loading organizations...</p>;
  const selected = data.organizations.find((org) => org.OrgID === selectedId) ?? null;

  return (
    <div className="manage-layout">
      <aside className="manage-list">
        <div className="panel-actions">
          <input aria-label="Search organizations" placeholder="Search organizations or members..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {data.canCreate && <button className="primary-button" onClick={() => setCreating(true)}>+ New</button>}
        </div>
        <ul className="site-list">
          {shown.map((org) => (
            <li key={org.OrgID}>
              <button className={org.OrgID === selectedId ? "selected" : ""} onClick={() => { setSelectedId(org.OrgID); setMessage(""); setError(""); }}>
                <span className="site-name"><strong>{org.Name}</strong><small>{org.Type} · {org.Events} event{org.Events === 1 ? "" : "s"}</small></span>
                <span className="signup-count">{org.members.length}<small>member{org.members.length === 1 ? "" : "s"}</small></span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="site-meta manage-empty">{query ? "No organizations match that search." : "No organizations to manage."}</li>}
        </ul>
      </aside>

      <section className="manage-detail">
        {message && <p className="notice">{message}</p>}
        {error && <p className="error">{error}</p>}
        {!selected ? <p className="state">Choose an organization to manage its members and details.</p>
          : <OrgDetail key={selected.OrgID} org={selected} people={data.people} canDelete={data.canCreate} busy={busy} onOpenEvent={onOpenEvent}
              onSaveDetails={(d) => send("PATCH", { OrgID: selected.OrgID, ...d }, "Organization details saved.")}
              onDelete={async () => { if (await send("DELETE", { OrgID: selected.OrgID }, `${selected.Name} was deleted.`)) setSelectedId(null); }}
              onAdd={(person, role) => send("POST", { OrgID: selected.OrgID, UserID: person.UserID, OrgRole: role }, `${person.Name} joined ${selected.Name} as ${role}.`)}
              onRole={(m, role) => send("PATCH", { MembershipID: m.MembershipID, OrgRole: role }, `${m.Name} is now ${role === "Officer" ? "an" : "a"} ${role}.`)}
              onRemove={(m) => send("DELETE", { MembershipID: m.MembershipID }, `${m.Name} was removed from ${selected.Name}.`)} />}
      </section>

      {creating && <OrgForm title="New organization" busy={busy} initial={{ Name: "", Type: "", ContactEmail: "" }} submitLabel="Create organization"
        onClose={() => setCreating(false)}
        onSave={async (d) => {
          const result = await send("POST", d, `${d.Name} was created. Add its members next.`);
          if (result) {
            setCreating(false);
            setSelectedId(result.organizations.find((org) => org.Name === d.Name.trim())?.OrgID ?? null);
          }
        }} />}
    </div>
  );
}

function OrgDetail({ org, people, canDelete, busy, onOpenEvent, onSaveDetails, onDelete, onAdd, onRole, onRemove }: {
  org: Org; people: Person[]; canDelete: boolean; busy: boolean; onOpenEvent: (eventId: number) => void;
  onSaveDetails: (d: Details) => void; onDelete: () => void;
  onAdd: (person: Person, role: string) => Promise<unknown>; onRole: (m: Member, role: string) => void; onRemove: (m: Member) => void;
}) {
  const [details, setDetails] = useState<Details>({ Name: org.Name, Type: org.Type, ContactEmail: org.ContactEmail });
  const [newPerson, setNewPerson] = useState("");
  const [newRole, setNewRole] = useState("Member");
  const [confirm, setConfirm] = useState<"org" | Member | null>(null);
  const memberIds = new Set(org.members.map((m) => m.UserID));
  const available = people.filter((p) => !memberIds.has(p.UserID));

  return (
    <>
      <div className="panel-head">
        <h2>{org.Name}</h2>
        <span>{org.Type} · {org.ContactEmail} · {org.Events} event{org.Events === 1 ? "" : "s"}</span>
      </div>

      <div className="manage-columns">
        <section>
          <h3>Members <small className="site-meta">{org.members.length}</small></h3>
          <form className="add-member" onSubmit={async (e) => {
            e.preventDefault();
            const person = people.find((p) => p.UserID === Number(newPerson));
            if (person && await onAdd(person, newRole)) { setNewPerson(""); setNewRole("Member"); }
          }}>
            <select aria-label="Person to add" required value={newPerson} onChange={(e) => setNewPerson(e.target.value)}>
              <option value="">Add a person...</option>
              {available.map((p) => <option key={p.UserID} value={p.UserID}>{p.Name} ({p.Email})</option>)}
            </select>
            <select aria-label="Role in organization" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {ORG_ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button className="primary-button small" disabled={busy || !newPerson}>Add</button>
          </form>
          {org.members.length ? (
            <ul className="plain-list attendance">
              {org.members.map((m) => (
                <li key={m.MembershipID}>
                  <span><strong>{m.Name}</strong><small>{m.Email} · joined {joined(m.JoinDate)}</small></span>
                  <span className="row-actions">
                    <select aria-label={`Role for ${m.Name}`} value={m.OrgRole} disabled={busy} onChange={(e) => onRole(m, e.target.value)}>
                      {ORG_ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <button className="icon-button" title="Remove from organization" aria-label={`Remove ${m.Name}`} disabled={busy} onClick={() => setConfirm(m)}>{X}</button>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="site-meta">No members yet. Add someone above.</p>}
        </section>

        <section>
          <h3>Organization details</h3>
          <form className="record-form" onSubmit={(e) => { e.preventDefault(); onSaveDetails(details); }}>
            <DetailFields details={details} set={setDetails} />
            <div className="modal-actions spread">
              {canDelete ? <button type="button" className="text-danger" disabled={busy} onClick={() => setConfirm("org")}>Delete organization</button> : <span />}
              <button className="primary-button" disabled={busy}>Save details</button>
            </div>
          </form>

          <h3>Events hosted <small className="site-meta">{org.events.length} · edit them in Manage Events</small></h3>
          {org.events.length ? (
            <ul className="plain-list">
              {org.events.map((e) => (
                <li key={e.OpportunityID}>
                  <button className="text-link" onClick={() => onOpenEvent(e.OpportunityID)}>{e.Title}<small>{joined(e.EventDate)}{e.Upcoming ? "" : " · past"}</small></button>
                  <span>{e.SignUps} signed up</span>
                </li>
              ))}
            </ul>
          ) : <p className="site-meta">No events yet. Schedule one on the Planting Map.</p>}
        </section>
      </div>

      {confirm && (
        <Modal title={confirm === "org" ? "Delete this organization?" : "Remove this member?"} onClose={() => setConfirm(null)}>
          <p>{confirm === "org"
            ? <><strong>{org.Name}</strong>, its {org.members.length} memberships, and its {org.Events} events (with their sign-ups) will be permanently deleted.</>
            : <><strong>{confirm.Name}</strong> will no longer be a member of {org.Name}. Their account and sign-ups stay.</>}</p>
          <div className="modal-actions">
            <button onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
            <button className="danger-button" disabled={busy} onClick={() => { const target = confirm; setConfirm(null); if (target === "org") onDelete(); else onRemove(target); }}>
              {confirm === "org" ? "Delete organization" : "Remove member"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function DetailFields({ details, set }: { details: Details; set: (d: Details) => void }) {
  return <>
    <label><span>Name</span><input required maxLength={100} value={details.Name} onChange={(e) => set({ ...details, Name: e.target.value })} /></label>
    <label><span>Type</span><select required value={details.Type} onChange={(e) => set({ ...details, Type: e.target.value })}>
      <option value="">Choose one</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
    </select></label>
    <label><span>Contact email</span><input required type="email" maxLength={100} value={details.ContactEmail} onChange={(e) => set({ ...details, ContactEmail: e.target.value })} /></label>
  </>;
}

function OrgForm({ title, busy, initial, submitLabel, onClose, onSave }: {
  title: string; busy: boolean; initial: Details; submitLabel: string; onClose: () => void; onSave: (d: Details) => void;
}) {
  const [details, setDetails] = useState(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <form className="record-form" onSubmit={(e) => { e.preventDefault(); onSave(details); }}>
        <DetailFields details={details} set={setDetails} />
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="primary-button" disabled={busy}>{busy ? "Saving..." : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
