"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, apiFetch, useAuth } from "./auth-client";
import Modal from "./modal";
import PlantingMap from "./planting-map";
import ProfilePage from "./profile";
import RequestsPage, { type VolunteerRequest } from "./requests";

type TableName = "Organization" | "Users" | "VolunteerOpportunity" | "OrganizationMember" | "Registration" | "PlantingSite";
type Row = Record<string, string | number | null>;
type Snapshot = {
  counts: { TableName: string; RowCount: number }[];
  tables: Record<TableName, Row[]>;
  lookups: {
    organizations: { id: number; label: string }[];
    users: { id: number; label: string }[];
    opportunities: { id: number; label: string }[];
  };
};

const tables: Record<TableName, { label: string; singular: string; id: string; columns: { key: string; label: string }[] }> = {
  Organization: {
    label: "Organizations", singular: "organization", id: "OrgID",
    columns: [{ key: "OrgID", label: "ID" }, { key: "Name", label: "Name" }, { key: "Type", label: "Type" }, { key: "ContactEmail", label: "Contact email" }],
  },
  Users: {
    label: "Users", singular: "user", id: "UserID",
    columns: [{ key: "UserID", label: "ID" }, { key: "FName", label: "First name" }, { key: "LName", label: "Last name" }, { key: "Email", label: "Email" }, { key: "Roles", label: "Roles" }],
  },
  VolunteerOpportunity: {
    label: "Opportunities", singular: "opportunity", id: "OpportunityID",
    columns: [{ key: "OpportunityID", label: "ID" }, { key: "Organization", label: "Organization" }, { key: "Title", label: "Title" }, { key: "EventDate", label: "Event date" }, { key: "Location", label: "Location" }, { key: "SignUps", label: "Sign-ups" }],
  },
  OrganizationMember: {
    label: "Members", singular: "member", id: "MembershipID",
    columns: [{ key: "MembershipID", label: "ID" }, { key: "Organization", label: "Organization" }, { key: "Member", label: "Member" }, { key: "JoinDate", label: "Join date" }, { key: "OrgRole", label: "Role" }],
  },
  Registration: {
    label: "Registrations", singular: "registration", id: "RegistrationID",
    columns: [{ key: "RegistrationID", label: "ID" }, { key: "Volunteer", label: "Volunteer" }, { key: "Opportunity", label: "Opportunity" }, { key: "RegistrationDate", label: "Registered" }, { key: "Status", label: "Status" }, { key: "HoursLogged", label: "Hours" }],
  },
  PlantingSite: {
    label: "Planting Sites", singular: "site", id: "SiteID",
    columns: [{ key: "SiteID", label: "ID" }, { key: "Name", label: "Name" }, { key: "Latitude", label: "Lat" }, { key: "Longitude", label: "Lng" }, { key: "CanopyCoverPct", label: "Canopy %" }, { key: "NeedScore", label: "Need" }, { key: "Status", label: "Status" }, { key: "SubmittedBy", label: "Submitted by" }],
  },
};

const emptySnapshot: Snapshot = {
  counts: [],
  tables: { Organization: [], Users: [], VolunteerOpportunity: [], OrganizationMember: [], Registration: [], PlantingSite: [] },
  lookups: { organizations: [], users: [], opportunities: [] },
};
// Roles admins can change from the Users page; Admin is only changed with scripts/set-admin.sh.
const MANAGED_ROLES = ["Organizer", "Arborist"];
const ROW_HEIGHT = 41;
const HEADER_HEIGHT = 41;
function pageNumbers(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set([0, count - 1, current - 1, current, current + 1]);
  const sorted = [...pages].filter((n) => n >= 0 && n < count).sort((x, y) => x - y);
  return sorted.flatMap((n, i) => (i && n - sorted[i - 1] > 1 ? [null, n] : [n]));
}
const today = () => new Date().toISOString().slice(0, 10);

export default function Treefinder() {
  return <AuthProvider><App /></AuthProvider>;
}

