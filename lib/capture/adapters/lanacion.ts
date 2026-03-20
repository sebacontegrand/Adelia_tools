import { NewspaperAdapter, EditionInfo } from "./base";

export class LaNacionAdapter extends NewspaperAdapter {
  constructor() {
    super("La Nación", "lanacion", "https://www.lanacion.com.ar", {
      adSelectors: [
        'div[id*="google_ads"]',
        'div[id*="gpt-ad"]',
        'div[class*="publicidad"]',
        'div[class*="banner"]',
        'iframe[src*="doubleclick"]',
        'ins.adsbygoogle',
      ],
      sections: ["/", "/politica", "/economia", "/sociedad"],
      extraDelay: 5000,
      scrollDistance: 3000,
    });
  }

  async discoverEdition(date: Date): Promise<EditionInfo> {
    return {
      type: "web",
      url: this.baseUrl,
      date,
      sections: this.config.sections,
    };
  }
}
