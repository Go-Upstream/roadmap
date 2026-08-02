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
kontroll("panelen renderar beskrivningen genom md()", sida.includes("md(esc(aktiv.d))"));

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

kontroll("md: fetstil", md("en **stark** sak") === "en <b>stark</b> sak");
kontroll("md: kursiv", md("en *lutad* sak") === "en <i>lutad</i> sak");
kontroll("md: kod", md("en `kod` sak") === "en <code>kod</code> sak");
kontroll("md: en ensam asterisk lämnas", md("2 * 3 = 6") === "2 * 3 = 6");
kontroll("md: markörerna över en radbrytning parar inte ihop sig",
  md("en * rad\nen * till") === "en * rad\nen * till");
kontroll("md: skriver ingen HTML som inte är dess egen",
  md("&lt;script&gt; **fet**") === "&lt;script&gt; <b>fet</b>");

// Flaggan «obesvarad». Den är ett tillstånd på posten och inte en fas — en
// fråga hör till den leverans den blockerar — så den måste synas i alla tre
// vyerna och gå att filtrera på. Ett fel här gör en fråga omöjlig att skilja
// från en bygguppgift, vilket är precis vad flaggan finns för att undvika.
kontroll("motorn har en obesvarad-bricka", sida.includes("function obesvaradHTML"));
for (const [vy, monster] of [
  ["kortet", "${obesvaradHTML(it)}\n          ${prioHTML"],
  ["tabellen", "${f.label}</span>${obesvaradHTML(it)}</td>"],
  ["kanban", '<div class="kmeta">${obesvaradHTML(it)}'],
] as const) {
  kontroll(`brickan ritas i ${vy}`, sida.includes(monster));
}
kontroll("obesvarade går att filtrera på", sida.includes("obesvaradFilter"));
kontroll("etiketten kommer ur konfigen", sida.includes("K.obesvarad"));
kontroll("exemplets fråga bär flaggan", /obesvarad:\s*true/.test(sida));

// Panelen bakom en rubrik. Den ersatte webbläsarens `title`-tooltip, som inte
// finns på en telefon — så en regression här tar bort förklaringen helt för
// den som läser i mobilen, utan att något ser trasigt ut på en dator.
kontroll("skalet bär panelen", sida.includes('id="postpanel"') && sida.includes('id="valjare"'));
for (const [vy, monster] of [
  ["kortet", '<h3 role="button" tabindex="0" data-oppna='],
  ["tabellen", '<button type="button" class="t-start" data-oppna='],
  ["kanban", '<div class="krubrik" role="button" tabindex="0" data-oppna='],
] as const) {
  kontroll(`rubriken i ${vy} öppnar panelen`, sida.includes(monster));
}
// I Kanban är det bara rubriken som öppnar — kortet i övrigt är dragbart, och
// de två gesterna skulle annars krocka på en telefon.
kontroll("kanbankortet i övrigt öppnar inte panelen",
  !/<article class="kkort"[^>]*data-oppna/.test(sida));
kontroll("ett pågående drag stänger dörren", sida.includes("if (!traff || dragPagar) return;"));
kontroll("dragflaggan kan inte fastna", sida.includes("dragPagar = false; }, true)"));
// Fyra fält går att ändra, och ändringen skrivs i prompten — aldrig i posten.
for (const falt of ["fas", "omr", "prio", "obesvarad"]) {
  kontroll(`fältet ${falt} går att ändra`, sida.includes(`data-valj="${falt}"`));
}
kontroll("ändringen går genom konfigens uppdatera-prompt", sida.includes("K.prompt.uppdatera(aktiv, lista)"));
kontroll("sidan sparar inte panelens val",
  !/localStorage\.setItem\([^)]*utkast/.test(sida));
// Tooltiparna som panelen ersatte ska vara borta, annars visas två svar på
// samma fråga — ett avhugget och ett helt.
kontroll("radens och kanbankortets tooltip är borta", !sida.includes("utanMd"));

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
