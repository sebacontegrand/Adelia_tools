import { NewspaperAdapter, EditionInfo } from "./base";

export class PerfilAdapter extends NewspaperAdapter {
  constructor() {
    super("Perfil", "perfil", "https://www.perfil.com", {
      adSelectors: [
        'div[class*="publicidad"]',
        'div[id*="gpt-ad"]',
        'div[id*="google_ads"]',
        'div[class*="ad-slot"]',
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
