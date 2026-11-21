"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./auth-client";

type Value = string | number | null;
type Column = { key: string; label: string; format?: "text" | "number" | "hours" | "date" | "month" };
type Report = {
  id: string; title: string; description: string; aggregates: string[]; layout: "stats" | "table";
  columns: Column[]; chart: { label: string; value: string } | null; rows: Record<string, Value>[];
};
type Group = { id: string; label: string; description: string; reports: Report[] };


function show(value: Value, format: Column["format"]) {
  if (value === null || value === "") return "—";
  if (format === "date") return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (format === "month") return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (format === "hours") return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })} hrs`;
  if (format === "number") return Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 });
  return String(value);
}

export default function ReportsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/reports")
      .then(async (response) => {
        const result = (await response.json()) as { groups: Group[]; error?: string };
        if (!response.ok) throw new Error(result.error);
        setGroups(result.groups);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load reports."));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!groups.length) return <p className="state">Loading reports...</p>;
  const group = groups.find((g) => g.id === active) ?? groups[0];

  return (
    <div className="reports">
      <nav className="panel-tabs" aria-label="Report groups">
        {groups.map((g) => (
          <button key={g.id} className={g.id === group.id ? "active" : ""} onClick={() => setActive(g.id)}>
            {g.label}<span>{g.reports.length}</span>
          </button>
        ))}
      </nav>
      <p className="site-meta">{group.description}</p>
      <div className="report-grid">
        {group.reports.map((report) => <ReportCard key={report.id} report={report} />)}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const wide = report.layout === "stats";
  return (
    <section className={`report-card${wide ? " wide" : ""}`}>
      <header>
        <h2>{report.title}</h2>
        <div className="agg-list" aria-label="SQL aggregate functions used">
          {report.aggregates.map((agg) => <span key={agg} className="agg-tag">{agg}</span>)}
        </div>
      </header>
      <p className="site-meta">{report.description}</p>
      {!report.rows.length ? <p className="site-meta">No data yet.</p>
        : report.layout === "stats" ? <Stats report={report} />
        : <>
          {/* A chart already shows each row's label and value, so a table is only used when there's no chart. */}
          {report.chart ? <BarChart report={report} /> : <ReportTable report={report} />}
        </>}
    </section>
  );
}

function Stats({ report }: { report: Report }) {
  const row = report.rows[0];
  return (
    <dl className="site-stats report-stats">
      {report.columns.map((column) => (
        <div key={column.key}><dt>{column.label}</dt><dd>{show(row[column.key], column.format)}</dd></div>
      ))}
    </dl>
  );
}

function BarChart({ report }: { report: Report }) {
  const { label, value } = report.chart!;
  const labelColumn = report.columns.find((c) => c.key === label);
  const valueColumn = report.columns.find((c) => c.key === value);
  const rows = report.rows;
  // The chart draws one column; the other columns (e.g. COUNT and AVG results) are listed under each label.
  const extras = report.columns.filter((c) => c.key !== label && c.key !== value);
  const max = Math.max(1, ...rows.map((row) => Number(row[value]) || 0));
  return (
    <div className="bar-chart" role="img" aria-label={`${valueColumn?.label} by ${labelColumn?.label}`}>
      <small>{valueColumn?.label} by {labelColumn?.label?.toLowerCase()}{rows.length > 8 && ` · ${rows.length} rows, scroll for more`}</small>
      <div className="bar-rows">{rows.map((row, i) => (
        <div key={i} className="bar-row">
          <span title={String(row[label])}>{show(row[label], labelColumn?.format)}
            {extras.length > 0 && <small>{extras.map((c) => `${c.label}: ${show(row[c.key], c.format)}`).join(" · ")}</small>}
          </span>
          <div className="bar-track"><i style={{ width: `${((Number(row[value]) || 0) / max) * 100}%` }} /></div>
          <strong>{show(row[value], valueColumn?.format)}</strong>
        </div>
      ))}</div>
    </div>
  );
}

function ReportTable({ report }: { report: Report }) {
  return (
    <div className="report-table">
      <table>
        <thead><tr>{report.columns.map((c) => <th key={c.key} className={c.format && c.format !== "text" && c.format !== "month" && c.format !== "date" ? "num" : ""}>{c.label}</th>)}</tr></thead>
        <tbody>
          {report.rows.map((row, i) => (
            <tr key={i}>{report.columns.map((c) => (
              <td key={c.key} className={c.format === "number" || c.format === "hours" ? "num" : ""}>{show(row[c.key], c.format)}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
