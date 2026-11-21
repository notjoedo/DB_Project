"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, useAuth } from "./auth-client";
import Modal from "./modal";

type Person = { UserID: number; FName: string; LName: string; Email: string; Roles: string[]; CanLogIn: boolean; Organizations: string | null };
type PeopleData = { people: Person[]; roles: string[] };

const ROLE_HELP: Record<string, string> = {
  Organizer: "Schedules and manages events for organizations they belong to",
  Arborist: "Approves planting areas and marks them planted",
  Admin: "Manages people, roles, and all records",
};

export default function PeoplePage() {
  const { user } = useAuth();
  const [data, setData] = useState<PeopleData>({ people: [], roles: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Person | null>(null);

  async function call(method: string, body?: object, success?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/users", { method, body: body && JSON.stringify(body) });
      const result = (await response.json()) as PeopleData & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
      if (success) setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    apiFetch("/api/admin/users")
      .then(async (response) => {
        const result = (await response.json()) as PeopleData & { error?: string };
        if (!response.ok) throw new Error(result.error);
        setData(result);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load people."))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? data.people.filter((p) => `${p.FName} ${p.LName} ${p.Email} ${p.Organizations ?? ""} ${p.Roles.join(" ")}`.toLowerCase().includes(search)) : data.people;
  }, [data.people, query]);

  const toggle = (person: Person, role: string, grant: boolean) => call("PATCH", { UserID: person.UserID, Role: role, Grant: grant },
    `${person.FName} ${person.LName} ${grant ? "is now" : "is no longer"} ${role === "Admin" || role === "Arborist" ? "an" : "a"} ${role}.`);

  return (
    <>
      {message && <p className="notice">{message}</p>}
      {error && <div className="error"><span>{error}</span></div>}
      <section className="database-card">
        <div className="table-toolbar">
          <div><h2>Everyone</h2><span>{data.people.length} people</span></div>
          <div className="row-actions">
            <input aria-label="Search people" placeholder="Search by name, email, role..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="primary-button" onClick={() => setCreating(true)}>+ Create account</button>
          </div>
        </div>
        {loading ? <p className="state">Loading people...</p> : (
          <div className="table-wrap scroll">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Organizations</th>{data.roles.filter((r) => r !== "User").map((r) => <th key={r} title={ROLE_HELP[r]}>{r}</th>)}<th>Sign-in</th><th /></tr></thead>
              <tbody>
                {shown.map((person) => {
                  const self = person.UserID === user?.UserID;
                  return <tr key={person.UserID}>
                    <td><strong>{person.FName} {person.LName}</strong>{self && <span className="you-tag">you</span>}</td>
                    <td>{person.Email}</td>
                    <td className="muted-cell">{person.Organizations ?? "—"}</td>
                    {data.roles.filter((r) => r !== "User").map((role) => {
                      const has = person.Roles.includes(role);
                      const locked = self && role === "Admin" && has;
                      return <td key={role} className="role-cell">
                        <input type="checkbox" aria-label={`${role} role for ${person.FName} ${person.LName}`} checked={has} disabled={busy || locked}
                          title={locked ? "You can't remove your own Admin role" : ROLE_HELP[role]} onChange={() => toggle(person, role, !has)} />
                      </td>;
                    })}
                    <td className="muted-cell">{person.CanLogIn ? "Active" : "No password"}</td>
                    <td>{!self && <button className="icon-button" aria-label={`Delete ${person.FName} ${person.LName}`} title="Delete account" disabled={busy} onClick={() => setDeleting(person)}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>}</td>
                  </tr>;
                })}
                {!shown.length && <tr><td colSpan={data.roles.length + 4} className="state">No one matches that search.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating && <CreateAccount roles={data.roles.filter((r) => r !== "User")} busy={busy} onClose={() => setCreating(false)}
        onSave={async (form) => {
          if (await call("POST", form, `Account created for ${form.FName} ${form.LName}. Share the temporary password; they can change it from My Profile.`)) setCreating(false);
        }} />}
      {deleting && (
        <Modal title="Delete this account?" onClose={() => setDeleting(null)}>
          <p><strong>{deleting.FName} {deleting.LName}</strong> and their sign-ups and memberships will be permanently deleted.</p>
          <div className="modal-actions">
            <button onClick={() => setDeleting(null)} disabled={busy}>Cancel</button>
            <button className="danger-button" disabled={busy} onClick={async () => {
              if (await call("DELETE", { UserID: deleting.UserID }, `${deleting.FName} ${deleting.LName}'s account was deleted.`)) setDeleting(null);
            }}>{busy ? "Deleting..." : "Delete account"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

type NewAccount = { FName: string; LName: string; Email: string; Password: string; Roles: string[] };

function CreateAccount({ roles, busy, onClose, onSave }: { roles: string[]; busy: boolean; onClose: () => void; onSave: (form: NewAccount) => void }) {
  const [form, setForm] = useState<NewAccount>({ FName: "", LName: "", Email: "", Password: "", Roles: [] });
  const set = (key: keyof NewAccount, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <Modal title="Create account" onClose={onClose}>
      <form className="record-form" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <div className="field-pair">
          <label><span>First name</span><input required maxLength={50} value={form.FName} onChange={(e) => set("FName", e.target.value)} /></label>
          <label><span>Last name</span><input required maxLength={50} value={form.LName} onChange={(e) => set("LName", e.target.value)} /></label>
        </div>
        <label><span>Email (used to log in)</span><input required type="email" maxLength={100} value={form.Email} onChange={(e) => set("Email", e.target.value)} /></label>
        <label><span>Temporary password (at least 8 characters)</span><input required type="password" minLength={8} autoComplete="new-password" value={form.Password} onChange={(e) => set("Password", e.target.value)} /></label>
        <fieldset className="role-choices">
          <legend>Roles (everyone is a User)</legend>
          {roles.map((role) => (
            <label key={role}>
              <input type="checkbox" checked={form.Roles.includes(role)} onChange={(e) => setForm((f) => ({ ...f, Roles: e.target.checked ? [...f.Roles, role] : f.Roles.filter((r) => r !== role) }))} />
              <span><strong>{role}</strong> · {ROLE_HELP[role]}</span>
            </label>
          ))}
        </fieldset>
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="primary-button" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
        </div>
      </form>
    </Modal>
  );
}
