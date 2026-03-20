import { NewspaperAdapter, EditionInfo } from "./base";

export class Pagina12Adapter extends NewspaperAdapter {
  constructor() {
    super("Página/12", "pagina12", "https://www.pagina12.com.ar", {
      adSelectors: [
        'div[class*="ads-"]',
        'div[id*="google_ads"]',
        'div[id*="div-gpt-ad"]',
        'div[class*="banner-container"]',
        'iframe[src*="ad-server"]',
      ],
      sections: ["/", "/secciones/el-pais", "/secciones/economia", "/secciones/sociedad"],
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
