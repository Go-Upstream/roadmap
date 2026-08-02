/**
 * Bakar ihop en roadmap-sida av motorn, projektets konfig och projektets data.
 *
 *   npm run roadmap                    # bygger roadmap/bygge.json
 *   npm run roadmap -- annat/bygge.json
 *
 * Utfilen är en enda HTML-fil utan externa hämtningar — typsnitten bakas in
 * som data-URI:er, eftersom artefaktsidor inte får hämta från någon annan
 * värd. Publicera den med Artifact-verktyget, och skicka med `url` för att
 * skriva över den befintliga sidan i stället för att skapa en ny.
 *
 * Skriptet stannar hellre än bygger fel: saknas en token som bas.css använder,
 * eller en platshållare i mallen, blir det ett avbrott med filnamn och namn.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Bygginställningar. Sökvägar räknas från projektets rot, aldrig från motorns. */
type Bygge = {
  /** Bara för utskriften — sidans titel står i konfigen. */
  namn: string;
  /** Vart den byggda filen skrivs. Katalogen skapas om den saknas. */
  ut: string;
  konfig: string;
  data: string;
  /** Temafilen. Måste sätta varje token bas.css använder. */
  tema: string;
  /** Märket i sidhuvudet, som SVG. Utelämnas det blir platsen tom. */
  marke?: string;
  /** CSS-filer med @font-face som klistras in orörda. */
  typsnittCss?: string[];
  /** Typsnittsfiler som bakas in som data-URI. */
  typsnittFiler?: TypsnittFil[];
};

type TypsnittFil = {
  familj: string;
  /** .woff2 eller .ttf. Formatet härleds ur ändelsen. */
  fil: string;
  /** font-weight, t.ex. "400" eller "100 800" för en variabel axel. */
  vikt?: string;
  /** font-stretch, t.ex. "75% 112.5%". Utelämnas för ett typsnitt utan breddaxel. */
  bredd?: string;
};

/** Det motorns konfig måste innehålla för att skalet ska gå att fylla i. */
type Konfig = {
  titel: string;
  under: string;
  sidfot: string;
  kallor: string;
};

/**
 * Var projektets egna filer bor: `bygge.json`, temat, konfigen, datan, märket,
 * typsnitten. Varje sökväg i `bygge.json` räknas härifrån.
 *
 * `process.cwd()` och inte motorns egen plats, eftersom motorn är ett beroende
 * och kan ligga var som helst — `node_modules/@go-upstream/roadmap/` i det
 * vanliga fallet. npm kör ett skript med arbetskatalogen satt till paketets
 * rot, så det här är projektets rot oavsett varifrån motorn hämtades.
 */
const ROT = process.cwd();

/**
 * Motorns egen katalog: `mall.html`, `bas.css` och `motor.js`. De reser med
 * motorn och läses därför relativt den, aldrig relativt projektet.
 */
const HAR = import.meta.dirname;

function las(...delar: string[]): string {
  return readFileSync(join(ROT, ...delar), "utf8");
}

function stanna(varfor: string): never {
  console.error(`\nBygget avbröts: ${varfor}\n`);
  process.exit(1);
}

/**
 * Kontraktet mellan bas.css och en temafil: varje token basen läser måste
 * temat sätta. `--c` undantas — den är fasens färg och sätts per element.
 *
 * Utan den här kontrollen blir ett ofullständigt tema en sida med osynlig
 * text, och felet syns först när någon öppnar den.
 */
function kontrolleraTokens(bas: string, tema: string, temafil: string): void {
  const anvanda = new Set(
    [...bas.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1] as string),
  );
  anvanda.delete("--c");
  const satta = new Set(
    [...tema.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string),
  );
  const saknas = [...anvanda].filter((t) => !satta.has(t)).sort();
  if (saknas.length > 0) {
    stanna(
      `${temafil} sätter inte ${saknas.length} token som bas.css använder:\n  ` +
        saknas.join("\n  "),
    );
  }
}

/** @font-face för en inbakad typsnittsfil. */
function typsnittRegel(t: TypsnittFil): string {
  const data = readFileSync(join(ROT, t.fil));
  const format = t.fil.endsWith(".woff2") ? "woff2" : "truetype";
  const mime = t.fil.endsWith(".woff2") ? "font/woff2" : "font/ttf";
  const delar = [
    `font-family:'${t.familj}'`,
    "font-style:normal",
    `font-weight:${t.vikt ?? "400"}`,
    ...(t.bredd === undefined ? [] : [`font-stretch:${t.bredd}`]),
    "font-display:block",
    `src:url(data:${mime};base64,${data.toString("base64")}) format('${format}')`,
  ];
  return `@font-face{${delar.join(";")};}`;
}

/** Läser konfigen genom att köra den, så inget behöver stå på två ställen. */
function lasKonfig(kalla: string, fil: string): Konfig {
  let k: unknown;
  try {
    k = new Function(`${kalla}\n;return K;`)() as unknown;
  } catch (e) {
    stanna(`${fil} gick inte att köra: ${(e as Error).message}`);
  }
  for (const falt of ["titel", "under", "sidfot", "kallor"]) {
    if (typeof (k as Record<string, unknown>)[falt] !== "string") {
      stanna(`${fil} saknar ett textfält: K.${falt}`);
    }
  }
  return k as Konfig;
}

// ── Bygget ───────────────────────────────────────────────────────────
const byggefil = process.argv[2] ?? "roadmap/bygge.json";
const b = JSON.parse(las(byggefil)) as Bygge;

const mall = readFileSync(join(HAR, "mall.html"), "utf8");
const bas = readFileSync(join(HAR, "bas.css"), "utf8");
const motor = readFileSync(join(HAR, "motor.js"), "utf8");

const tema = las(b.tema);
kontrolleraTokens(bas, tema, b.tema);

const konfigKalla = las(b.konfig);
const konfig = lasKonfig(konfigKalla, b.konfig);

const typsnitt = [
  ...(b.typsnittCss ?? []).map((f) => las(f).trim()),
  ...(b.typsnittFiler ?? []).map(typsnittRegel),
].join("\n");

const bitar: Record<string, string> = {
  TITEL: konfig.titel,
  UNDER: konfig.under,
  MARKE: b.marke === undefined ? "" : las(b.marke).trim(),
  SIDFOT: konfig.sidfot,
  KALLOR: konfig.kallor,
  TYPSNITT: typsnitt,
  TEMA: tema,
  BAS: bas,
  KONFIG: konfigKalla,
  DATA: las(b.data),
  MOTOR: motor,
};

let ut = mall;
for (const [namn, varde] of Object.entries(bitar)) {
  ut = ut.split(`{{${namn}}}`).join(varde);
}

const kvar = [...ut.matchAll(/\{\{([A-Z]+)\}\}/g)].map((m) => m[1] as string);
if (kvar.length > 0) stanna(`mall.html har platshållare som ingen fyllde: ${[...new Set(kvar)].join(", ")}`);

const utvag = join(ROT, b.ut);
mkdirSync(dirname(utvag), { recursive: true });
writeFileSync(utvag, ut);

const kb = (n: number) => `${Math.round(n / 1024)} kB`;
console.log(`${b.namn} · ${b.ut} · ${kb(ut.length)}`);
console.log(`  varav typsnitt ${kb(typsnitt.length)}, data ${kb(bitar.DATA?.length ?? 0)}, motor ${kb(motor.length)}`);
console.log("\nPublicera med Artifact-verktyget, med url= den befintliga sidan.");
