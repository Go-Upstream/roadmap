/**
 * Rökprovet: bygger exempelinstansen och kontrollerar det som tyst kan gå
 * sönder för varje projekt som använder motorn.
 *
 *   npm test        # bygger exempel/ och kör det här
 *
 * Motorn stannar redan självmant på två fel — en temafil som inte sätter varje
 * token `bas.css` läser, och en platshållare i skalet som ingen fyllde. Provet
 * finns för att de kontrollerna ska köras **innan** en ändring når ett projekt,
 * och för att fånga det tredje felet ingen av dem ser: en sida som hämtar något
 * utifrån.
 *
 * Varför just den: en publicerad artefaktsida ligger bakom en CSP som blockerar
 * varje anrop till en annan värd. En `<link>` till ett typsnitts-CDN faller
 * alltså tyst tillbaka på systemets snitt, och en sida som ser rätt ut lokalt
 * ser fel ut för alla andra. Det är ett fel som inte hörs när det händer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const UT = join(process.cwd(), "exempel/byggd/exempel-roadmap.html");

let fel = 0;
function kontroll(vad: string, ok: boolean, detalj = ""): void {
  if (ok) {
    console.log(`  ok    ${vad}`);
    return;
  }
  fel++;
  console.error(`  FEL   ${vad}${detalj === "" ? "" : `\n        ${detalj}`}`);
}

let sida: string;
try {
  sida = readFileSync(UT, "utf8");
} catch {
  console.error(`\nProvet avbröts: ${UT} finns inte. Kör \`npm run exempel\` först.\n`);
  process.exit(1);
}

console.log(`\nProv mot ${UT} (${Math.round(sida.length / 1024)} kB)\n`);

// Skalet är ifyllt. bygg.ts stannar redan på det här, så ett utfall här betyder
// att kontrollen i bygget slutat fungera — inte att någon glömt en platshållare.
const kvar = [...sida.matchAll(/\{\{([A-Z]+)\}\}/g)].map((m) => m[1]);
kontroll("inga ofyllda platshållare", kvar.length === 0, [...new Set(kvar)].join(", "));

// Konfigen och datan nådde fram. Utan de här skulle en sida med tomt innehåll
// och rätt ram gå igenom som byggd.
kontroll("konfigens titel står i sidan", sida.includes("Exempelprojektet — Roadmap och backlog"));
for (const rubrik of ["Den första posten", "En obesvarad fråga", "Något som redan är byggt"]) {
  kontroll(`posten «${rubrik}» kom med`, sida.includes(rubrik));
}

// Temat kom med. `--fas-nartid` sätts av temafilen och läses av bas.css.
kontroll("temats fastoken finns", sida.includes("--fas-nartid"));

// Motorn kom med, och kortet renderar beskrivningen genom md().
//
// **Korten finns inte i den byggda filen** — de ritas i webbläsaren, så sidan
// bär bara motorn och datan. Det här är därför ett strukturprov: det fångar
// att någon skriver tillbaka `hl(it.d)` och tar bort renderingen, vilket är
// den regression som annars syns som asterisker mitt i en mening.
kontroll("kortet renderar beskrivningen genom md()", sida.includes("md(hl(it.d))"));
kontroll("tooltipen rensar markdown i stället", sida.includes("esc(utanMd(it.d))"));

// Och funktionerna själva, körda ur motorns källa. Rena funktioner över en
// sträng, så de går att prova utan DOM — och de är det enda stället där HTML
// skrivs ut av motorn i stället för att escapas bort.
const motor = readFileSync(join(process.cwd(), "motor.js"), "utf8");
function hamta(namn: string): (s: string) => string {
  const m = motor.match(new RegExp(`function ${namn}\\((\\w+)\\) \\{([\\s\\S]*?)\\n  \\}`));
  if (!m) {
    console.error(`\nProvet avbröts: hittade inte funktionen ${namn}() i motor.js\n`);
    process.exit(1);
  }
  return new Function(m[1]!, m[2]!) as (s: string) => string;
}
const md = hamta("md");
const utanMd = hamta("utanMd");

kontroll("md: fetstil", md("en **stark** sak") === "en <b>stark</b> sak");
kontroll("md: kursiv", md("en *lutad* sak") === "en <i>lutad</i> sak");
kontroll("md: kod", md("en `kod` sak") === "en <code>kod</code> sak");
kontroll("md: en ensam asterisk lämnas", md("2 * 3 = 6") === "2 * 3 = 6");
kontroll("md: markörerna över en radbrytning parar inte ihop sig",
  md("en * rad\nen * till") === "en * rad\nen * till");
kontroll("md: skriver ingen HTML som inte är dess egen",
  md("&lt;script&gt; **fet**") === "&lt;script&gt; <b>fet</b>");
kontroll("utanMd: markörerna bort, inga taggar in",
  utanMd("en **stark** och `kod`") === "en stark och kod");

// Ingenting hämtas utifrån. Tre former, eftersom de blockeras var för sig.
const externa: string[] = [];
for (const [monster, vad] of [
  [/<script[^>]+\ssrc=/gi, "<script src=…>"],
  [/<link[^>]+\shref=/gi, "<link href=…>"],
  [/@import\s/gi, "@import"],
  [/url\(\s*['"]?https?:/gi, "url(http…)"],
] as const) {
  const traffar = sida.match(monster);
  if (traffar) externa.push(`${vad} × ${traffar.length}`);
}
kontroll("sidan hämtar ingenting från en annan värd", externa.length === 0, externa.join(", "));

console.log("");
if (fel > 0) {
  console.error(`${fel} kontroll${fel === 1 ? "" : "er"} föll.\n`);
  process.exit(1);
}
console.log("Alla kontroller gröna.\n");
