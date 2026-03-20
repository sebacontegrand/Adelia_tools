/**
 * Page capture module using Playwright.
 * Navigates to newspaper pages, waits for ads, and captures full-page screenshots.
 */

import { chromium, Browser, Page } from "playwright";
import { AdapterConfig, DEFAULT_AD_SELECTORS } from "./adapters/base";

export interface CapturedPage {
  url: string;
  section: string;
  screenshot: Buffer;
  widthPx: number;
  heightPx: number;
  adRegions: AdRegion[];
}

export interface AdRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  selector: string;
  tagName: string;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    const browserlessKey = process.env.BROWSERLESS_API_KEY;
    if (browserlessKey) {
      // Use Browserless.io for managed headless Chrome
      browser = await chromium.connectOverCDP(
        `wss://chrome.browserless.io?token=${browserlessKey}`
      );
    } else {
      // Local Playwright browser
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-web-security",
        ],
      });
    }
  }
  return browser;
}

/**
 * Capture a single page and detect ad regions.
 */
export async function capturePage(
  url: string,
  section: string,
  config: AdapterConfig
): Promise<CapturedPage> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // Block unnecessary resources to speed up loading
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      if (["media", "font"].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Navigate
    console.log(`[Capture] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: config.waitStrategy === "networkidle" ? "networkidle" : "domcontentloaded",
      timeout: 60000,
    });

    // Extra delay for ads to load
    if (config.extraDelay > 0) {
      await page.waitForTimeout(config.extraDelay);
    }

    // Scroll to trigger lazy-loaded ads
    await autoScroll(page, config.scrollDistance);

    // Wait a bit more after scrolling
    await page.waitForTimeout(2000);

    // Detect ad regions
    const adRegions = await detectAdRegions(page, config);

    // Take full-page screenshot
    const screenshot = await page.screenshot({ fullPage: true, type: "png" });

    // Get viewport dimensions
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));

    console.log(
      `[Capture] ${url} — ${dimensions.width}x${dimensions.height}, ${adRegions.length} ad regions found`
    );

    return {
      url,
      section,
      screenshot: Buffer.from(screenshot),
      widthPx: dimensions.width,
      heightPx: dimensions.height,
      adRegions,
    };
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Detect ad regions by querying DOM for known ad selectors.
 */
async function detectAdRegions(page: Page, config: AdapterConfig): Promise<AdRegion[]> {
  const selectors = config.adSelectors.length > 0 ? config.adSelectors : DEFAULT_AD_SELECTORS;

  const regions = await page.evaluate(
    ({ selectors, minWidth, minHeight }) => {
      const results: {
        x: number;
        y: number;
        width: number;
        height: number;
        selector: string;
        tagName: string;
      }[] = [];

      const seen = new Set<string>();

      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const key = `${Math.round(rect.x)}_${Math.round(rect.y)}_${Math.round(rect.width)}_${Math.round(rect.height)}`;

            if (
              rect.width >= minWidth &&
              rect.height >= minHeight &&
              !seen.has(key)
            ) {
              seen.add(key);
              results.push({
                x: Math.round(rect.x + window.scrollX),
                y: Math.round(rect.y + window.scrollY),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                selector,
                tagName: el.tagName.toLowerCase(),
              });
            }
          });
        } catch {
          // Invalid selector, skip
        }
      }

      return results;
    },
    {
      selectors,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
    }
  );

  return regions;
}

/**
 * Auto-scroll the page to trigger lazy-loaded content.
 */
async function autoScroll(page: Page, maxScroll: number): Promise<void> {
  await page.evaluate(async (maxScroll) => {
    await new Promise<void>((resolve) => {
      let totalScrolled = 0;
      const step = 300;
      const interval = setInterval(() => {
        window.scrollBy(0, step);
        totalScrolled += step;
        if (totalScrolled >= maxScroll || totalScrolled >= document.body.scrollHeight) {
          clearInterval(interval);
          window.scrollTo(0, 0); // Scroll back to top for screenshot
          resolve();
        }
      }, 100);
    });
  }, maxScroll);
}

/**
 * Crop a region from a full-page screenshot.
 */
export async function cropRegion(
  screenshot: Buffer,
  region: AdRegion
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  
  const metadata = await sharp(screenshot).metadata();
  const imgWidth = metadata.width || 1920;
  const imgHeight = metadata.height || 1080;

  // Clamp coordinates to image bounds
  const left = Math.max(0, Math.min(region.x, imgWidth - 1));
  const top = Math.max(0, Math.min(region.y, imgHeight - 1));
  const width = Math.min(region.width, imgWidth - left);
  const height = Math.min(region.height, imgHeight - top);

  if (width < 10 || height < 10) {
    throw new Error(`Ad region too small after clamping: ${width}x${height}`);
  }

  return sharp(screenshot)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
