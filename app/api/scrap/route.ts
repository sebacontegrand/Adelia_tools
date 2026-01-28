import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium-min";
import puppeteerCore from "puppeteer-core";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Allow Vercel functions to run longer (up to 60s on Pro, 10s on Hobby)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        let browser: any;
        try {
            if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
                // Configure @sparticuz/chromium-min
                // Download from GitHub Releases
                browser = await puppeteerCore.launch({
                    args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
                    defaultViewport: { width: 1366, height: 768 },
                    executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'),
                    headless: true,
                });
            } else {
                const puppeteer = await import("puppeteer");
                browser = await puppeteer.default.launch({
                    headless: true,
                    args: ["--no-sandbox", "--disable-setuid-sandbox"],
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

        // Set viewport to desktop size
        await page.setViewport({ width: 1366, height: 768 });

        // IMPORTANT: Enable request interception ONLY for fonts/media if we needed speed, 
        // but for Vision AI we need the images to look correct.
        // So we will allow images but maybe block fonts/css to be safe/faster? 
        // Actually, ads break without CSS often. Let's run full browser mode but with a timeout.

        try {
            await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
        } catch (e) {
            console.warn("Page load timed out or network idle not reached, continuing anyway...");
        }

        // Identify potential ad containers
        const potentialAds: any[] = await page.evaluate(() => {
            const ads: any[] = [];
            // Common ad selectors - expanded
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
                if (rect.width > 90 && rect.height > 40) { // Slightly looser
                    const style = window.getComputedStyle(el);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        // ... (rest location logic same)

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
            // Sort by prominence (top/size) and take top 5
            return ads.slice(0, 5);
        });

        const analyzedAds = [];

        // For each detected ad slot, take a screenshot of that region and ask Gemini
        for (const ad of potentialAds) {
            try {
                // Take screenshot of the specific region
                const screenshotBuffer = await page.screenshot({
                    clip: {
                        x: ad.x,
                        y: ad.y,
                        width: ad.width,
                        height: ad.height
                    },
                    encoding: "base64"
                });

                // Analyze with Gemini
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `Analyze this image which is a visual advertisement captured from ${url}. 
            Identify:
            1. Brand Name (e.g. Nike, Coca-Cola). Look for logos or text. If unsure, look for domain names in the ad.
            2. Product Name/Description (e.g. running shoes, soda).
            
            If it's empty, solid color, or just text like "Advertisement", return "Not an Ad" for Brand.
            
            Return JSON only: { "brand": "string", "product": "string" }`;

                const result = await model.generateContent([
                    prompt,
                    { inlineData: { data: screenshotBuffer as string, mimeType: "image/png" } }
                ]);

                const textResponse = result.response.text();
                let aiData = { brand: "Unknown", product: "Unknown" };

                try {
                    // Clean markdown code blocks if present
                    const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
                    aiData = JSON.parse(cleanJson);
                } catch (e) {
                    console.error("Failed to parse Gemini response", textResponse);
                }

                analyzedAds.push({
                    ...ad,
                    brand: aiData.brand,
                    product: aiData.product
                });

            } catch (err) {
                console.error("Error processing ad slot", err);
                analyzedAds.push({ ...ad, brand: "Analysis Failed", product: "Analysis Failed" });
            }
        }

        await browser.close();

        return NextResponse.json({ ads: analyzedAds });

    } catch (error) {
        console.error("Scraping error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
