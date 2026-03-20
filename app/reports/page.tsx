"use client";

import { useState, useEffect, useCallback } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart3, 
  Calendar, 
  Trash2, 
  AlertTriangle, 
  Loader2,
  TrendingUp,
  Newspaper,
  CheckCircle2,
  XCircle,
} from "lucide-react";


interface BrandStat {
  brand: string;
  count: number;
}

interface NewspaperStat {
  name: string;
  slug: string;
  adsFound: number;
  pagesCount: number;
  status: string;
}

interface DailyReport {
  date: string;
  totalAds: number;
  avgConfidence: number;
  brandLeaderboard: BrandStat[];
  newspaperSummary: NewspaperStat[];
}

export default function ReportsPage() {
  const [date, setDate] = useState("");
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize date on mount to avoid hydration mismatch
  useEffect(() => {
    setDate(new Date().toISOString().split("T")[0]);
  }, []);


  const fetchReport = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/daily?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading report");
    } finally {
      setLoading(false);
    }
  }, [date]);


  useEffect(() => {
    fetchReport();
  }, [date, fetchReport]);


  const handleCleanup = async () => {
    if (!confirm(`Are you sure you want to delete ALL data and files for ${date}? This cannot be undone.`)) {
      return;
    }

    setCleaning(true);
    try {
      const res = await fetch(`/api/admin/clean-day?date=${date}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clean day");
      const data = await res.json();
      alert(`Successfully cleaned ${date}. Deleted ${data.summary.editionsDeleted} editions and ${data.summary.jobsDeleted} jobs.`);
      fetchReport();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error cleaning day");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Ad Reports</h1>
          <p className="text-muted-foreground">Insights and management for your captured ads.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button 
            variant="destructive" 
            size="icon" 
            onClick={handleCleanup}
            disabled={cleaning || !report || report.totalAds === 0}
            title="Clean all data for this day"
          >
            {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Generating daily report...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-destructive font-medium">{error}</p>
            <Button onClick={fetchReport} variant="outline" size="sm">Retry</Button>
          </CardContent>
        </Card>
      ) : !report || report.totalAds === 0 ? (
        <div className="text-center py-20 space-y-4">
          <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-xl font-semibold">No data for this day</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Try selecting another date or check the pipeline to see if any capture jobs ran for {date}.
          </p>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Ads Found</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{report.totalAds}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all newspaper editions
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(report.avgConfidence * 100).toFixed(1)}%</div>
                <div className="h-2 w-full bg-secondary mt-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${report.avgConfidence * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Brands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{report.brandLeaderboard.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unique entities identified
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Brand Leaderboard */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <CardTitle>Brand Leaderboard</CardTitle>
                </div>
                <CardDescription>Most active brands for {date}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {report.brandLeaderboard.map((item) => (

                    <div key={item.brand} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.brand}</span>
                        <span className="text-muted-foreground">{item.count} ads</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-violet-400" 
                          style={{ width: `${(item.count / report.brandLeaderboard[0].count) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Newspaper Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-primary" />
                  <CardTitle>Newspaper Source Stats</CardTitle>
                </div>
                <CardDescription>Capture results by newspaper</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-1 font-medium">Newspaper</th>
                        <th className="py-2 px-1 font-medium text-center">Ads</th>
                        <th className="py-2 px-1 font-medium text-center">Pages</th>
                        <th className="py-2 px-1 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.newspaperSummary.map((n) => (
                        <tr key={n.slug} className="border-b last:border-0">
                          <td className="py-3 px-1">{n.name}</td>
                          <td className="py-3 px-1 text-center">{n.adsFound}</td>
                          <td className="py-3 px-1 text-center">{n.pagesCount}</td>
                          <td className="py-3 px-1 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                              n.status === "processed" 
                                ? "bg-green-100 text-green-700" 
                                : n.status === "captured"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {n.status === "processed" && <CheckCircle2 className="h-3 w-3" />}
                              {n.status === "missing" && <XCircle className="h-3 w-3" />}
                              {n.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
