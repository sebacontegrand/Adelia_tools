import { NewspaperAdapter } from "./base";
import { ClarinAdapter } from "./clarin";
import { InfobaeAdapter } from "./infobae";
import { LaNacionAdapter } from "./lanacion";
import { Pagina12Adapter } from "./pagina12";
import { PerfilAdapter } from "./perfil";
import { CronistaAdapter } from "./cronista";
import { AmbitoAdapter } from "./ambito";
import { LaVozAdapter } from "./lavoz";

const adapterRegistry: Record<string, () => NewspaperAdapter> = {
  clarin: () => new ClarinAdapter(),
  infobae: () => new InfobaeAdapter(),
  lanacion: () => new LaNacionAdapter(),
  pagina12: () => new Pagina12Adapter(),
  perfil: () => new PerfilAdapter(),
  cronista: () => new CronistaAdapter(),
  ambito: () => new AmbitoAdapter(),
  lavoz: () => new LaVozAdapter(),
};

export function getAdapter(slug: string): NewspaperAdapter {
  const factory = adapterRegistry[slug];
  if (!factory) {
    throw new Error(`No adapter found for newspaper: ${slug}. Available: ${Object.keys(adapterRegistry).join(", ")}`);
  }
  return factory();
}

export function getAvailableAdapters(): string[] {
  return Object.keys(adapterRegistry);
}

export { NewspaperAdapter, ClarinAdapter, InfobaeAdapter };
export type { EditionInfo, AdapterConfig } from "./base";
