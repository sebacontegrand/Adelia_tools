import { NewspaperAdapter, EditionInfo } from "./base";

export class InfobaeAdapter extends NewspaperAdapter {
  constructor() {
    super("Infobae", "infobae", "https://www.infobae.com", {
      adSelectors: [
        'div[id*="gpt-ad"]',
        'div[class*="ad-container"]',
        'div[class*="dfp"]',
        'div[class*="advertising"]',
        'div[class*="sponsor"]',
        'iframe[id*="google_ads"]',
        'ins.adsbygoogle',
        'div[data-google-query-id]',
        'div[class*="publicidad"]',
      ],
      sections: ["/", "/america", "/deportes", "/economia"],
      extraDelay: 5000,
      scrollDistance: 3000,
    });
  }

  async discoverEdition(date: Date): Promise<EditionInfo> {
    // Infobae is digital-only, no PDF edition
    return {
      type: "web",
      url: this.baseUrl,
      date,
      sections: this.config.sections,
    };
  }
}
