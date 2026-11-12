"use client";

import { useState } from "react";
import { apiFetch } from "./auth-client";

export type VolunteerRequest = {
  RegistrationID: number; Volunteer: string; Email: string; RegistrationDate: string; Status: string;
  OpportunityID: number; Title: string; EventDate: string; Location: string; Organization: string;
};

const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Organizers review pending sign-ups for their organizations' upcoming events. */
export default function RequestsPage({ requests, error, onChange }: {
  requests: VolunteerRequest[]; error: string; onChange: (requests: VolunteerRequest[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");

  async function decide(request: VolunteerRequest, action: "accept" | "decline") {
    setBusy(true);
    setMessage("");
    setFailure("");
    try {
      const response = await apiFetch("/api/requests", { method: "PATCH", body: JSON.stringify({ RegistrationID: request.RegistrationID, action }) });
      const result = (await response.json()) as { error?: string; requests: VolunteerRequest[] };
      if (!response.ok) throw new Error(result.error);
      onChange(result.requests);
      setMessage(`${request.Volunteer} was ${action === "accept" ? "accepted for" : "declined for"} ${request.Title}.`);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not update the request.");
    } finally {
      setBusy(false);
    }
  }

  const pending = requests.filter((r) => r.Status === "Pending");
  const confirmed = requests.filter((r) => r.Status === "Confirmed");

  return (
    <div className="profile-grid">
      <section className="profile-card">
        {message && <p className="notice">{message}</p>}
        {(failure || error) && <p className="error">{failure || error}</p>}
        <h2>Pending requests <span className="site-meta">({pending.length})</span></h2>
        {pending.length ? (
          <ul className="plain-list">{pending.map((r) => (
            <li key={r.RegistrationID}>
              <span><strong>{r.Volunteer}</strong>
                <small>{r.Title} · {r.Organization} · {formatDate(r.EventDate)}</small>
                <small>{r.Email} · requested {formatDate(r.RegistrationDate)}</small>
              </span>
              <span className="row-actions">
                <button className="primary-button" disabled={busy} onClick={() => decide(r, "accept")}>Accept</button>
                <button className="delete-button" disabled={busy} onClick={() => decide(r, "decline")}>Decline</button>
              </span>
            </li>
          ))}</ul>
        ) : <p className="site-meta">No pending requests. New sign-ups for your organizations&apos; upcoming events will appear here.</p>}
      </section>

      <section className="profile-card">
        <h2>Confirmed volunteers</h2>
        {confirmed.length ? (
          <ul className="plain-list">{confirmed.map((r) => (
            <li key={r.RegistrationID}>
              <span><strong>{r.Volunteer}</strong><small>{r.Title} · {formatDate(r.EventDate)}</small></span>
              <span>{r.Organization}</span>
            </li>
          ))}</ul>
        ) : <p className="site-meta">No confirmed volunteers for upcoming events yet.</p>}
      </section>
    </div>
  );
}
