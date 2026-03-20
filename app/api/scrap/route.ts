import { NextRequest, NextResponse } from "next/server";
import puppeteerCore, { Browser } from "puppeteer-core";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface AdSlot {
    width: number;
    height: number;
    x: number;
    y: number;
    top: number;
    left: number;
    location: string;
    type: string;
    brand?: string;
    product?: string;
}

interface DetectedAd {
    type: string;
    width: number;
    height: number;
    location: string;
    brand: string;
    product: string;
    sourceUrl?: string;
    timestamp?: string;
    method?: string; // "jina" or "puppeteer"
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Allow Vercel functions to run longer (up to 60s on Pro, 10s on Hobby)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────
// Strategy 1: Jina Reader API + Gemini Analysis (Primary)
// ─────────────────────────────────────────
async function scrapeWithJina(url: string): Promise<DetectedAd[]> {
    const jinaApiKey = process.env.JINA_API_KEY;
    const hasValidKey = jinaApiKey && !jinaApiKey.startsWith("your_") && jinaApiKey.length > 10;

    console.log(`[Jina] Fetching page content for: ${url} (API key: ${hasValidKey ? "present" : "free tier"})`);

    // Use Jina Reader API to get the full page as Markdown
    const headers: Record<string, string> = {
        "Accept": "application/json",
        "X-Return-Format": "markdown",
    };

    if (hasValidKey) {
        headers["Authorization"] = `Bearer ${jinaApiKey}`;
    }

    const jinaResponse = await fetch(`https://r.jina.ai/${url}`, {
        method: "GET",
        headers,
    });

    if (!jinaResponse.ok) {
        // If JSON request fails, retry as plain text (free tier may not support JSON)
        console.log(`[Jina] JSON request failed (${jinaResponse.status}), retrying as plain text...`);
        const plainHeaders: Record<string, string> = {};
        if (hasValidKey) {
            plainHeaders["Authorization"] = `Bearer ${jinaApiKey}`;
        }
        const plainResponse = await fetch(`https://r.jina.ai/${url}`, {
            method: "GET",
            headers: plainHeaders,
        });

        if (!plainResponse.ok) {
            const errorBody = await plainResponse.text().catch(() => "");
            throw new Error(`Jina Reader failed: ${plainResponse.status} ${plainResponse.statusText} - ${errorBody.substring(0, 200)}`);
        }

        const pageContent = await plainResponse.text();
        if (!pageContent || pageContent.length < 100) {
            throw new Error("Jina Reader returned insufficient content");
        }

        console.log(`[Jina] Got ${pageContent.length} chars of plain text content. Sending to Gemini for ad analysis...`);
        return await analyzeContentWithGemini(pageContent, url);
    }

    // Parse JSON response
    let pageContent = "";
    try {
        const jinaData = await jinaResponse.json();
        pageContent = jinaData.data?.content || jinaData.content || "";
    } catch {
        // If JSON parsing fails, try reading as text
        pageContent = await jinaResponse.text();
    }

    if (!pageContent || pageContent.length < 100) {
        throw new Error("Jina Reader returned insufficient content");
    }

    return await analyzeContentWithGemini(pageContent, url);
}

// ─────────────────────────────────────────
// Gemini Analysis: Extract ads from page content
// ─────────────────────────────────────────
async function analyzeContentWithGemini(pageContent: string, url: string): Promise<DetectedAd[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You are an expert advertising analyst. Analyze this webpage content from the Argentinian newspaper at ${url}.

Your task is to identify ALL advertisements, sponsored content, and promotional material on the page.

For each ad found, extract:
1. Brand Name (the company or brand advertising)
2. Product/Campaign Description (what they're advertising)
3. Ad Type (e.g., "Banner", "Native Ad", "Sponsored Article", "Display Ad", "Video Ad", "Leaderboard", "Medium Rectangle", "Interstitial", "Popup")
4. Position on page (e.g., "Header/Top", "Sidebar", "Mid-Content", "Footer/Bottom", "Interstitial")
5. Estimated dimensions if visible from context (width x height in pixels, or common IAB sizes)

Return ONLY a JSON array (no markdown formatting, no code blocks):
[
  {
    "brand": "string",
    "product": "string", 
    "type": "string",
    "location": "string",
    "width": number,
    "height": number
  }
]

If no ads are found, return an empty array: []

Here is the page content:

${pageContent.substring(0, 15000)}`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();

    try {
        const cleanJson = textResponse
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
        const parsed = JSON.parse(cleanJson);

        if (!Array.isArray(parsed)) {
            console.warn("[Jina] Gemini returned non-array, wrapping");
            return [{ ...parsed, method: "jina" }];
        }

        return parsed.map((ad: DetectedAd) => ({
            type: ad.type || "Display Ad",
            width: ad.width || 300,
            height: ad.height || 250,
            location: ad.location || "Unknown",
            brand: ad.brand || "Unknown",
            product: ad.product || "Unknown",
            method: "jina",
        }));
    } catch {
        console.error("[Jina] Failed to parse Gemini response:", textResponse.substring(0, 200));
        throw new Error("Failed to parse ad analysis from Gemini");
    }
}

// ─────────────────────────────────────────
// Strategy 2: Puppeteer + Gemini Vision (Fallback)
// ─────────────────────────────────────────
async function scrapeWithPuppeteer(url: string): Promise<DetectedAd[]> {
    let browser: Browser | null = null;

    try {
        console.log(`[Puppeteer] Launching browser for: ${url}`);

        if (process.env.BROWSERLESS_API_KEY) {
            console.log("[Puppeteer] Connecting to Browserless (Stealth Mode)...");
            browser = await puppeteerCore.connect({
                browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}&stealth&--disable-features=IsolateOrigins,site-per-process`,
            });
        } else {
            console.log("[Puppeteer] Detecting local puppeteer...");
            const puppeteer = await import("puppeteer");
            browser = await puppeteer.default.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            });
        }

        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        await page.setViewport({ width: 1366, height: 768 });

        console.log("[Puppeteer] Navigating to page...");
        await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

        // Wait for ads to load
        await new Promise(r => setTimeout(r, 5000));

        // Scroll to trigger lazy-loaded ads
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 400;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= 2000) {
                        clearInterval(timer);
                        resolve(true);
                    }
                }, 200);
            });
            window.scrollTo(0, 0);
        });

        await new Promise(r => setTimeout(r, 2000));

        // Identify potential ad containers
        const potentialAds: AdSlot[] = await page.evaluate(() => {
            const ads: AdSlot[] = [];
            const elements = document.querySelectorAll(
                'iframe[id*="google_ads"], ' +
                'div[id*="google_ads"], ' +
                'div[id*="gpt-ad"], ' +
                'div[class*="ad-container"], ' +
                'div[class*="ad_slot"], ' +
                'div[id*="block-block-ad"], ' +
                'ins.adsbygoogle'
            );

            elements.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 90 && rect.height > 40) {
                    const style = window.getComputedStyle(el);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        let location = "Unknown";
                        const centerY = rect.top + rect.height / 2;
                        const windowHeight = window.innerHeight;

                        if (rect.top < 150) location = "Header/Top";
                        else if (centerY < windowHeight * 0.4) location = "Upper Fold";
                        else if (centerY > windowHeight * 0.6) location = "Footer/Bottom";
                        else location = "Sidebar/Body";

                        let type = "Display Ad";
                        const ratio = rect.width / rect.height;
                        if (ratio > 3) type = "Leaderboard";
                        else if (ratio < 0.4) type = "Skyscraper";
                        else if (Math.abs(rect.width - 300) < 50 && Math.abs(rect.height - 250) < 50) type = "Medium Rectangle";
                        else if (rect.width > 300 && rect.height > 200) type = "Large Rectangle";

                        ads.push({
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            x: rect.x,
                            y: rect.y,
                            top: rect.top,
                            left: rect.left,
                            location,
                            type,
                        });
                    }
                }
            });
            return ads;
        });

        console.log(`[Puppeteer] Detected ${potentialAds.length} potential ad slots.`);
        const clippedAds = potentialAds.slice(0, 5);
        const analyzedAds: DetectedAd[] = [];

        for (const ad of clippedAds) {
            try {
                const screenshotBuffer = await page.screenshot({
                    clip: { x: ad.x, y: ad.y, width: ad.width, height: ad.height },
                    encoding: "base64"
                });

                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const promptText = `Analyze this image which is a visual advertisement captured from ${url}. 
                Identify:
                1. Brand Name (e.g. Nike, Coca-Cola).
                2. Product Name/Description.
                Return JSON only: { "brand": "string", "product": "string" }`;

                const result = await model.generateContent([
                    promptText,
                    { inlineData: { data: screenshotBuffer as string, mimeType: "image/png" } }
                ]);

                const textResponse = result.response.text();
                let aiData = { brand: "Unknown", product: "Unknown" };

                try {
                    const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
                    aiData = JSON.parse(cleanJson);
                } catch {
                    console.error("[Puppeteer] Failed to parse Gemini response", textResponse);
                }

                analyzedAds.push({
                    ...ad,
                    brand: aiData.brand,
                    product: aiData.product,
                    method: "puppeteer",
                });
            } catch (err) {
                console.error("[Puppeteer] Error processing ad slot", err);
                analyzedAds.push({
                    ...ad,
                    brand: "Analysis Failed",
                    product: "Analysis Failed",
                    method: "puppeteer",
                });
            }
        }

        return analyzedAds;
    } finally {
        if (browser) {
            await browser.close().catch(console.error);
        }
    }
}

