"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  StopCircle,
  Trash2,
  FileText,
  X,
} from "lucide-react";

interface CaptureJob {
  id: string;
  targetDate: string;
  status: string;
  adsFound: number;
  adsReviewed: number;
  avgConfidence: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  newspaper: { name: string; slug: string };
  _count: { logs: number };
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<CaptureJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsJobId, setLogsJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ id: string; level: string; message: string; createdAt: string }[]>([]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/capture?limit=30");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStop = async (id: string) => {
    try {
      await fetch(`/api/capture/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      fetchJobs();
    } catch (error) {
      console.error("Failed to stop job:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      await fetch(`/api/capture/${id}`, {
        method: "DELETE",
      });
      fetchJobs();
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  };

  const openLogs = async (id: string) => {
    setLogsOpen(true);
    setLogsJobId(id);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/capture/${id}/logs?limit=200`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="text-green-400" size={16} />;
      case "failed":
        return <XCircle className="text-red-400" size={16} />;
      case "running":
        return <Loader2 className="text-blue-400 animate-spin" size={16} />;
      case "queued":
        return <Clock className="text-amber-400" size={16} />;
      case "cancelled":
        return <StopCircle className="text-white/40" size={16} />;
      default:
        return <Clock className="text-white/40" size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-500/20 text-green-400",
      failed: "bg-red-500/20 text-red-400",
      running: "bg-blue-500/20 text-blue-400",
      queued: "bg-amber-500/20 text-amber-400",
      cancelled: "bg-white/10 text-white/50",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${colors[status] || "bg-white/10 text-white/50"}`}>
        {status}
      </span>
    );
  };

  const getDuration = (start: string | null, end: string | null) => {
    if (!start) return "-";
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const secs = Math.round((e - s) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "text-green-400";
    if (score >= 0.5) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Activity size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-tight">
                  Scrapping news
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
                  Monitor de Ejecución
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchJobs}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-all"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <a
                href="/ads"
                className="text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                ← Back to Ads
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {logsOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-gray-950 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={16} className="text-white/60" />
                  <span className="text-white/80">Logs</span>
                  <span className="text-white/30 font-mono text-xs">{logsJobId}</span>
                </div>
                <button
                  onClick={() => setLogsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/70"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-white/40" size={28} />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-10 text-center text-white/40 text-sm">No logs</div>
                ) : (
                  <div className="p-4 space-y-2">
                    {logs.map((l) => (
                      <div key={l.id} className="text-xs font-mono border border-white/10 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-white/60">
                          <span className="uppercase">{l.level}</span>
                          <span>{new Date(l.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-white/80 whitespace-pre-wrap">{l.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-white/40" size={32} />
          </div>
        ) : jobs.length === 0 ? (
            <div className="text-center py-24 text-white/40 animate-in fade-in zoom-in duration-700">
              <div className="relative mb-6 inline-block">
                <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full"></div>
                <Activity size={64} className="relative mx-auto opacity-20" />
              </div>
              <p className="text-xl font-medium text-white/60">No hay procesos activos</p>
              <p className="text-sm mt-2 text-white/30 max-w-xs mx-auto">
                Los procesos de captura y extracción aparecerán aquí una vez iniciados.
              </p>
            </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs">
                  <th className="text-left px-4 py-3"></th>
                  <th className="text-left px-4 py-3">Newspaper</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ads</th>
                  <th className="text-right px-4 py-3">Confidence</th>
                  <th className="text-right px-4 py-3">Duration</th>
                  <th className="text-right px-4 py-3">Logs</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">{getStatusIcon(job.status)}</td>
                    <td className="px-4 py-3 font-medium">{job.newspaper.name}</td>
                    <td className="px-4 py-3 text-white/60">
                      {new Date(job.targetDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-4 py-3 text-right font-mono">{job.adsFound}</td>
                    <td className={`px-4 py-3 text-right font-medium ${job.avgConfidence > 0 ? getConfidenceColor(job.avgConfidence) : "text-white/30"}`}>
                      {job.avgConfidence > 0 ? `${Math.round(job.avgConfidence * 100)}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/60 font-mono text-xs">
                      {getDuration(job.startedAt, job.completedAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/40">
                      <button
                        onClick={() => openLogs(job.id)}
                        className="inline-flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                        title="View Logs"
                      >
                        <FileText size={14} className="text-white/50" />
                        <span>{job._count.logs}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(job.status === "running" || job.status === "queued") && (
                          <button
                            onClick={() => handleStop(job.id)}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-amber-400/70 hover:text-amber-400 transition-colors"
                            title="Stop Job"
                          >
                            <StopCircle size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-red-400/70 hover:text-red-400 transition-colors"
                          title="Delete Job"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
