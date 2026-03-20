import { prisma } from "../lib/prisma";

const NEWSPAPERS = [
  {
    name: "Clarín",
    slug: "clarin",
    baseUrl: "https://www.clarin.com",
    sourceType: "pdf_kiosk",
    kioskUrl: "https://kiosco.clarin.com",
  },
  {
    name: "La Nación",
    slug: "lanacion",
    baseUrl: "https://www.lanacion.com.ar",
    sourceType: "pdf_kiosk",
    kioskUrl: "https://kioscodigital.lanacion.com.ar",
  },
  {
    name: "Infobae",
    slug: "infobae",
    baseUrl: "https://www.infobae.com",
    sourceType: "web",
  },
  {
    name: "Página/12",
    slug: "pagina12",
    baseUrl: "https://www.pagina12.com.ar",
    sourceType: "web",
  },
  {
    name: "Perfil",
    slug: "perfil",
    baseUrl: "https://www.perfil.com",
    sourceType: "web",
  },
  {
    name: "El Cronista",
    slug: "cronista",
    baseUrl: "https://www.cronista.com",
    sourceType: "web",
  },
  {
    name: "Ámbito",
    slug: "ambito",
    baseUrl: "https://www.ambito.com",
    sourceType: "web",
  },
  {
    name: "La Voz",
    slug: "lavoz",
    baseUrl: "https://www.lavoz.com.ar",
    sourceType: "web",
  },
];

async function main() {
  console.log("Seeding newspapers...");

  for (const paper of NEWSPAPERS) {
    await prisma.newspaper.upsert({
      where: { slug: paper.slug },
      update: { ...paper },
      create: { ...paper },
    });
    console.log(`  ✓ ${paper.name}`);
  }

  console.log(`\nSeeded ${NEWSPAPERS.length} newspapers.`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