// ─────────────────────────────────────────
// Main endpoint: Single URL scrape (hybrid)
// ─────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Missing GEMINI_API_KEY environment variable" }, { status: 500 });
        }

        const body = await req.json();
        const { url, urls, strategy } = body;

        // ── Parallel multi-URL scrape ──
        if (urls && Array.isArray(urls) && urls.length > 0) {
            console.log(`[Multi] Starting parallel scrape of ${urls.length} URLs...`);
            
            const results = await Promise.allSettled(
                urls.map(async (singleUrl: string) => {
                    try {
                        const ads = await scrapeWithJina(singleUrl);
                        return { url: singleUrl, ads, method: "jina", error: null };
                    } catch (jinaError) {
                        console.warn(`[Multi] Jina failed for ${singleUrl}, skipping:`, jinaError);
                        return { url: singleUrl, ads: [], method: "failed", error: jinaError instanceof Error ? jinaError.message : "Unknown error" };
                    }
                })
            );

            const allResults = results.map((result, i) => {
                if (result.status === "fulfilled") {
                    return result.value;
                }
                return { url: urls[i], ads: [], method: "failed", error: "Promise rejected" };
            });

            // Flatten all ads, tagging each with source URL
            const allAds = allResults.flatMap(r =>
                r.ads.map((ad: DetectedAd) => ({ ...ad, sourceUrl: r.url }))
            );

            return NextResponse.json({
                ads: allAds,
                results: allResults.map(r => ({
                    url: r.url,
                    count: r.ads.length,
                    method: r.method,
                    error: r.error,
                })),
                totalAds: allAds.length,
            });
        }

        // ── Single URL scrape ──
        if (!url) {
            return NextResponse.json({ error: "URL or urls[] is required" }, { status: 400 });
        }

        console.log(`[Single] Starting scrape for URL: ${url}`);

        // Try Jina first, fallback to Puppeteer
        const forcePuppeteer = strategy === "puppeteer";
        let ads: DetectedAd[] = [];

        if (!forcePuppeteer) {
            try {
                ads = await scrapeWithJina(url);
                console.log(`[Single] Jina found ${ads.length} ads`);
            } catch (jinaError) {
                console.warn(`[Single] Jina strategy failed, falling back to Puppeteer:`, jinaError);
            }
        }

        if (ads.length === 0) {
            try {
                ads = await scrapeWithPuppeteer(url);
                console.log(`[Single] Puppeteer found ${ads.length} ads`);
            } catch (puppeteerError) {
                console.error(`[Single] Puppeteer strategy also failed:`, puppeteerError);
                return NextResponse.json(
                    { error: `Both scraping strategies failed. Last error: ${puppeteerError instanceof Error ? puppeteerError.message : "Unknown"}` },
                    { status: 500 }
                );
            }
        }

        const taggedAds = ads.map(ad => ({ ...ad, sourceUrl: url }));
        return NextResponse.json({ ads: taggedAds });

    } catch (error) {
        console.error("Scraping error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