function App() {
  const { user, ready, hasRole, promptLogin, logout } = useAuth();
  const isAdmin = hasRole("Admin");
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [view, setView] = useState<"map" | "database" | "profile" | "requests">("map");
  const [requests, setRequests] = useState<{ canManage: boolean; list: VolunteerRequest[]; error: string }>({ canManage: false, list: [], error: "" });
  const canManage = Boolean(user) && requests.canManage;
  // Fall back to the map when the database, profile, or requests page isn't available to this visitor.
  const shown = (view === "database" && !isAdmin) || (view === "profile" && !user) || (view === "requests" && !canManage) ? "map" : view;
  const [table, setTable] = useState<TableName>("Organization");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin-data");
      const result = (await response.json()) as Snapshot & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setSnapshot(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Database unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Anyone who can schedule events for an organization reviews its volunteer requests.
  const loadRequests = useCallback(async () => {
    try {
      const response = await apiFetch("/api/requests");
      const result = (await response.json()) as { canManage?: boolean; requests?: VolunteerRequest[]; error?: string };
      if (!response.ok) throw new Error(result.error);
      setRequests({ canManage: Boolean(result.canManage), list: result.requests ?? [], error: "" });
    } catch (cause) {
      setRequests((current) => ({ ...current, error: cause instanceof Error ? cause.message : "Could not load volunteer requests." }));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(loadRequests, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests, user]);

  // Only administrators can read the Database Manager tables.
  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, isAdmin]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setPageSize(Math.max(3, Math.floor((el.clientHeight - HEADER_HEIGHT) / ROW_HEIGHT)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, shown]);

  const rows = snapshot.tables[table];
  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(search)) : rows;
  }, [query, rows]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  async function insert(data: Record<string, string | number>) {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin-data", { method: "POST", body: JSON.stringify({ table, data }) });
      const result = (await response.json()) as { error?: string; snapshot: Snapshot };
      if (!response.ok) throw new Error(result.error);
      setSnapshot(result.snapshot);
      setAdding(false);
      setMessage("Record inserted successfully.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Insert failed.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId: number, name: string, role: string, action: "add" | "remove") {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin-data", { method: "PATCH", body: JSON.stringify({ UserID: userId, Role: role, action }) });
      const result = (await response.json()) as { error?: string; snapshot: Snapshot };
      if (!response.ok) throw new Error(result.error);
      setSnapshot(result.snapshot);
      setMessage(action === "add" ? `Granted ${role} to ${name}.` : `Removed ${role} from ${name}.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Role change failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin-data", { method: "DELETE", body: JSON.stringify({ table, id: deleteTarget.id }) });
      const result = (await response.json()) as { error?: string; snapshot: Snapshot };
      if (!response.ok) throw new Error(result.error);
      setSnapshot(result.snapshot);
      setDeleteTarget(null);
      setMessage("Record permanently deleted.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div><img className="brand-logo" src="/logo.png" alt="Three Trees Tree Conservation" /></div>
        <nav className="nav-tabs" aria-label="Views">
          <button className={shown === "map" ? "active" : ""} onClick={() => setView("map")}>Planting Map</button>
          {canManage && <button className={shown === "requests" ? "active" : ""} onClick={() => { setView("requests"); loadRequests(); }}>
            Volunteer Requests<strong>{requests.list.filter((r) => r.Status === "Pending").length}</strong>
          </button>}
          {isAdmin && <>
            <span className="nav-divider" aria-hidden="true" />
            {(Object.keys(tables) as TableName[]).map((name) => (
              <button key={name} className={shown === "database" && table === name ? "active" : ""} onClick={() => { setView("database"); setTable(name); setQuery(""); setPage(0); setMessage(""); }}>
                {tables[name].label}<strong>{snapshot.tables[name].length}</strong>
              </button>
            ))}
          </>}
        </nav>
        <div className="account">
          {!ready ? null : user ? <>
            <button className={`account-button${shown === "profile" ? " active" : ""}`} onClick={() => setView("profile")}>
              {user.FName} {user.LName}{isAdmin && <em>Admin</em>}
            </button>
            <button className="account-link" onClick={logout}>Log out</button>
          </> : <>
            <button className="account-link" onClick={() => promptLogin("login")}>Log in</button>
            <button className="account-button" onClick={() => promptLogin("register")}>Sign up</button>
          </>}
        </div>
      </header>

      {shown === "profile" ? (
      <section className="content">
        <div className="title-row"><h1>My Profile</h1></div>
        <ProfilePage />
      </section>
      ) : shown === "requests" ? (
      <section className="content">
        <div className="title-row">
          <h1>Volunteer Requests</h1>
          <span className="subtitle">Accept or decline sign-ups for your organizations&apos; upcoming events</span>
        </div>
        <RequestsPage requests={requests.list} error={requests.error} onChange={(list) => setRequests((current) => ({ ...current, list, error: "" }))} />
      </section>
      ) : shown === "map" ? (
      <section className="content">
        <div className="title-row">
          <h1>Planting Map</h1>
          <span className="subtitle">Blacksburg, VA · sites ranked by canopy gap, paved surface, and heat</span>
        </div>
        <PlantingMap onChange={isAdmin || canManage ? () => { if (isAdmin) load(); if (canManage) loadRequests(); } : undefined} />
      </section>
      ) : (
      <section className="content">
        <div className="title-row">
          <h1>Database Manager</h1>
          <button className="primary-button" onClick={() => table === "PlantingSite" ? setView("map") : setAdding(true)}>+ Add {tables[table].singular}</button>
        </div>

        {message && <p className="notice">{message}</p>}
        {error && <div className="error"><span>{error}</span><button onClick={load}>Try again</button></div>}

        <section className="database-card">
          <div className="table-toolbar">
            <div><h2>{tables[table].label}</h2><span>{rows.length} rows</span></div>
            <input aria-label={`Search ${tables[table].label}`} placeholder="Search records..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
          </div>

          {loading ? <p className="state">Loading database...</p> : (
            <div className="table-wrap" ref={wrapRef}>
              <table>
                <thead><tr>{tables[table].columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Action</th></tr></thead>
                <tbody>
                  {pageRows.map((row) => {
                    const id = Number(row[tables[table].id]);
                    return <tr key={id}>
                      {tables[table].columns.map((column) => <td key={column.key}>{table === "Users" && column.key === "Roles"
                        ? <RoleEditor roles={String(row.Roles ?? "User").split(", ")} disabled={saving}
                            onChange={(role, action) => changeRole(id, `${row.FName} ${row.LName}`, role, action)} />
                        : String(row[column.key] ?? "—")}</td>)}
                      <td><button className="delete-button" onClick={() => setDeleteTarget({
                        id,
                        name: String(row.Name ?? row.Title ?? row.Member ?? row.Volunteer ?? `record ${id}`),
                      })}>Delete</button></td>
                    </tr>;
                  })}
                  {!filteredRows.length && <tr><td colSpan={tables[table].columns.length + 1} className="state">No matching records.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {!loading && (
            <div className="pagination">
              <span>{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredRows.length)} of {filteredRows.length}</span>
              <div className="pager" role="navigation" aria-label="Pagination">
                <button aria-label="Previous page" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>‹</button>
                {pageNumbers(currentPage, pageCount).map((n, i) => n === null
                  ? <span key={`gap${i}`} className="gap">…</span>
                  : <button key={n} className={n === currentPage ? "current" : ""} aria-current={n === currentPage ? "page" : undefined} onClick={() => setPage(n)}>{n + 1}</button>)}
                <button aria-label="Next page" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>›</button>
              </div>
            </div>
          )}
        </section>
      </section>
      )}

      {adding && <RecordForm table={table} snapshot={snapshot} saving={saving} onClose={() => setAdding(false)} onSave={insert} />}
      {deleteTarget && (
        <Modal title="Permanently delete this record?" onClose={() => setDeleteTarget(null)}>
          <p><strong>{deleteTarget.name}</strong> will be deleted. Related rows may also be removed by the database rules. This cannot be undone.</p>
          <div className="modal-actions">
            <button onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</button>
            <button className="danger-button" onClick={remove} disabled={saving}>{saving ? "Deleting..." : "Delete permanently"}</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** Role tags for a user; Organizer and Arborist can be removed or added, User and Admin are fixed here. */
function RoleEditor({ roles, disabled, onChange }: { roles: string[]; disabled: boolean; onChange: (role: string, action: "add" | "remove") => void }) {
  const addable = MANAGED_ROLES.filter((role) => !roles.includes(role));
  return <span className="role-editor">
    {roles.map((role) => <span key={role} className={`role-tag ${role.toLowerCase()}`}
      title={role === "Admin" ? "Admin is granted and removed with scripts/set-admin.sh" : undefined}>
      {role}
      {MANAGED_ROLES.includes(role) && <button aria-label={`Remove ${role}`} disabled={disabled} onClick={() => onChange(role, "remove")}>×</button>}
    </span>)}
    {addable.length > 0 && <select aria-label="Add role" value="" disabled={disabled} onChange={(event) => event.target.value && onChange(event.target.value, "add")}>
      <option value="">+ Role</option>{addable.map((role) => <option key={role}>{role}</option>)}
    </select>}
  </span>;
}

function RecordForm({ table, snapshot, saving, onClose, onSave }: {
  table: TableName; snapshot: Snapshot; saving: boolean; onClose: () => void; onSave: (data: Record<string, string | number>) => void;
}) {
  const defaults: Record<string, string | number> = table === "OrganizationMember"
    ? { JoinDate: today(), OrgRole: "Member" }
    : table === "Registration" ? { RegistrationDate: today(), Status: "Pending", HoursLogged: 0 } : {};
  const [form, setForm] = useState<Record<string, string | number>>(defaults);
  const set = (name: string, value: string | number) => setForm((current) => ({ ...current, [name]: value }));

  return (
    <Modal title={`Add ${tables[table].singular}`} onClose={onClose}>
      <form className="record-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        {table === "Organization" && <>
          <Field label="Organization name" name="Name" form={form} set={set} maxLength={100} />
          <SelectField label="Type" name="Type" form={form} set={set} options={["Nonprofit", "Government", "School", "Community Group", "Business"]} />
          <Field label="Contact email" name="ContactEmail" type="email" form={form} set={set} maxLength={100} />
        </>}
        {table === "Users" && <>
          <Field label="First name" name="FName" form={form} set={set} maxLength={50} />
          <Field label="Last name" name="LName" form={form} set={set} maxLength={50} />
          <Field label="Email" name="Email" type="email" form={form} set={set} maxLength={100} />
        </>}
        {table === "VolunteerOpportunity" && <>
          <LookupField label="Organization" name="OrgID" options={snapshot.lookups.organizations} form={form} set={set} />
          <Field label="Title" name="Title" form={form} set={set} maxLength={150} />
          <Field label="Event date" name="EventDate" type="date" form={form} set={set} />
          <Field label="Location" name="Location" form={form} set={set} maxLength={150} />
        </>}
        {table === "OrganizationMember" && <>
          <LookupField label="Organization" name="OrgID" options={snapshot.lookups.organizations} form={form} set={set} />
          <LookupField label="User" name="UserID" options={snapshot.lookups.users} form={form} set={set} />
          <Field label="Join date" name="JoinDate" type="date" form={form} set={set} />
          <SelectField label="Role" name="OrgRole" form={form} set={set} options={["Member", "Coordinator", "Officer", "Director"]} />
        </>}
        {table === "Registration" && <>
          <LookupField label="User" name="UserID" options={snapshot.lookups.users} form={form} set={set} />
          <LookupField label="Opportunity" name="OpportunityID" options={snapshot.lookups.opportunities} form={form} set={set} />
          <Field label="Registration date" name="RegistrationDate" type="date" form={form} set={set} />
          <SelectField label="Status" name="Status" form={form} set={set} options={["Pending", "Confirmed", "Cancelled", "Completed"]} />
          <Field label="Hours logged" name="HoursLogged" type="number" form={form} set={set} min={0} max={24} step={0.25} />
        </>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Insert record"}</button>
        </div>
      </form>
    </Modal>
  );
}

type FieldProps = { label: string; name: string; form: Record<string, string | number>; set: (name: string, value: string | number) => void };

function Field({ label, name, form, set, ...inputProps }: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "form" | "name" | "value" | "onChange">) {
  return <label><span>{label}</span><input required name={name} value={form[name] ?? ""} onChange={(event) => set(name, event.target.value)} {...inputProps} /></label>;
}

function SelectField({ label, name, form, set, options }: FieldProps & { options: string[] }) {
  return <label><span>{label}</span><select required value={form[name] ?? ""} onChange={(event) => set(name, event.target.value)}>
    <option value="">Choose one</option>{options.map((option) => <option key={option}>{option}</option>)}
  </select></label>;
}

function LookupField({ label, name, form, set, options }: FieldProps & { options: { id: number; label: string }[] }) {
  return <label><span>{label}</span><select required value={form[name] ?? ""} onChange={(event) => set(name, Number(event.target.value))}>
    <option value="">Choose one</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
  </select></label>;
}
