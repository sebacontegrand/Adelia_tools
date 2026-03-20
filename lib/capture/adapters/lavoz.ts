import { NewspaperAdapter, EditionInfo } from "./base";

export class LaVozAdapter extends NewspaperAdapter {
  constructor() {
    super("La Voz", "lavoz", "https://www.lavoz.com.ar", {
      adSelectors: [
        'div[class*="publicidad"]',
        'div[id*="gpt-ad"]',
        'div[id*="google_ads"]',
        'div[class*="slot-ad"]',
      ],
      sections: ["/", "/politica", "/negocios", "/sucesos"],
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
