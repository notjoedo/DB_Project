"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CalendarDays,
  Database,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  UserRoundCheck,
} from "lucide-react";

type TableName =
  | "Organization"
  | "Users"
  | "VolunteerOpportunity"
  | "OrganizationMember"
  | "Registration";
type Snapshot = {
  counts: { TableName: string; RowCount: number }[];
  tables: Record<TableName, Record<string, any>[]>;
  lookups: {
    organizations: { id: number; label: string }[];
    users: { id: number; label: string }[];
    opportunities: { id: number; label: string }[];
    roles: { RoleID: number; RoleName: string }[];
  };
  admin?: { email: string; fullName?: string | null };
};

const tableInfo: Record<
  TableName,
  {
    label: string;
    singular: string;
    id: string;
    icon: any;
    columns: { key: string; label: string }[];
  }
> = {
  Organization: {
    label: "Organizations",
    singular: "organization",
    id: "OrgID",
    icon: Building2,
    columns: [
      { key: "OrgID", label: "ID" },
      { key: "Name", label: "Name" },
      { key: "Type", label: "Type" },
      { key: "ContactEmail", label: "Contact email" },
    ],
  },
  Users: {
    label: "Users",
    singular: "user",
    id: "UserID",
    icon: Users,
    columns: [
      { key: "UserID", label: "ID" },
      { key: "FName", label: "First name" },
      { key: "LName", label: "Last name" },
      { key: "Email", label: "Email" },
      { key: "Roles", label: "Roles" },
    ],
  },
  VolunteerOpportunity: {
    label: "Opportunities",
    singular: "opportunity",
    id: "OpportunityID",
    icon: CalendarDays,
    columns: [
      { key: "OpportunityID", label: "ID" },
      { key: "Organization", label: "Organization" },
      { key: "Title", label: "Title" },
      { key: "EventDate", label: "Event date" },
      { key: "Location", label: "Location" },
      { key: "SignUps", label: "Sign-ups" },
    ],
  },
  OrganizationMember: {
    label: "Members",
    singular: "organization member",
    id: "MembershipID",
    icon: UserRoundCheck,
    columns: [
      { key: "MembershipID", label: "ID" },
      { key: "Organization", label: "Organization" },
      { key: "Member", label: "Member" },
      { key: "JoinDate", label: "Join date" },
      { key: "OrgRole", label: "Role" },
    ],
  },
  Registration: {
    label: "Registrations",
    singular: "registration",
    id: "RegistrationID",
    icon: ShieldCheck,
    columns: [
      { key: "RegistrationID", label: "ID" },
      { key: "Volunteer", label: "Volunteer" },
      { key: "Opportunity", label: "Opportunity" },
      { key: "RegistrationDate", label: "Registered" },
      { key: "Status", label: "Status" },
      { key: "HoursLogged", label: "Hours" },
    ],
  },
};

const emptyData = (): Snapshot => ({
  counts: [],
  tables: {
    Organization: [],
    Users: [],
    VolunteerOpportunity: [],
    OrganizationMember: [],
    Registration: [],
  },
  lookups: { organizations: [], users: [], opportunities: [], roles: [] },
});
const today = () => new Date().toISOString().slice(0, 10);

