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
