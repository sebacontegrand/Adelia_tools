"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ScanSearch, Save, Trash2, Download, Newspaper, Zap, Server } from "lucide-react";
import * as XLSX from "xlsx";

interface ScrapedAd {
    type: string;
    width: number;
    height: number;
    location: string;
    brand?: string;
    product?: string;
    sourceUrl?: string;
    timestamp?: string;
    method?: string;
}

interface ScanResult {
    url: string;
    count: number;
    method: string;
    error: string | null;
}

const NEWSPAPERS = [
    { name: "Clarín", url: "https://www.clarin.com" },
    { name: "La Nación", url: "https://www.lanacion.com.ar" },
    { name: "Infobae", url: "https://www.infobae.com" },
    { name: "Página/12", url: "https://www.pagina12.com.ar" },
    { name: "Perfil", url: "https://www.perfil.com" },
    { name: "El Cronista", url: "https://www.cronista.com" },
    { name: "Ámbito", url: "https://www.ambito.com" },
    { name: "La Voz", url: "https://www.lavoz.com.ar" },
];

export default function ScrapingPage() {
    const [selectedUrl, setSelectedUrl] = useState(NEWSPAPERS[0].url);
    const [isLoading, setIsLoading] = useState(false);
    const [isParallelLoading, setIsParallelLoading] = useState(false);
    const [ads, setAds] = useState<ScrapedAd[]>([]);
    const [savedAds, setSavedAds] = useState<ScrapedAd[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [scanResults, setScanResults] = useState<ScanResult[]>([]);
    const [scanProgress, setScanProgress] = useState<string>("");

    useEffect(() => {
        const stored = localStorage.getItem("dailyReportAds");
        if (stored) {
            try {
                setSavedAds(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse saved ads", e);
            }
        }
    }, []);

    const saveAd = (ad: ScrapedAd) => {
        const newSaved = [...savedAds, { ...ad, timestamp: new Date().toISOString() }];
        setSavedAds(newSaved);
        localStorage.setItem("dailyReportAds", JSON.stringify(newSaved));
    };

    const saveAllAds = () => {
        const newSaved = [
            ...savedAds,
            ...ads.map(ad => ({ ...ad, timestamp: new Date().toISOString() }))
        ];
        setSavedAds(newSaved);
        localStorage.setItem("dailyReportAds", JSON.stringify(newSaved));
    };

    const removeAd = (index: number) => {
        const newSaved = savedAds.filter((_, i) => i !== index);
        setSavedAds(newSaved);
        localStorage.setItem("dailyReportAds", JSON.stringify(newSaved));
    };

    const clearReport = () => {
        setSavedAds([]);
        localStorage.removeItem("dailyReportAds");
    }

    const handleExport = () => {
        if (savedAds.length === 0) return;

        const data = savedAds.map(ad => ({
            Date: ad.timestamp ? new Date(ad.timestamp).toLocaleDateString() : new Date().toLocaleDateString(),
            Time: ad.timestamp ? new Date(ad.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
            Source: ad.sourceUrl ? new URL(ad.sourceUrl).hostname : "Unknown",
            Brand: ad.brand || "Unknown",
            Product: ad.product || "Unknown",
            Type: ad.type,
            Dimensions: `${ad.width}x${ad.height}`,
            Location: ad.location,
            Method: ad.method || "unknown",
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Report");

        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `daily_ads_report_${dateStr}.xlsx`;

        XLSX.writeFile(workbook, fileName);
        clearReport();
    };

    // ── Single newspaper scan ──
    const handleScrape = async () => {
        if (!selectedUrl) return;

        setIsLoading(true);
        setError(null);
        setAds([]);
        setScanResults([]);

        try {
            const response = await fetch("/api/scrap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: selectedUrl }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server Error: ${response.status}`);
            }

            const data = await response.json();
            const taggedAds = (data.ads || []).map((ad: ScrapedAd) => ({ ...ad, sourceUrl: ad.sourceUrl || selectedUrl }));
            setAds(taggedAds);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Parallel scan ALL newspapers ──
    const handleScanAll = async () => {
        setIsParallelLoading(true);
        setError(null);
        setAds([]);
        setScanResults([]);
        setScanProgress(`Scanning ${NEWSPAPERS.length} newspapers in parallel...`);

        try {
            const allUrls = NEWSPAPERS.map(p => p.url);

            const response = await fetch("/api/scrap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: allUrls }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server Error: ${response.status}`);
            }

            const data = await response.json();
            setAds(data.ads || []);
            setScanResults(data.results || []);
            setScanProgress(`Done! Found ${data.totalAds || 0} ads across ${NEWSPAPERS.length} newspapers.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setScanProgress("");
        } finally {
            setIsParallelLoading(false);
        }
    };

    const getNewspaperName = (url: string) => {
        const paper = NEWSPAPERS.find(p => p.url === url);
        return paper?.name || new URL(url).hostname;
    };

    return (
        <div className="container mx-auto py-10 px-4 max-w-6xl">
            <div className="flex flex-col space-y-8">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">AdScraping &amp; Daily Report</h1>
                    <p className="text-muted-foreground">
                        Scan major Argentinian newspapers for ads and build your daily competitive report.
                        Powered by <span className="font-semibold text-primary">Jina AI Reader</span> + Gemini.
                    </p>
                </div>

                <Tabs defaultValue="scanner" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="scanner">Scanner</TabsTrigger>
                        <TabsTrigger value="report">Daily Report ({savedAds.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="scanner" className="space-y-6 mt-6">
                        {/* Single Scan */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Select Newspaper</CardTitle>
                                <CardDescription>
                                    Choose a single publication to scan, or scan all 8 at once.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-4 flex-wrap">
                                    <Select value={selectedUrl} onValueChange={setSelectedUrl}>
                                        <SelectTrigger className="w-[300px]">
                                            <SelectValue placeholder="Select a newspaper" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {NEWSPAPERS.map((paper) => (
                                                <SelectItem key={paper.url} value={paper.url}>
                                                    {paper.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Button onClick={handleScrape} disabled={isLoading || isParallelLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Scanning...
                                            </>
                                        ) : (
                                            <>
                                                <ScanSearch className="mr-2 h-4 w-4" />
                                                Scan One
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        variant="default"
                                        onClick={handleScanAll}
                                        disabled={isLoading || isParallelLoading}
                                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                                    >
                                        {isParallelLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Scanning All...
                                            </>
                                        ) : (
                                            <>
                                                <Newspaper className="mr-2 h-4 w-4" />
                                                Scan All 8
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {error && <p className="text-red-500 text-sm">{error}</p>}

                                {scanProgress && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                        {isParallelLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                        {scanProgress}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Scan Results Summary (for parallel scans) */}
                        {scanResults.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Scan Results by Source</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                        {scanResults.map((result) => (
                                            <div
                                                key={result.url}
                                                className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                                                    result.error
                                                        ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                                                        : "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{getNewspaperName(result.url)}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {result.error
                                                            ? `Error: ${result.error.substring(0, 40)}...`
                                                            : `${result.count} ads found`
                                                        }
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {result.method === "jina" ? (
                                                        <Zap className="h-3 w-3 text-yellow-500" />
                                                    ) : (
                                                        <Server className="h-3 w-3 text-blue-500" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Detected Ads */}
                        {ads.length > 0 && (
                            <div className="grid gap-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-semibold">Detected Ads ({ads.length})</h2>
                                    <Button variant="secondary" onClick={saveAllAds}>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save All to Report
                                    </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {ads.map((ad, i) => (
                                        <Card key={i} className="overflow-hidden flex flex-col border-border/50 bg-card/50">
                                            <div className="bg-muted h-20 flex items-center justify-center text-muted-foreground text-xs gap-2">
                                                {ad.method === "jina" ? (
                                                    <><Zap className="h-3 w-3 text-yellow-500" /> Jina Reader</>
                                                ) : (
                                                    <><Server className="h-3 w-3 text-blue-500" /> Puppeteer</>
                                                )}
                                            </div>
                                            <CardHeader className="pb-2">
                                                <div className="text-xs text-muted-foreground mb-1">
                                                    {ad.sourceUrl ? getNewspaperName(ad.sourceUrl) : "Unknown Source"}
                                                </div>
                                                <CardTitle className="text-lg leading-tight">
                                                    {ad.brand || "Unknown Brand"}
                                                </CardTitle>
                                                <CardDescription className="line-clamp-2">
                                                    {ad.product || "Unknown Product"}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-1 flex-1">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Type:</span>
                                                    <span>{ad.type}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Size:</span>
                                                    <span>{ad.width}x{ad.height}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Pos:</span>
                                                    <span className="truncate max-w-[120px]" title={ad.location}>{ad.location}</span>
                                                </div>
                                            </CardContent>
                                            <CardFooter className="pt-2">
                                                <Button variant="secondary" size="sm" className="w-full" onClick={() => saveAd(ad)}>
                                                    <Save className="mr-2 h-3 w-3" />
                                                    Save to Report
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="report" className="space-y-6 mt-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-semibold">Saved Items ({savedAds.length})</h2>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={clearReport}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear
                                </Button>
                                <Button onClick={handleExport}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export Excel
                                </Button>
                            </div>
                        </div>

                        {savedAds.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                No ads saved yet. Use the Scanner to find and save ads.
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {savedAds.map((ad, i) => (
                                    <Card key={i} className="overflow-hidden relative group">
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeAd(i)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                <span>Source: {ad.sourceUrl ? getNewspaperName(ad.sourceUrl) : "Unknown"}</span>
                                                {ad.method && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium uppercase">
                                                        {ad.method === "jina" ? <Zap className="h-2.5 w-2.5" /> : <Server className="h-2.5 w-2.5" />}
                                                        {ad.method}
                                                    </span>
                                                )}
                                            </div>
                                            <CardTitle className="text-lg">
                                                {ad.brand || "Unknown Brand"}
                                            </CardTitle>
                                            <CardDescription>
                                                {ad.product || "Unknown Product"}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-sm space-y-2">
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="bg-muted p-2 rounded">
                                                    <span className="block text-muted-foreground">Dimensions</span>
                                                    <span className="font-medium">{ad.width}x{ad.height}</span>
                                                </div>
                                                <div className="bg-muted p-2 rounded">
                                                    <span className="block text-muted-foreground">Type</span>
                                                    <span className="font-medium truncate" title={ad.type}>{ad.type}</span>
                                                </div>
                                                <div className="bg-muted p-2 rounded col-span-2">
                                                    <span className="block text-muted-foreground">Location</span>
                                                    <span className="font-medium">{ad.location}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
