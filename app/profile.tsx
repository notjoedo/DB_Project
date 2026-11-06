"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, updateStoredUser, useAuth, type User } from "./auth-client";

type Profile = {
  user: User;
  memberships: { OrgID: number; Organization: string; OrgRole: string; JoinDate: string }[];
  registrations: { RegistrationID: number; OpportunityID: number; Title: string; EventDate: string; Organization: string; Status: string; HoursLogged: number; Upcoming: boolean }[];
  scheduled: { OpportunityID: number; Title: string; EventDate: string; Organization: string; SignUps: number }[];
};

const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState({ FName: "", LName: "", Email: "", CurrentPassword: "" });
  const [passwords, setPasswords] = useState({ CurrentPassword: "", NewPassword: "", Confirm: "" });

  const apply = useCallback((result: Profile) => {
    setProfile(result);
    setDetails({ FName: result.user.FName, LName: result.user.LName, Email: result.user.Email, CurrentPassword: "" });
    updateStoredUser(result.user);
  }, []);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(async (response) => {
        const result = (await response.json()) as Profile & { error?: string };
        if (!response.ok) throw new Error(result.error);
        apply(result);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your profile."));
  }, [apply]);

  async function save(body: object, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      const result = (await response.json()) as Profile & { error?: string };
      if (!response.ok) throw new Error(result.error);
      apply(result);
      setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function cancelSignUp(opportunityId: number, title: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/registrations", { method: "DELETE", body: JSON.stringify({ OpportunityID: opportunityId }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      const refreshed = await apiFetch("/api/auth/me");
      apply((await refreshed.json()) as Profile);
      setMessage(`Your sign-up for ${title} was cancelled.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  if (!profile) return error ? <p className="error">{error}</p> : <p className="state">Loading your profile...</p>;
  const emailChanged = details.Email.trim().toLowerCase() !== profile.user.Email;

  return (
    <div className="profile-grid">
      <section className="profile-card">
        <h2>Account</h2>
        <div className="role-list">{profile.user.roles.map((role) => <span key={role} className={`role-tag ${role.toLowerCase()}`}>{role}</span>)}</div>
        <form className="record-form" onSubmit={async (e) => {
          e.preventDefault();
          if (await save(details, "Your details were saved.")) setDetails((d) => ({ ...d, CurrentPassword: "" }));
        }}>
          <div className="field-pair">
            <label><span>First name</span><input required maxLength={50} value={details.FName} onChange={(e) => setDetails({ ...details, FName: e.target.value })} /></label>
            <label><span>Last name</span><input required maxLength={50} value={details.LName} onChange={(e) => setDetails({ ...details, LName: e.target.value })} /></label>
          </div>
          <label><span>Email</span><input required type="email" maxLength={100} value={details.Email} onChange={(e) => setDetails({ ...details, Email: e.target.value })} /></label>
          {emailChanged && <label><span>Current password (required to change email)</span>
            <input required type="password" autoComplete="current-password" value={details.CurrentPassword} onChange={(e) => setDetails({ ...details, CurrentPassword: e.target.value })} /></label>}
          <div className="modal-actions"><button className="primary-button" disabled={busy}>Save details</button></div>
        </form>

        <h3>Change password</h3>
        <form className="record-form" onSubmit={async (e) => {
          e.preventDefault();
          if (passwords.NewPassword !== passwords.Confirm) { setError("The new passwords don't match."); return; }
          if (await save({ CurrentPassword: passwords.CurrentPassword, NewPassword: passwords.NewPassword }, "Password changed. Other devices were signed out.")) {
            setPasswords({ CurrentPassword: "", NewPassword: "", Confirm: "" });
          }
        }}>
          <label><span>Current password</span><input required type="password" autoComplete="current-password" value={passwords.CurrentPassword} onChange={(e) => setPasswords({ ...passwords, CurrentPassword: e.target.value })} /></label>
          <div className="field-pair">
            <label><span>New password</span><input required type="password" minLength={8} autoComplete="new-password" value={passwords.NewPassword} onChange={(e) => setPasswords({ ...passwords, NewPassword: e.target.value })} /></label>
            <label><span>Confirm</span><input required type="password" minLength={8} autoComplete="new-password" value={passwords.Confirm} onChange={(e) => setPasswords({ ...passwords, Confirm: e.target.value })} /></label>
          </div>
          <div className="modal-actions"><button disabled={busy}>Change password</button><button type="button" onClick={logout}>Log out</button></div>
        </form>
      </section>

      <section className="profile-card">
        {message && <p className="notice">{message}</p>}
        {error && <p className="error">{error}</p>}
        <h2>My volunteering</h2>
        {profile.registrations.length ? (
          <ul className="plain-list">{profile.registrations.map((reg) => (
            <li key={reg.RegistrationID} className={reg.Status === "Cancelled" ? "cancelled" : ""}>
              <span><strong>{reg.Title}</strong><small>{reg.Organization} · {formatDate(reg.EventDate)}{reg.HoursLogged > 0 && ` · ${reg.HoursLogged} hrs`}</small></span>
              <span className="row-actions">{reg.Status}
                {reg.Upcoming && reg.Status !== "Cancelled" && <button className="delete-button" disabled={busy} onClick={() => cancelSignUp(reg.OpportunityID, reg.Title)}>Cancel</button>}
              </span>
            </li>
          ))}</ul>
        ) : <p className="site-meta">You haven&apos;t signed up for any events yet. Find one on the Planting Map.</p>}

        <h3>Organizations</h3>
        {profile.memberships.length ? (
          <ul className="plain-list">{profile.memberships.map((m) => (
            <li key={m.OrgID}><span><strong>{m.Organization}</strong><small>Joined {formatDate(m.JoinDate)}</small></span><span>{m.OrgRole}</span></li>
          ))}</ul>
        ) : <p className="site-meta">You aren&apos;t a member of any organization.</p>}

        {profile.scheduled.length > 0 && <>
          <h3>Events I scheduled</h3>
          <ul className="plain-list">{profile.scheduled.map((event) => (
            <li key={event.OpportunityID}><span><strong>{event.Title}</strong><small>{event.Organization} · {formatDate(event.EventDate)}</small></span><span>{event.SignUps} signed up</span></li>
          ))}</ul>
        </>}
      </section>
    </div>
  );
}
