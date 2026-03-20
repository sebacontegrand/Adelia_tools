import { NewspaperAdapter, EditionInfo } from "./base";

export class CronistaAdapter extends NewspaperAdapter {
  constructor() {
    super("El Cronista", "cronista", "https://www.cronista.com", {
      adSelectors: [
        'div[class*="publicidad"]',
        'div[id*="gpt-ad"]',
        'div[id*="google_ads"]',
        'div[class*="ads-wrapper"]',
      ],
      sections: ["/", "/economia-politica", "/finanzas-mercados", "/negocios"],
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
