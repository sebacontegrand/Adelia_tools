"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Edit3,
  Loader2,
  ShieldAlert,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ReviewItem {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  adCapture: {
    id: string;
    brand: string | null;
    campaignName: string | null;
    adFormat: string | null;
    widthPx: number;
    heightPx: number;
    ocrText: string | null;
    confidenceScore: number;
    imageKey: string;
    page: {
      section: string | null;
      sourceUrl: string | null;
      edition: {
        editionDate: string;
        newspaper: { name: string; slug: string };
      };
    };
  };
}

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<{
    brand?: string;
    campaignName?: string;
    adFormat?: string;
  }>({});

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/review?status=pending&page=${page}&limit=10`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleAction = async (reviewItemId: string, action: string, corr?: typeof corrections) => {
    setActionLoading(reviewItemId);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewItemId,
          action,
          corrections: corr || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Remove from list
        setItems((prev) => prev.filter((i) => i.id !== reviewItemId));
        setTotal((t) => t - 1);
      }
    } catch (error) {
      console.error("Review action failed:", error);
    } finally {
      setActionLoading(null);
      setEditingId(null);
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "low_confidence": return "Low Confidence";
      case "new_brand": return "New Brand";
      case "low_ocr_quality": return "Low OCR Quality";
      case "needs_verification": return "Needs Verification";
      default: return reason;
    }
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
                  Review Queue
                </h1>
                <p className="text-xs text-white/50">
                  {total} items pending review
                </p>
              </div>
            </div>
            <a
              href="/ads"
              className="text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              ← Back to Ads
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-white/40" size={32} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <CheckCircle size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm mt-1">No ads pending review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5"
              >
                <div className="flex items-start gap-6">
                  {/* Ad image placeholder */}
                  <div className="w-48 h-32 bg-white/10 rounded-lg flex items-center justify-center text-white/20 shrink-0">
                    <Eye size={32} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                        {getReasonLabel(item.reason)}
                      </span>
                      <span className={`text-xs font-medium ${getConfidenceColor(item.adCapture.confidenceScore)}`}>
                        {Math.round(item.adCapture.confidenceScore * 100)}% confidence
                      </span>
                    </div>

                    {editingId === item.id ? (
                      <div className="space-y-2 mb-3">
                        <input
                          type="text"
                          placeholder="Brand"
                          defaultValue={item.adCapture.brand || ""}
                          onChange={(e) => setCorrections((c) => ({ ...c, brand: e.target.value }))}
                          className="w-full bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none border border-white/20 focus:border-violet-500"
                        />
                        <input
                          type="text"
                          placeholder="Campaign name"
                          defaultValue={item.adCapture.campaignName || ""}
                          onChange={(e) => setCorrections((c) => ({ ...c, campaignName: e.target.value }))}
                          className="w-full bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none border border-white/20 focus:border-violet-500"
                        />
                        <input
                          type="text"
                          placeholder="Ad format"
                          defaultValue={item.adCapture.adFormat || ""}
                          onChange={(e) => setCorrections((c) => ({ ...c, adFormat: e.target.value }))}
                          className="w-full bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none border border-white/20 focus:border-violet-500"
                        />
                      </div>
                    ) : (
                      <div className="mb-3">
                        <h3 className="font-semibold text-lg">
                          {item.adCapture.brand || "Unknown Brand"}
                        </h3>
                        <p className="text-white/60 text-sm">
                          {item.adCapture.campaignName || "No campaign name"} ·{" "}
                          {item.adCapture.adFormat || "Display"} · {item.adCapture.widthPx}×{item.adCapture.heightPx}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
                      <span>{item.adCapture.page.edition.newspaper.name}</span>
                      <span>·</span>
                      <span>{item.adCapture.page.section || "Home"}</span>
                      <span>·</span>
                      <span>{new Date(item.adCapture.page.edition.editionDate).toLocaleDateString()}</span>
                    </div>

                    {item.adCapture.ocrText && (
                      <details className="mb-3">
                        <summary className="text-xs text-white/50 cursor-pointer hover:text-white/70">
                          OCR Text
                        </summary>
                        <p className="mt-1 text-xs text-white/40 bg-white/5 rounded-lg p-2 max-h-20 overflow-y-auto">
                          {item.adCapture.ocrText}
                        </p>
                      </details>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {editingId === item.id ? (
                        <>
                          <button
                            onClick={() => handleAction(item.id, "corrected", corrections)}
                            disabled={actionLoading === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 rounded-lg text-xs font-medium hover:bg-violet-500 transition-all disabled:opacity-50"
                          >
                            {actionLoading === item.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle size={12} />
                            )}
                            Save Corrections
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setCorrections({}); }}
                            className="text-xs text-white/50 hover:text-white/80"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(item.id, "approved")}
                            disabled={actionLoading === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/80 rounded-lg text-xs font-medium hover:bg-green-500 transition-all disabled:opacity-50"
                          >
                            <CheckCircle size={12} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(item.id, "rejected")}
                            disabled={actionLoading === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 rounded-lg text-xs font-medium hover:bg-red-500 transition-all disabled:opacity-50"
                          >
                            <XCircle size={12} />
                            Reject
                          </button>
                          <button
                            onClick={() => setEditingId(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-xs font-medium hover:bg-white/20 transition-all"
                          >
                            <Edit3 size={12} />
                            Edit & Approve
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-white/60">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
