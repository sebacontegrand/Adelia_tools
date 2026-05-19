"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { ChangeEvent } from "react";

const BarChart = dynamic(() => import("recharts").then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(mod => mod.Bar), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(mod => mod.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(mod => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(mod => mod.ResponsiveContainer), { ssr: false });

type AnalyticsSummaryResponse = {
  by_brand: { brand: string; count: number }[];
  by_format: Record<string, number>;
  by_platform: Record<string, number>;
  by_method: Record<string, number>;
};

export default function Dashboard() {
  const [filters, setFilters] = useState({ platform: "", brand: "", from: "", to: "" });

  const updateFilter =
    (key: keyof typeof filters) => (event: ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    };

  type AdRow = {
    id: string;
    brand: string;
    product: string | null;
    adFormat: string | null;
    platform: string | null;
    confidenceScore: number;
    reviewStatus: string;
    first_seen: string;
    last_seen: string;
    occurrences: number;
    page?: { edition?: { newspaper?: { name?: string; slug?: string } } };
  };

  type AdsApiResponse = {
    ads: AdRow[];
    total: number;
    stats?: { totalAds?: number; avgConfidence?: number };
  };

  const { data: adsData } = useQuery<AdsApiResponse>({
    queryKey: ["ads", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.platform) params.append("platform", filters.platform);
      if (filters.brand) params.append("brand", filters.brand);
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      const res = await fetch(`/api/ads?` + params.toString());
      return res.json();
    },
  });

  const { data: analytics } = useQuery<AnalyticsSummaryResponse>({
    queryKey: ["analytics", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      const res = await fetch(`/api/analytics/summary?` + params.toString());
      return res.json();
    },
  });

  const brandData = analytics?.by_brand?.slice(0, 10).map((b) => ({ name: b.brand, count: b.count })) || [];

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Ads Dashboard</h1>

      <div className="card">
        <div className="card-header">Filters</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-xs opacity-70">Platform</div>
            <input
              value={filters.platform}
              onChange={updateFilter("platform")}
              placeholder="e.g. clarin"
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-70">Brand</div>
            <input
              value={filters.brand}
              onChange={updateFilter("brand")}
              placeholder="Search brand"
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-70">From</div>
            <input
              type="date"
              value={filters.from}
              onChange={updateFilter("from")}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-70">To</div>
            <input
              type="date"
              value={filters.to}
              onChange={updateFilter("to")}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">Top Brands</div>
          <div className="card-body" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={brandData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Ads by Format</div>
          <div className="card-body">
            {analytics && Object.entries(analytics.by_format || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1">
                <span>{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Ads</div>
        <div className="card-body">
          <div className="flex items-center justify-between pb-3 text-sm">
            <div className="opacity-70">
              Total: <span className="font-semibold opacity-100">{adsData?.total ?? 0}</span>
            </div>
            <div className="opacity-70">
              Avg confidence:{" "}
              <span className="font-semibold opacity-100">
                {adsData?.stats?.avgConfidence != null ? `${Math.round(adsData.stats.avgConfidence * 100)}%` : "-"}
              </span>
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-black/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5">
                <tr className="text-left">
                  <th className="px-3 py-2">Brand</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Newspaper</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Format</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                  <th className="px-3 py-2 text-right">Seen</th>
                </tr>
              </thead>
              <tbody>
                {(adsData?.ads || []).slice(0, 50).map((ad) => (
                  <tr key={ad.id} className="border-t border-black/10">
                    <td className="px-3 py-2 font-medium">{ad.brand}</td>
                    <td className="px-3 py-2 opacity-80">{ad.product || "-"}</td>
                    <td className="px-3 py-2 opacity-80">
                      {ad.page?.edition?.newspaper?.name || "-"}
                    </td>
                    <td className="px-3 py-2 opacity-80">{ad.platform || "-"}</td>
                    <td className="px-3 py-2 opacity-80">{ad.adFormat || "-"}</td>
                    <td className="px-3 py-2 opacity-80">{ad.reviewStatus}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {typeof ad.confidenceScore === "number"
                        ? `${Math.round(ad.confidenceScore * 100)}%`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {ad.occurrences ?? 1}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
