import { NewspaperAdapter, EditionInfo } from "./base";

export class ClarinAdapter extends NewspaperAdapter {
  constructor() {
    super("Clarín", "clarin", "https://www.clarin.com", {
      adSelectors: [
        // Clarín-specific selectors
        'div[id*="gpt-ad"]',
        'div[class*="aviso"]',
        'div[class*="ad-container"]',
        'div[class*="publicidad"]',
        'div[class*="commercialBreak"]',
        'div[class*="caja_publicidad"]',
        'iframe[id*="google_ads"]',
        'ins.adsbygoogle',
        'div[data-google-query-id]',
      ],
      sections: ["/", "/politica", "/deportes", "/economia"],
      extraDelay: 6000,
      scrollDistance: 4000,
    });
  }

  async discoverEdition(date: Date): Promise<EditionInfo> {
    // Clarín has a digital kiosk at kiosco.clarin.com
    // For now, scrape the web version
    const dateStr = date.toISOString().split("T")[0];
    return {
      type: "web",
      url: this.baseUrl,
      date,
      sections: this.config.sections,
    };
  }
}
