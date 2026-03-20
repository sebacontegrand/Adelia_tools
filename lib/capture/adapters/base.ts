/**
 * Base adapter interface for newspaper-specific capture behavior.
 * Each newspaper gets its own adapter to handle unique layouts and access patterns.
 */

export interface EditionInfo {
  type: "web" | "pdf";
  url: string;
  date: Date;
  sections?: string[];
}

export interface AdapterConfig {
  /** CSS selectors to identify ad containers */
  adSelectors: string[];
  /** Wait strategy after page load */
  waitStrategy: "networkidle" | "domcontentloaded" | "delay";
  /** Extra delay in ms after waitStrategy */
  extraDelay: number;
  /** How far to scroll (px) to trigger lazy-loaded ads */
  scrollDistance: number;
  /** Minimum ad dimensions to consider */
  minWidth: number;
  minHeight: number;
  /** Sections to capture (homepage, sections, etc.) */
  sections: string[];
  /** Whether this source requires auth */
  requiresAuth: boolean;
}

export const DEFAULT_AD_SELECTORS = [
  'iframe[id*="google_ads"]',
  'div[id*="google_ads"]',
  'div[id*="gpt-ad"]',
  'div[class*="ad-container"]',
  'div[class*="ad_slot"]',
  'div[class*="advertising"]',
  'div[class*="aviso"]',        // Common in AR newspapers
  'div[class*="publicidad"]',    // Common in AR newspapers  
  'div[class*="sponsor"]',
  'div[id*="block-block-ad"]',
  'ins.adsbygoogle',
  'div[data-ad]',
  'div[data-google-query-id]',
  'div[class*="commercialBreak"]',
  'div[class*="caja_publicidad"]',
  'aside[class*="ad"]',
];

export const DEFAULT_CONFIG: AdapterConfig = {
  adSelectors: DEFAULT_AD_SELECTORS,
  waitStrategy: "domcontentloaded",
  extraDelay: 5000,
  scrollDistance: 3000,
  minWidth: 90,
  minHeight: 40,
  sections: ["/"],
  requiresAuth: false,
};

export abstract class NewspaperAdapter {
  public name: string;
  public slug: string;
  public baseUrl: string;
  public config: AdapterConfig;

  constructor(name: string, slug: string, baseUrl: string, config?: Partial<AdapterConfig>) {
    this.name = name;
    this.slug = slug;
    this.baseUrl = baseUrl;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Discover today's edition (PDF kiosk URL, homepage, etc.)
   */
  abstract discoverEdition(date: Date): Promise<EditionInfo>;

  /**
   * Get the list of page URLs to capture
   */
  getSectionUrls(): string[] {
    return this.config.sections.map(section => {
      if (section === "/") return this.baseUrl;
      return `${this.baseUrl}${section}`;
    });
  }
}
