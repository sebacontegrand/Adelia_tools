import { NewspaperAdapter, EditionInfo } from "./base";

export class AmbitoAdapter extends NewspaperAdapter {
  constructor() {
    super("Ámbito", "ambito", "https://www.ambito.com", {
      adSelectors: [
        'div[class*="publicidad"]',
        'div[id*="google_ads"]',
        'div[id*="gpt-ad"]',
        'div[class*="slot-ad"]',
      ],
      sections: ["/", "/politica", "/economia", "/finanzas"],
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
