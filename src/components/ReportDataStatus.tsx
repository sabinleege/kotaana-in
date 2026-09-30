"use client";
import { useEffect, useState } from "react";

type Source = { label: string; count: number; available: boolean };
type Report = { status: "complete" | "partial" | "insufficient"; statusLabel: string; missing: string[]; sources: Source[]; generatedAt: string };

export default function ReportDataStatus({ compact = false }: { compact?: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => { fetch("/api/reports/overview").then(r => r.ok ? r.json() : null).then(d => setReport(d?.report ?? null)).catch(() => setReport(null)); }, []);
  if (!report) return null;
  const tone = report.status === "complete" ? "statusGood" : report.status === "partial" ? "statusWarn" : "statusNeutral";
  return <div className={`dataStatus ${tone} ${compact ? "compact" : ""}`}>
    <div className="dataStatusHead"><div><div className="eyebrow">REPORT DATA</div><strong>{report.statusLabel}</strong></div><span className="statusDot" /></div>
    <p>{report.status === "complete" ? "This report is calculated from the available recorded data." : report.status === "partial" ? "This report uses recorded data, but some data sources are still missing." : "There is not enough recorded data for a complete report yet."}</p>
    {!compact && report.missing.length > 0 && <div className="missingList"><span>Not recorded:</span> {report.missing.join(" · ")}</div>}
  </div>;
}
