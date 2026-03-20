"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Calendar,
  Newspaper,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  Loader2,
  Filter,
  BarChart3,
  Download,
  ChevronUp,
  ChevronDown,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

interface AdCapture {
  id: string;
  captureDate: string;
  imageKey: string;
  brand: string | null;
  campaignName: string | null;
  adFormat: string | null;
  widthPx: number;
  heightPx: number;
  normalizedSize: string | null;
  ocrText: string | null;
  confidenceScore: number;
  extractionMethod: string;
  reviewStatus: string;
  page: {
    section: string | null;
    sourceUrl: string | null;
    edition: {
      editionDate: string;
      newspaper: { name: string; slug: string };
    };
  };
  campaign: {
    brand: string;
    campaignName: string | null;
    totalAppearances: number;
  } | null;
}

interface Stats {
  totalAds: number;
  avgConfidence: number;
}

export default function AdsPage() {
  const [ads, setAds] = useState<AdCapture[]>([]);
  const [stats, setStats] = useState<Stats>({ totalAds: 0, avgConfidence: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [dateFilter, setDateFilter] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newspaperFilter, setNewspaperFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureSlug, setCaptureSlug] = useState("all");

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set("date", dateFilter);
      if (newspaperFilter) params.set("newspaper", newspaperFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("sortField", sortField);
      params.set("sortOrder", sortOrder);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/ads?${params}`);
      const data = await res.json();

      if (data.ads) {
        setAds(data.ads);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats || { totalAds: 0, avgConfidence: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch ads:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, newspaperFilter, statusFilter, searchQuery, sortField, sortOrder, page]);

  const triggerCapture = async () => {
    setCapturing(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: captureSlug, date: dateFilter }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCaptureModal(false);
        window.location.href = "/jobs";
      } else {
        alert("Error starting capture: " + data.error);
      }
    } catch (error) {
      alert("Failed to start capture");
      console.error(error);
    } finally {
      setCapturing(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const exportExcel = () => {
    const rows = ads.map((ad) => ({
      Date: ad.captureDate,
      Newspaper: ad.page.edition.newspaper.name,
      Section: ad.page.section || "-",
      Brand: ad.brand || "Unknown",
      Campaign: ad.campaignName || "-",
      Format: ad.adFormat || "-",
      Size: ad.normalizedSize || `${ad.widthPx}x${ad.heightPx}`,
      Confidence: `${Math.round(ad.confidenceScore * 100)}%`,
      Status: ad.reviewStatus,
      "OCR Text": ad.ocrText?.substring(0, 200) || "-",
      Method: ad.extractionMethod,
      Appearances: ad.campaign?.totalAppearances || 1,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Ads");
    XLSX.writeFile(wb, `ads_${dateFilter}.xlsx`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "auto_approved":
        return <ShieldCheck className="text-green-400" size={16} />;
      case "approved":
        return <Shield className="text-blue-400" size={16} />;
      case "pending":
        return <ShieldAlert className="text-amber-400" size={16} />;
      case "rejected":
        return <ShieldAlert className="text-red-400" size={16} />;
      default:
        return null;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "text-green-400";
    if (score >= 0.5) return "text-amber-400";
    return "text-red-400";
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const sortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
  };

  const groupAdsByDate = (adsList: AdCapture[]) => {
    const groups: Record<string, AdCapture[]> = {};
    adsList.forEach((ad) => {
      const d = new Date(ad.captureDate).toLocaleDateString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groups[d]) groups[d] = [];
      groups[d].push(ad);
    });
    return groups;
  };

  const adGroups = groupAdsByDate(ads);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <BarChart3 size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent tracking-tight">
                  Scrapping news
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
                  Monitor de Medios en Tiempo Real
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowCaptureModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-violet-500/20 active:scale-95"
              >
                <PlusCircle size={16} />
                New Capture
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-all"
              >
                <Download size={14} />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
              <Newspaper size={14} /> Total Ads
            </div>
            <div className="text-2xl font-bold">{stats.totalAds}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
              <TrendingUp size={14} /> Avg Confidence
            </div>
            <div className={`text-2xl font-bold ${getConfidenceColor(stats.avgConfidence)}`}>
              {Math.round(stats.avgConfidence * 100)}%
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
              <ShieldCheck size={14} /> Auto-approved
            </div>
            <div className="text-2xl font-bold text-green-400">
              {ads.filter((a) => a.reviewStatus === "auto_approved").length}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
              <ShieldAlert size={14} /> Needs Review
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {ads.filter((a) => a.reviewStatus === "pending").length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg border border-white/10 px-3 py-2">
            <Calendar size={14} className="text-white/50" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm outline-none text-white"
            />
          </div>
          <div className="flex items-center gap-2 bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 max-w-md">
            <Search size={14} className="text-white/50" />
            <input
              type="text"
              placeholder="Search by brand, campaign or content..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="bg-transparent text-sm outline-none text-white placeholder:text-white/30 w-full"
            />
          </div>
          <select
            value={newspaperFilter}
            onChange={(e) => { setNewspaperFilter(e.target.value); setPage(1); }}
            className="bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm outline-none text-white"
          >
            <option value="">All newspapers</option>
            <option value="clarin">Clarín</option>
            <option value="infobae">Infobae</option>
            <option value="lanacion">La Nación</option>
            <option value="pagina12">Página/12</option>
            <option value="perfil">Perfil</option>
            <option value="cronista">El Cronista</option>
            <option value="ambito">Ámbito</option>
            <option value="lavoz">La Voz</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm outline-none text-white"
          >
            <option value="">All status</option>
            <option value="auto_approved">Auto-approved</option>
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="flex items-center gap-1 text-white/40 text-xs ml-auto">
            <Filter size={12} />
            {ads.length} of {stats.totalAds} ads
          </div>
        </div>

        {/* Ads Table */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-white/40" size={32} />
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-24 text-white/40 animate-in fade-in zoom-in duration-700">
              <div className="relative mb-6 inline-block">
                <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full"></div>
                <Newspaper size={64} className="relative mx-auto opacity-20" />
              </div>
              <p className="text-xl font-medium text-white/60">No se encontraron anuncios</p>
              <p className="text-sm mt-2 text-white/30 max-w-xs mx-auto">
                Haz clic en &quot;New Capture&quot; para comenzar el monitoreo de diarios en tiempo real.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs">
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Image</th>
                  <th className="text-left px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("brand")}>
                    Brand {sortIcon("brand")}
                  </th>
                  <th className="text-left px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("campaignName")}>
                    Campaign {sortIcon("campaignName")}
                  </th>
                  <th className="text-left px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("newspaper")}>
                    Newspaper {sortIcon("newspaper")}
                  </th>
                  <th className="text-left px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("section")}>
                    Section {sortIcon("section")}
                  </th>
                  <th className="text-left px-4 py-3">Format</th>
                  <th className="text-left px-4 py-3">Size</th>
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("confidenceScore")}>
                    Confidence {sortIcon("confidenceScore")}
                  </th>
                  <th className="text-right px-4 py-3">Appearances</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(adGroups).map(([dateLabel, adsInDate]) => (
                  <React.Fragment key={dateLabel}>
                    <tr className="bg-white/5">
                      <td colSpan={10} className="px-4 py-2 text-[10px] uppercase tracking-widest text-violet-400 font-bold border-y border-white/5">
                        {dateLabel}
                      </td>
                    </tr>
                    {adsInDate.map((ad) => (
                      <tr
                        key={ad.id}
                        className="border-b border-white/5 hover:bg-white/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center">
                            {getStatusIcon(ad.reviewStatus)}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                           <div 
                            className="relative w-12 h-12 group cursor-pointer overflow-hidden rounded-md border border-white/10 bg-white/5 flex items-center justify-center hover:border-violet-500/50 transition-colors" 
                            onClick={() => setSelectedImage(`/${ad.imageKey}`)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={`/${ad.imageKey}`} 
                              alt={ad.brand || "Ad"} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => {
                                // Placeholder for 404
                                (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=No+Img";
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Search size={14} className="text-white" />
                            </div>
                           </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {ad.brand || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-white/60">
                          {(!ad.campaignName || ad.campaignName === "string") ? "-" : ad.campaignName}
                        </td>
                        <td className="px-4 py-3 text-white/60">
                          {ad.page.edition.newspaper.name}
                        </td>
                        <td className="px-4 py-3 text-white/60">
                          {ad.page.section || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">
                            {ad.adFormat || "Display"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-xs font-mono">
                          {ad.widthPx}×{ad.heightPx}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${getConfidenceColor(ad.confidenceScore)}`}>
                          {Math.round(ad.confidenceScore * 100)}%
                        </td>
                        <td className="px-4 py-3 text-right text-white/60">
                          {ad.campaign?.totalAppearances || 1}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

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

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] bg-gray-900 rounded-xl overflow-hidden shadow-2xl animate-in zoom-in duration-300 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedImage} 
              alt="Enlarged Ad" 
              className="w-full h-full object-contain"
            />
            <button 
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <XCircle size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Capture Modal */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-300">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <PlusCircle className="text-violet-400" size={20} />
              Start New Capture
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1 block">Newspaper</label>
                <select 
                  value={captureSlug}
                  onChange={(e) => setCaptureSlug(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-violet-500 transition-colors text-white"
                >
                  <option value="all" className="bg-gray-900">All Newspapers</option>
                  <option value="clarin" className="bg-gray-900">Clarín</option>
                  <option value="infobae" className="bg-gray-900">Infobae</option>
                  <option value="lanacion" className="bg-gray-900">La Nación</option>
                  <option value="pagina12" className="bg-gray-900">Página/12</option>
                  <option value="perfil" className="bg-gray-900">Perfil</option>
                  <option value="cronista" className="bg-gray-900">El Cronista</option>
                  <option value="ambito" className="bg-gray-900">Ámbito</option>
                  <option value="lavoz" className="bg-gray-900">La Voz</option>
                </select>
              </div>
              
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1 block">Target Date</label>
                <input 
                  type="date" 
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-violet-500 transition-colors text-white"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowCaptureModal(false)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/60"
                disabled={capturing}
              >
                Cancel
              </button>
              <button 
                onClick={triggerCapture}
                disabled={capturing}
                className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 shadow-lg shadow-violet-500/20 active:scale-95 disabled:opacity-50"
              >
                {capturing ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                {capturing ? "Starting..." : "Run Pipeline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
