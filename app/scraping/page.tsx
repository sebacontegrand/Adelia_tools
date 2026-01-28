"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ScanSearch, Save, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ScrapedAd {
    type: string;
    width: number;
    height: number;
    location: string;
    brand?: string;
    product?: string;
    sourceUrl?: string; // Track where it came from
    timestamp?: string;
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
    const [ads, setAds] = useState<ScrapedAd[]>([]);
    const [savedAds, setSavedAds] = useState<ScrapedAd[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Load saved ads from local storage on mount
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

        // Prepare data for Excel
        const data = savedAds.map(ad => ({
            Date: ad.timestamp ? new Date(ad.timestamp).toLocaleDateString() : new Date().toLocaleDateString(),
            Time: ad.timestamp ? new Date(ad.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
            Source: ad.sourceUrl ? new URL(ad.sourceUrl).hostname : "Unknown",
            Brand: ad.brand || "Unknown",
            Product: ad.product || "Unknown",
            Type: ad.type,
            Dimensions: `${ad.width}x${ad.height}`,
            Location: ad.location
        }));

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Report");

        // Generate filename with date
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `daily_ads_report_${dateStr}.xlsx`;

        // Download file
        XLSX.writeFile(workbook, fileName);

        // Clear saved ads after export
        clearReport();
    };

    const handleScrape = async () => {
        if (!selectedUrl) return;

        setIsLoading(true);
        setError(null);
        setAds([]);

        try {
            const response = await fetch("/api/scrap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: selectedUrl }),
            });

            if (!response.ok) {
                throw new Error("Failed to scrape the website");
            }

            const data = await response.json();
            // Add source URL to results
            const taggedAds = (data.ads || []).map((ad: any) => ({ ...ad, sourceUrl: selectedUrl }));
            setAds(taggedAds);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="flex flex-col space-y-8">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">AdScraping & Daily Report</h1>
                    <p className="text-muted-foreground">
                        Scan major Argentinian newspapers for ads and build your daily competitive report.
                    </p>
                </div>

                <Tabs defaultValue="scanner" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="scanner">Scanner</TabsTrigger>
                        <TabsTrigger value="report">Daily Report ({savedAds.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="scanner" className="space-y-6 mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Select Newspaper</CardTitle>
                                <CardDescription>
                                    Choose a publication to scan for live advertisements.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-4">
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

                                    <Button onClick={handleScrape} disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Scanning...
                                            </>
                                        ) : (
                                            <>
                                                <ScanSearch className="mr-2 h-4 w-4" />
                                                Scan Now
                                            </>
                                        )}
                                    </Button>
                                </div>
                                {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
                            </CardContent>
                        </Card>

                        {ads.length > 0 && (
                            <div className="grid gap-6">
                                <h2 className="text-2xl font-semibold">Detected Ads ({ads.length})</h2>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {ads.map((ad, i) => (
                                        <Card key={i} className="overflow-hidden flex flex-col">
                                            <div className="bg-slate-100 h-32 flex items-center justify-center text-slate-400 text-xs">
                                                No Preview
                                            </div>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-lg leading-tight">
                                                    {ad.brand || "Unknown Brand"}
                                                </CardTitle>
                                                <CardDescription className="line-clamp-1">
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
                                                    <span className="truncate max-w-[100px]" title={ad.location}>{ad.location}</span>
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
                                            <div className="text-xs text-muted-foreground mb-1">
                                                Source: {new URL(ad.sourceUrl || "").hostname}
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
                                                <div className="bg-slate-100 p-2 rounded">
                                                    <span className="block text-muted-foreground">Dimensions</span>
                                                    <span className="font-medium">{ad.width}x{ad.height}</span>
                                                </div>
                                                <div className="bg-slate-100 p-2 rounded">
                                                    <span className="block text-muted-foreground">Type</span>
                                                    <span className="font-medium truncate" title={ad.type}>{ad.type}</span>
                                                </div>
                                                <div className="bg-slate-100 p-2 rounded col-span-2">
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
