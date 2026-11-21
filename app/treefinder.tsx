"use client";

import { useEffect, useState } from "react";
import { AuthProvider, apiFetch, useAuth } from "./auth-client";
import PlantingMap from "./planting-map";
import ManageEventsPage from "./manage-events";
import ManageOrgsPage from "./manage-orgs";
import PeoplePage from "./people";
import ProfilePage from "./profile";
import ReportsPage from "./reports";

// The interface is organized by task, not by table: each page below does one job
// (and may touch several tables behind the scenes).
type View = "map" | "profile" | "reports" | "people" | "events" | "orgs";

export default function Treefinder() {
  return <AuthProvider><App /></AuthProvider>;
}

function App() {
  const { user, ready, hasRole, promptLogin, logout } = useAuth();
  const isAdmin = hasRole("Admin");
  const [view, setView] = useState<View>("map");
  // Whether this user runs at least one organization (Admin, an Organizer member, or an org's Coordinator/Officer/Director).
  const [canManage, setCanManage] = useState(false);
  // Fall back to the map when a page isn't available to this visitor.
  const shown: View = (view === "people" && !isAdmin) || ((view === "profile" || view === "reports") && !user)
    || ((view === "events" || view === "orgs") && !(user && canManage)) ? "map" : view;

  // Show the Manage tabs only to people who run at least one organization.
  useEffect(() => {
    if (!user) return;
    let current = true;
    apiFetch("/api/manage/events")
      .then(async (response) => {
        const result = (await response.json()) as { orgs?: unknown[] };
        if (current) setCanManage(response.ok && Boolean(result.orgs?.length));
      })
      .catch(() => { if (current) setCanManage(false); });
    return () => { current = false; };
  }, [user]);

  const tab = (name: View, label: string) => <button className={shown === name ? "active" : ""} onClick={() => setView(name)}>{label}</button>;

  return (
    <main className="page">
      <header className="topbar">
        <div><img className="brand-logo" src="/logo.png" alt="Three Trees Tree Conservation" /></div>
        <nav className="nav-tabs" aria-label="Views">
          {tab("map", "Planting Map")}
          {user && tab("reports", "Reports")}
        </nav>
        {user && (canManage || isAdmin) && <nav className="nav-tabs manage-tabs" aria-label="Manage">
          {canManage && <>{tab("events", "Manage Events")}{tab("orgs", "Manage Organizations")}</>}
          {isAdmin && tab("people", "Users and Roles")}
          <span className="nav-divider" aria-hidden="true" />
        </nav>}
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
      <section className="content narrow">
        <div className="title-row"><h1>My Profile</h1></div>
        <ProfilePage />
      </section>
      ) : shown === "reports" ? (
      <section className="content">
        <div className="title-row">
          <h1>Reports</h1>
          <span className="subtitle">Statistics for your roles · each report lists the SQL aggregates it uses</span>
        </div>
        <ReportsPage />
      </section>
      ) : shown === "events" ? (
      <section className="content">
        <div className="title-row">
          <h1>Manage Events</h1>
          <span className="subtitle">Edit or delete your organizations&apos; events, take attendance, and log volunteer hours</span>
        </div>
        <ManageEventsPage onSchedule={() => setView("map")} />
      </section>
      ) : shown === "orgs" ? (
      <section className="content">
        <div className="title-row">
          <h1>Manage Organizations</h1>
          <span className="subtitle">Add people to organizations, set their role in each, and keep contact details current</span>
        </div>
        <ManageOrgsPage />
      </section>
      ) : shown === "people" ? (
      <section className="content">
        <div className="title-row">
          <h1>Users and Roles</h1>
          <span className="subtitle">Create accounts and grant or remove Organizer, Arborist, and Admin roles</span>
        </div>
        <PeoplePage />
      </section>
      ) : (
      <section className="content">
        <div className="title-row">
          <h1>Planting Map</h1>
          <span className="subtitle">Blacksburg, VA · sites ranked by canopy gap, paved surface, and heat</span>
        </div>
        <PlantingMap canSchedule={Boolean(user) && canManage} />
      </section>
      )}
    </main>
  );
}
