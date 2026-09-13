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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

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
  /**
   * Källkontrollen: vad som händer när en posts `k` pekar på en fil som inte
   * finns. `"varna"` är förvalet och skriver en rad; `"strikt"` stannar
   * bygget; `"av"` tiger.
   *
   * Förvalet är avsiktligt inte strikt. Motorn når tre projekt inom minuter
   * efter en merge, och en ny kontroll som stannar deras bygge är precis den
   * sortens överraskning pinnflytten annars är byggd för att undvika. Ett
   * projekt vars data är genomgången slår på `"strikt"` självt, och då kan
   * en trasig källa aldrig komma in igen.
   */
  kallkontroll?: "varna" | "strikt" | "av";
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

/**
 * Vilken motor sidan byggdes med — version och commit.
 *
 * **Den frågan gick förut inte att besvara.** Pinnflytten öppnar en PR i varje
 * konsument, men sidan läsarna ser byter först när någon bygger om och
 * publicerar för hand. Utan en stämpel i sidan fanns det ingenstans att läsa
 * av om det steget blivit gjort — man fick öppna sidan och gissa på utseendet.
 *
 * Commiten kommer ur projektets `package-lock.json`, som är den enda plats som
 * vet vad pinnen faktiskt löstes upp till. Två former är i bruk, samma två som
 * pinnflytten skriver:
 *
 *     git+ssh://git@github.com/Go-Upstream/roadmap.git#<sha>
 *     https://github.com/Go-Upstream/roadmap/archive/<sha>.tar.gz
 *
 * Byggs motorn i sitt eget repo finns ingen sådan post — då används repots
 * HEAD. Går ingetdera blir det «okänd», och bygget fortsätter: en sida utan
 * stämpel är sämre än en med, men mycket bättre än inget bygge alls.
 *
 * **Tiden stämplas inte.** `package-lock.json` spikar pinnen just för att
 * `npm ci` ska ge samma sida i dag som i går, och en byggtidpunkt i filen hade
 * gjort varje bygge till en ny fil utan att något ändrats.
 */
function motorStampel(): { version: string; commit: string; kort: string } {
  const version = (JSON.parse(readFileSync(join(HAR, "package.json"), "utf8")) as { version?: string })
    .version ?? "okänd";

  const ur = (spec: string): string | null => {
    if (spec.includes("#")) return spec.slice(spec.lastIndexOf("#") + 1);
    const i = spec.indexOf("/archive/");
    if (i !== -1) return spec.slice(i + "/archive/".length).split(".")[0] ?? null;
    return null;
  };

  let commit: string | null = null;
  try {
    const las = JSON.parse(readFileSync(join(ROT, "package-lock.json"), "utf8")) as {
      packages?: Record<string, { resolved?: string }>;
      dependencies?: Record<string, { version?: string; resolved?: string }>;
    };
    const post = las.packages?.["node_modules/@go-upstream/roadmap"];
    const gammal = las.dependencies?.["@go-upstream/roadmap"];
    const spec = post?.resolved ?? gammal?.resolved ?? gammal?.version ?? "";
    commit = spec === "" ? null : ur(spec);
  } catch {
    commit = null;   // ingen låsfil, eller ingen post för motorn
  }
  if (commit === null) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: HAR, encoding: "utf8" }).trim();
    } catch {
      commit = null;   // inget git, eller inget repo
    }
  }

  const hel = commit ?? "okänd";
  return { version, commit: hel, kort: hel === "okänd" ? "okänd" : hel.slice(0, 7) };
}

/**
 * Källkontrollen: pekar varje posts `k` på något som finns?
 *
 * En post är en sammanfattning, och `k` är dess enda väg tillbaka till
 * dokumentet som äger uppgiften. Varje prompt motorn bygger börjar med «läs
 * {k}» — pekar den fel börjar sessionen med att leta efter en fil som inte
 * finns, och just det felet är osynligt i en grön byggutskrift.
 *
 * Bara värden som **ser ut som en sökväg** prövas: ingen blanksteg och en
 * ändelse. En källa som «Styrgruppsmöte 2026-04-02» är fullt giltig och ska
 * inte anmälas — den pekar på något som inte ligger i repot.
 */
