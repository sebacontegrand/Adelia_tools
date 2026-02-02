import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium-min";
import puppeteerCore from "puppeteer-core";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Allow Vercel functions to run longer (up to 60s on Pro, 10s on Hobby)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    let browser: any = null;
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error("Missing GEMINI_API_KEY");
            return NextResponse.json({ error: "Missing GEMINI_API_KEY environment variable" }, { status: 500 });
        }

        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        console.log(`Starting scrap for URL: ${url}`);

        try {
            console.log("Launching browser...");
            if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
                // Configure @sparticuz/chromium (Full version for AL2023 support)
                console.log("Chromium args:", chromium.args);
                browser = await puppeteerCore.launch({
                    args: [
                        ...chromium.args,
                        "--hide-scrollbars",
                        "--disable-web-security",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage"
                    ],
                    defaultViewport: chromium.defaultViewport,
                    executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v132.0.0/chromium-v132.0.0-pack.tar'),
                    headless: chromium.headless as any,
                });
            } else {
                console.log("Detecting local puppeteer...");
                const puppeteer = await import("puppeteer");
                browser = await puppeteer.default.launch({
                    headless: true,
                    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                });
            }
        } catch (launchError) {
            console.error("Browser launch failed:", launchError);
            return NextResponse.json(
                { error: `Browser Launch Failed: ${launchError instanceof Error ? launchError.message : String(launchError)}` },
                { status: 500 }
            );
        }

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        try {
            console.log("Navigating to page...");
            await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
            console.log("Page loaded.");
        } catch (e) {
            console.warn("Page load timed out or network idle not reached, continuing anyway...");
        }

        // Identify potential ad containers
        const potentialAds: any[] = await page.evaluate(() => {
            const ads: any[] = [];
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

        console.log(`Detected ${potentialAds.length} potential ad slots.`);
        const clippedAds = potentialAds.slice(0, 3); // Take top 3
        const analyzedAds = [];

        for (const ad of clippedAds) {
            try {
                const screenshotBuffer = await page.screenshot({
                    clip: { x: ad.x, y: ad.y, width: ad.width, height: ad.height },
                    encoding: "base64"
                });

                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `Analyze this image which is a visual advertisement captured from ${url}. 
                Identify:
                1. Brand Name (e.g. Nike, Coca-Cola).
                2. Product Name/Description.
                Return JSON only: { "brand": "string", "product": "string" }`;

                const result = await model.generateContent([
                    prompt,
                    { inlineData: { data: screenshotBuffer as string, mimeType: "image/png" } }
                ]);

                const textResponse = result.response.text();
                let aiData = { brand: "Unknown", product: "Unknown" };

                try {
                    const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
                    aiData = JSON.parse(cleanJson);
                } catch (e) {
                    console.error("Failed to parse Gemini response", textResponse);
                }

                analyzedAds.push({ ...ad, brand: aiData.brand, product: aiData.product });
            } catch (err) {
                console.error("Error processing ad slot", err);
                analyzedAds.push({ ...ad, brand: "Analysis Failed", product: "Analysis Failed" });
            }
        }

        return NextResponse.json({ ads: analyzedAds });

    } catch (error) {
        console.error("Scraping error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    } finally {
        if (browser) {
            await browser.close().catch(console.error);
        }
    }
}