export default function Treefinder({
  user,
}: {
  user: { id: string; name: string; email: string } | null;
}) {
  const [view, setView] = useState<"overview" | "opportunities" | "admin">(
    "overview",
  );
  const [data, setData] = useState<Snapshot>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [table, setTable] = useState<TableName>("Organization");
  const [query, setQuery] = useState("");
  const [insertOpen, setInsertOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    table: TableName;
    id: number;
    name: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin-data");
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user, load]);

  function replaceSnapshot(j: any) {
    setData({ ...j.snapshot, admin: data.admin });
  }
  async function insertRecord(form: Record<string, any>) {
    setSaving(true);
    try {
      const r = await fetch("/api/admin-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, data: form }),
      });
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      replaceSnapshot(j);
      setInsertOpen(false);
      toast.success(
        `${tableInfo[table].singular[0].toUpperCase() + tableInfo[table].singular.slice(1)} inserted into the database.`,
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function deleteRecord() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: deleteTarget.table,
          id: deleteTarget.id,
        }),
      });
      const j: any = await r.json();
      if (!r.ok) throw new Error(j.error);
      replaceSnapshot(j);
      setDeleteTarget(null);
      toast.success("Record permanently deleted.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user)
    return (
      <div className="phase-login">
        <div className="brand-mark">
          <Leaf />
        </div>
        <p className="kicker">TREEFINDER DATABASE</p>
        <h1>Volunteer management, connected.</h1>
        <p>
          Sign in with the administrator account to view, insert, and delete
          records.
        </p>
        <a className="login-button" href="/signin-with-chatgpt?return_to=%2F">
          Sign in to continue
        </a>
      </div>
    );

  const counts = Object.fromEntries(
    data.counts.map((x) => [x.TableName, Number(x.RowCount)]),
  );
  const rows = data.tables[table] ?? [];
  const filtered = rows.filter((row) =>
    Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const upcoming = (data.tables.VolunteerOpportunity ?? [])
    .filter((x) => x.EventDate >= today())
    .slice(0, 6);
  const totalHours = (data.tables.Registration ?? []).reduce(
    (sum, row) => sum + Number(row.HoursLogged || 0),
    0,
  );
  const statusCounts = (data.tables.Registration ?? []).reduce(
    (acc: any, row) => ((acc[row.Status] = (acc[row.Status] || 0) + 1), acc),
    {},
  );

  return (
    <div className="phase-shell">
      <Toaster position="bottom-right" />
      <aside className="phase-sidebar">
        <div className="phase-brand">
          <span>
            <Leaf />
          </span>
          <strong>treefinder.</strong>
        </div>
        <nav aria-label="Main navigation">
          <button
            className={view === "overview" ? "active" : ""}
            onClick={() => setView("overview")}
          >
            <LayoutDashboard />
            Overview
          </button>
          <button
            className={view === "opportunities" ? "active" : ""}
            onClick={() => setView("opportunities")}
          >
            <CalendarDays />
            Opportunities
          </button>
          <button
            className={view === "admin" ? "active" : ""}
            onClick={() => setView("admin")}
          >
            <Database />
            Admin database
          </button>
        </nav>
        <div className="database-state">
          <span className={error ? "offline" : ""} />
          <div>
            <strong>
              {error ? "Database unavailable" : "Database connected"}
            </strong>
            <small>volunteer_db · 7 tables</small>
          </div>
        </div>
        <div className="phase-user">
          <span>{user.name[0].toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>Administrator</small>
          </div>
          <a href="/signout-with-chatgpt?return_to=%2F" aria-label="Sign out">
            <LogOut />
          </a>
        </div>
      </aside>
      <main className="phase-main">
        <header>
          <div>
            <p className="kicker">PHASE 2 · DATABASE OPERATIONS</p>
            <h1>
              {view === "overview"
                ? "Volunteer program overview"
                : view === "opportunities"
                  ? "Volunteer opportunities"
                  : "Admin database"}
            </h1>
            <p>
              {view === "admin"
                ? "View, insert, and permanently delete records from the major tables."
                : "Live information from the project database."}
            </p>
          </div>
          {view === "admin" && (
            <Button onClick={() => setInsertOpen(true)}>
              <Plus />
              Insert record
            </Button>
          )}
        </header>
        {error && (
          <div className="phase-error">
            <strong>Could not load the database.</strong>
            <span>{error}</span>
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          </div>
        )}
        {loading ? (
          <div className="phase-loading">
            <LoaderCircle className="animate-spin" />
            Reading database…
          </div>
        ) : view === "overview" ? (
          <>
            <section className="summary-grid">
              <Summary
                icon={Users}
                label="Users"
                value={counts.Users ?? 0}
                detail="sample volunteer profiles"
              />
              <Summary
                icon={Building2}
                label="Organizations"
                value={counts.Organization ?? 0}
                detail="community partners"
              />
              <Summary
                icon={CalendarDays}
                label="Opportunities"
                value={counts.VolunteerOpportunity ?? 0}
                detail="past and upcoming events"
              />
              <Summary
                icon={UserRoundCheck}
                label="Registrations"
                value={counts.Registration ?? 0}
                detail={`${totalHours.toFixed(1)} volunteer hours logged`}
              />
            </section>
            <section className="overview-grid">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Upcoming opportunities</h2>
                    <p>Joined with organization and registration data</p>
                  </div>
                  <button onClick={() => setView("opportunities")}>
                    View all
                  </button>
                </div>
                <div className="event-list">
                  {upcoming.map((event) => (
                    <article key={event.OpportunityID}>
                      <time>
                        <strong>
                          {new Date(
                            event.EventDate + "T12:00:00",
                          ).toLocaleDateString("en-US", { month: "short" })}
                        </strong>
                        <span>
                          {new Date(event.EventDate + "T12:00:00").getDate()}
                        </span>
                      </time>
                      <div>
                        <h3>{event.Title}</h3>
                        <p>
                          {event.Organization} · {event.Location}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {event.SignUps} registered
                      </Badge>
                    </article>
                  ))}
                </div>
              </div>
              <div className="panel status-panel">
                <h2>Registration status</h2>
                <p>Current rows grouped by status</p>
                {["Completed", "Confirmed", "Pending", "Cancelled"].map((s) => (
                  <div className="status-row" key={s}>
                    <span>
                      <i className={s.toLowerCase()} />
                      {s}
                    </span>
                    <strong>{statusCounts[s] ?? 0}</strong>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    setTable("Registration");
                    setView("admin");
                  }}
                >
                  Open registrations
                </Button>
              </div>
            </section>
          </>
        ) : view === "opportunities" ? (
          <section className="panel opportunity-panel">
            <div className="panel-head">
              <div>
                <h2>All opportunities</h2>
                <p>
                  {data.tables.VolunteerOpportunity.length} database records
                </p>
              </div>
            </div>
            <div className="opportunity-cards">
              {data.tables.VolunteerOpportunity.map((event) => (
                <article key={event.OpportunityID}>
                  <div className="event-date">
                    {new Date(event.EventDate + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </div>
                  <h3>{event.Title}</h3>
                  <p>
                    <Building2 /> {event.Organization}
                  </p>
                  <p>
                    <CalendarDays /> {event.Location}
                  </p>
                  <span>{event.SignUps} registrations</span>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="admin-intro">
              <div>
                <Database />
                <span>
                  <strong>MySQL schema</strong>
                  <small>
                    The interface follows volunteer_db.sql without changing that
                    file.
                  </small>
                </span>
              </div>
              <div>
                <ShieldCheck />
                <span>
                  <strong>Permanent deletes</strong>
                  <small>Foreign-key cascade rules remain in effect.</small>
                </span>
              </div>
            </section>
            <section className="panel admin-panel">
              <Tabs
                value={table}
                onValueChange={(v) => {
                  setTable(v as TableName);
                  setQuery("");
                }}
              >
                <TabsList>
                  {(Object.keys(tableInfo) as TableName[]).map((name) => {
                    const Icon = tableInfo[name].icon;
                    return (
                      <TabsTrigger key={name} value={name}>
                        <Icon />
                        {tableInfo[name].label}
                        <span>{data.tables[name].length}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
              <div className="admin-toolbar">
                <label>
                  <Search />
                  <Input
                    aria-label={`Search ${tableInfo[table].label}`}
                    placeholder={`Search ${tableInfo[table].label.toLowerCase()}…`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <Button onClick={() => setInsertOpen(true)}>
                  <Plus />
                  Add {tableInfo[table].singular}
                </Button>
              </div>
              <div className="data-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {tableInfo[table].columns.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                      <TableHead className="action-col">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row[tableInfo[table].id]}>
                        {tableInfo[table].columns.map((c) => (
                          <TableCell key={c.key}>
                            {c.key === "Status" ? (
                              <Badge variant="outline">{row[c.key]}</Badge>
                            ) : (
                              String(row[c.key] ?? "—")
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="action-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="delete-button"
                            aria-label={`Delete ${tableInfo[table].singular}`}
                            onClick={() =>
                              setDeleteTarget({
                                table,
                                id: Number(row[tableInfo[table].id]),
                                name:
                                  row.Name ||
                                  row.Title ||
                                  row.Member ||
                                  row.Volunteer ||
                                  `record ${row[tableInfo[table].id]}`,
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell
                          colSpan={tableInfo[table].columns.length + 1}
                          className="empty-cell"
                        >
                          No matching records.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <footer className="table-footer">
                Showing {filtered.length} of {rows.length} rows in{" "}
                <code>{table}</code>
              </footer>
            </section>
          </>
        )}
      </main>
      <InsertDialog
        table={table}
        data={data}
        open={insertOpen}
        saving={saving}
        onOpenChange={setInsertOpen}
        onSave={insertRecord}
      />
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be removed from{" "}
              <code>{deleteTarget?.table}</code>. This cannot be undone. Related
              records may also be deleted according to the foreign-key cascade
              rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="confirm-delete"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                deleteRecord();
              }}
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: any;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="summary-card">
      <span>
        <Icon />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function InsertDialog({
  table,
  data,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  table: TableName;
  data: Snapshot;
  open: boolean;
  saving: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (v: Record<string, any>) => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  useEffect(() => {
    if (open)
      setForm(
        table === "OrganizationMember"
          ? { JoinDate: today(), OrgRole: "Member" }
          : table === "Registration"
            ? { RegistrationDate: today(), Status: "Pending", HoursLogged: 0 }
            : {},
      );
  }, [open, table]);
  const set = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="insert-dialog">
        <DialogHeader>
          <DialogTitle>Insert {tableInfo[table].singular}</DialogTitle>
          <DialogDescription>
            This creates a new row in the <code>{table}</code> table.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="insert-form">
          {table === "Organization" && (
            <>
              <Field label="Organization name">
                <Input
                  required
                  maxLength={100}
                  value={form.Name ?? ""}
                  onChange={(e) => set("Name", e.target.value)}
                />
              </Field>
              <Field label="Type">
                <SelectInput
                  required
                  value={form.Type ?? ""}
                  onChange={(e) => set("Type", e.target.value)}
                  options={[
                    "Nonprofit",
                    "Government",
                    "School",
                    "Community Group",
                    "Business",
                  ]}
                />
              </Field>
              <Field label="Contact email">
                <Input
                  required
                  type="email"
                  maxLength={100}
                  value={form.ContactEmail ?? ""}
                  onChange={(e) => set("ContactEmail", e.target.value)}
                />
              </Field>
            </>
          )}
          {table === "Users" && (
            <>
              <div className="form-pair">
                <Field label="First name">
                  <Input
                    required
                    maxLength={50}
                    value={form.FName ?? ""}
                    onChange={(e) => set("FName", e.target.value)}
                  />
                </Field>
                <Field label="Last name">
                  <Input
                    required
                    maxLength={50}
                    value={form.LName ?? ""}
                    onChange={(e) => set("LName", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Email">
                <Input
                  required
                  type="email"
                  maxLength={100}
                  value={form.Email ?? ""}
                  onChange={(e) => set("Email", e.target.value)}
                />
              </Field>
              <p className="form-note">
                New users receive the base User role automatically.
              </p>
            </>
          )}
          {table === "VolunteerOpportunity" && (
            <>
              <Field label="Organization">
                <LookupSelect
                  value={form.OrgID ?? ""}
                  onChange={(v) => set("OrgID", v)}
                  options={data.lookups.organizations}
                />
              </Field>
              <Field label="Title">
                <Input
                  required
                  maxLength={150}
                  value={form.Title ?? ""}
                  onChange={(e) => set("Title", e.target.value)}
                />
              </Field>
              <Field label="Event date">
                <Input
                  required
                  type="date"
                  value={form.EventDate ?? ""}
                  onChange={(e) => set("EventDate", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <Input
                  required
                  maxLength={150}
                  value={form.Location ?? ""}
                  onChange={(e) => set("Location", e.target.value)}
                />
              </Field>
            </>
          )}
          {table === "OrganizationMember" && (
            <>
              <Field label="Organization">
                <LookupSelect
                  value={form.OrgID ?? ""}
                  onChange={(v) => set("OrgID", v)}
                  options={data.lookups.organizations}
                />
              </Field>
              <Field label="User">
                <LookupSelect
                  value={form.UserID ?? ""}
                  onChange={(v) => set("UserID", v)}
                  options={data.lookups.users}
                />
              </Field>
              <div className="form-pair">
                <Field label="Join date">
                  <Input
                    required
                    type="date"
                    value={form.JoinDate ?? ""}
                    onChange={(e) => set("JoinDate", e.target.value)}
                  />
                </Field>
                <Field label="Organization role">
                  <SelectInput
                    required
                    value={form.OrgRole ?? "Member"}
                    onChange={(e) => set("OrgRole", e.target.value)}
                    options={["Member", "Coordinator", "Officer", "Director"]}
                  />
                </Field>
              </div>
            </>
          )}
          {table === "Registration" && (
            <>
              <Field label="User">
                <LookupSelect
                  value={form.UserID ?? ""}
                  onChange={(v) => set("UserID", v)}
                  options={data.lookups.users}
                />
              </Field>
              <Field label="Opportunity">
                <LookupSelect
                  value={form.OpportunityID ?? ""}
                  onChange={(v) => set("OpportunityID", v)}
                  options={data.lookups.opportunities}
                />
              </Field>
              <div className="form-pair">
                <Field label="Registration date">
                  <Input
                    required
                    type="date"
                    value={form.RegistrationDate ?? ""}
                    onChange={(e) => set("RegistrationDate", e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <SelectInput
                    required
                    value={form.Status ?? "Pending"}
                    onChange={(e) => set("Status", e.target.value)}
                    options={["Pending", "Confirmed", "Cancelled", "Completed"]}
                  />
                </Field>
              </div>
              <Field label="Hours logged">
                <Input
                  required
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={form.HoursLogged ?? 0}
                  onChange={(e) => set("HoursLogged", Number(e.target.value))}
                />
              </Field>
            </>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Plus />}
              Insert row
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function SelectInput({
  value,
  onChange,
  options,
  required,
}: {
  value: any;
  onChange: (e: any) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <select required={required} value={value} onChange={onChange}>
      <option value="" disabled>
        Select…
      </option>
      {options.map((x) => (
        <option key={x} value={x}>
          {x}
        </option>
      ))}
    </select>
  );
}
function LookupSelect({
  value,
  onChange,
  options,
}: {
  value: any;
  onChange: (v: string) => void;
  options: { id: number; label: string }[];
}) {
  return (
    <select required value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        Select…
      </option>
      {options.map((x) => (
        <option key={x.id} value={x.id}>
          {x.label}
        </option>
      ))}
    </select>
  );
}