function kallkontroll(items: unknown[], lage: "varna" | "strikt" | "av", datafil: string): void {
  if (lage === "av") return;

  const serUtSomSokvag = (s: string) => /^[\w.\-/]+\.[a-z0-9]+$/i.test(s);
  const trasiga: string[] = [];
  const kallor = new Set<string>();

  for (const i of items) {
    const k = (i as { k?: unknown; t?: unknown }).k;
    const t = String((i as { t?: unknown }).t ?? "(namnlös post)");
    if (typeof k !== "string" || !serUtSomSokvag(k)) continue;
    if (existsSync(join(ROT, k))) kallor.add(k);
    else trasiga.push(`${k} — «${t}»`);
  }

  if (trasiga.length > 0) {
    const rubrik = `${trasiga.length} ${trasiga.length === 1 ? "post pekar" : "poster pekar"} på en källa som inte finns:`;
    if (lage === "strikt") stanna(`${datafil}: ${rubrik}\n  ` + trasiga.join("\n  "));
    console.warn(`\n  Varning · ${rubrik}`);
    for (const r of trasiga) console.warn(`    ${r}`);
    console.warn(`  Rätta \`k\` i ${datafil}, eller sätt "kallkontroll": "av" i bygge.json.`);
  }

  // Har dokumentet rört sig efter roadmapen? Grovt men sant: jämförelsen är
  // per källdokument och inte per post, eftersom alla poster bor i samma fil
  // och därmed delar tidsstämpel. Den säger «de här dokumenten har ändrats
  // sedan posterna sist skrevs» — inte vilken post som blivit fel.
  try {
    const sist = (fil: string) =>
      Number(execFileSync("git", ["log", "-1", "--format=%ct", "--", fil],
        { cwd: ROT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
    const dataTid = sist(datafil);
    if (!Number.isFinite(dataTid) || dataTid === 0) return;
    const rorda = [...kallor]
      .map(k => ({ k, tid: sist(k) }))
      .filter(x => Number.isFinite(x.tid) && x.tid > dataTid)
      .sort((a, b) => b.tid - a.tid);
    if (rorda.length === 0) return;
    const dag = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
    console.warn(`\n  Att titta på · ${rorda.length} ${rorda.length === 1 ? "källa har" : "källor har"} ändrats efter ${datafil} (${dag(dataTid)}):`);
    for (const r of rorda) console.warn(`    ${r.k} — ${dag(r.tid)}`);
  } catch {
    /* inget git, eller ingen historik — kontrollen är ett tillägg, inte ett krav */
  }
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

const dataKalla = las(b.data);
// Datan körs, av samma skäl som konfigen: posterna ska inte behöva stå
// beskrivna på två ställen för att gå att kontrollera.
let items: unknown[] = [];
try {
  items = new Function(`${dataKalla}\n;return ITEMS;`)() as unknown[];
} catch (e) {
  stanna(`${b.data} gick inte att köra: ${(e as Error).message}`);
}
if (!Array.isArray(items)) stanna(`${b.data} exporterar ingen ITEMS-array.`);
kallkontroll(items, b.kallkontroll ?? "varna", b.data);

const motorn = motorStampel();

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
  DATA: dataKalla,
  MOTOR: motor,
  MOTORSTAMPEL: `roadmap-motorn v${motorn.version} · ${motorn.kort}`,
  MOTORVERSION: motorn.version,
  MOTORCOMMIT: motorn.commit,
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
console.log(`\n${b.namn} · ${b.ut} · ${kb(ut.length)}`);
console.log(`  motor v${motorn.version} · ${motorn.kort}`);
console.log(`  varav typsnitt ${kb(typsnitt.length)}, data ${kb(bitar.DATA?.length ?? 0)}, motor ${kb(motor.length)}`);
console.log("\nPublicera med Artifact-verktyget, med url= den befintliga sidan.");
