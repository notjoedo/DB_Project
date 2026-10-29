"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TableName = "Organization" | "Users" | "VolunteerOpportunity" | "OrganizationMember" | "Registration";
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
};

const emptySnapshot: Snapshot = {
  counts: [],
  tables: { Organization: [], Users: [], VolunteerOpportunity: [], OrganizationMember: [], Registration: [] },
  lookups: { organizations: [], users: [], opportunities: [] },
};
const today = () => new Date().toISOString().slice(0, 10);

export default function Treefinder() {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [table, setTable] = useState<TableName>("Organization");
  const [query, setQuery] = useState("");
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
      const response = await fetch("/api/admin-data");
      const result = (await response.json()) as Snapshot & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setSnapshot(result);
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

  const rows = snapshot.tables[table];
  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(search)) : rows;
  }, [query, rows]);

  async function insert(data: Record<string, string | number>) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin-data", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table, data }),
      });
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

  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin-data", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table, id: deleteTarget.id }),
      });
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
        <div><span className="logo small">TF</span><strong>Treefinder</strong></div>
        <div className="account"><span>Local MySQL</span></div>
      </header>

      <section className="content">
        <div className="title-row">
          <div><p className="eyebrow">PHASE 2</p><h1>Database Manager</h1><p>View, insert, and permanently delete records.</p></div>
          <button className="primary-button" onClick={() => setAdding(true)}>+ Add {tables[table].singular}</button>
        </div>

        <div className="counts">
          {(Object.keys(tables) as TableName[]).map((name) => (
            <button key={name} className={table === name ? "active" : ""} onClick={() => { setTable(name); setQuery(""); setMessage(""); }}>
              <strong>{snapshot.tables[name].length}</strong><span>{tables[name].label}</span>
            </button>
          ))}
        </div>

        {message && <p className="notice">{message}</p>}
        {error && <div className="error"><span>{error}</span><button onClick={load}>Try again</button></div>}

        <section className="database-card">
          <div className="table-toolbar">
            <div><h2>{tables[table].label}</h2><span>{rows.length} rows</span></div>
            <input aria-label={`Search ${tables[table].label}`} placeholder="Search records..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>

          {loading ? <p className="state">Loading database...</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr>{tables[table].columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Action</th></tr></thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const id = Number(row[tables[table].id]);
                    return <tr key={id}>
                      {tables[table].columns.map((column) => <td key={column.key}>{String(row[column.key] ?? "—")}</td>)}
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
        </section>
      </section>

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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button aria-label="Close" onClick={onClose}>×</button></div>
      {children}
    </section>
  </div>;
}
