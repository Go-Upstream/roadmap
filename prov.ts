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
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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
kontroll("panelen renderar beskrivningen genom md()", sida.includes("md(esc(ppNu('d')))"));

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

// Flaggans andra läge: väntar på extern part. `true` är kvar som ett alias
// för «fraga» — det är vad varje befintlig post i alla tre projekten
// bär — så ett fel här skulle tysta flaggan för dem utan att röra deras data.
kontroll("motorn skiljer på flaggans två lägen", sida.includes("function obesvaradLage"));
kontroll("obesvarad: true betyder fortfarande «fraga»",
  sida.includes("if (it.obesvarad === true || it.obesvarad === 'fraga') return 'fraga';"));
kontroll("etiketten för externt-läget kommer ur konfigen", sida.includes("K.obesvaradExtern"));
kontroll("exemplets extern-post bär det andra läget", /obesvarad:\s*'extern'/.test(sida));
kontroll("väljaren erbjuder båda lägena",
  sida.includes("v: 'fraga'") && sida.includes("v: 'extern'"));

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
kontroll("ett pågående drag stänger dörren", sida.includes("if (dragPagar) return;"));
kontroll("dragflaggan kan inte fastna", sida.includes("dragPagar = false; }, true)"));
// Fyra fält går att ändra, och ändringen skrivs i prompten — aldrig i posten.
for (const falt of ["fas", "omr", "prio", "obesvarad"]) {
  kontroll(`fältet ${falt} går att ändra`, sida.includes(`data-valj="${falt}"`));
}
kontroll("ändringen går genom konfigens uppdatera-prompt", sida.includes("K.prompt.uppdatera(aktiv, lista)"));
kontroll("sidan sparar inte panelens val",
  !/localStorage\.setItem\([^)]*utkast/.test(sida));

// Pennan · rubrik och beskrivning redigeras i panelen, från alla tre vyerna.
// Formuläret låg förut i kortet, och bara där: pennan i tabellen och i Kanban
// öppnade en session i stället för en redigering. En regression här ser inte
// trasig ut — knappen finns kvar, den gör bara fel sak.
kontroll("skalet bär textfälten", sida.includes('id="pp-red"') && sida.includes('id="pp-red-vipp"'));
kontroll("det gamla kortformuläret är borta", !sida.includes('class="blankett"'));
kontroll("pennan öppnar panelen och inte en länk",
  sida.includes("data-andra=") && !sida.includes("andraURL"));
kontroll("pennan öppnar panelen med textfälten framme",
  sida.includes("{ redigera: true }"));
kontroll("panelen läser textfälten in i utkastet", sida.includes("function ppLasRed"));
kontroll("en tom ruta räknas inte som en ändring", sida.includes("if (!v || v === aktiv[falt]) delete utkast[falt]"));
kontroll("Escape i ett textfält stänger inte panelen", sida.includes("e.target.closest?.('.pp-red')"));

// Snabbvalet «Skippa» · ett klick i vilken vy som helst som lägger posten i
// den hink projektet använder för det aktivt bortvalda. Det går genom panelen
// och inte rakt ut i en session: sidan sparar ingenting, så ett felklick ska
// gå att ta tillbaka innan det lämnar sidan.
kontroll("motorn har ett snabbval", sida.includes("function skippaHTML"));
kontroll("snabbvalet pekas ut av konfigen", sida.includes("K.skippa"));
kontroll("förvalet är hinken uteslutet", sida.includes("{ fas: 'uteslutet', ord: 'Skippa' }"));
kontroll("snabbvalet ritas inte på en post som redan ligger där",
  sida.includes("!!FAS[SKIPPA.fas] && it.fas !== SKIPPA.fas"));
kontroll("snabbvalet går genom panelen", sida.includes("{ utkast: { fas: SKIPPA.fas } }"));
kontroll("snabbvalet ber om skälet", sida.includes("skriv in skälet"));
kontroll("exemplet har döpt om hinken till Skippat", sida.includes("label: 'Skippat'"));

// Prompten · posten läggs på i klartext sist. Utan det får en session en
// rubrik och ingenting annat — beskrivningen, som är hela innehållet i en
// roadmap-post, följde inte med, och sessionen börjar med att gissa.
kontroll("motorn lägger på posten i klartext", sida.includes("function promptKontext"));
kontroll("beskrivningen går med i prompten", sida.includes("`Beskrivning: ${it.d}`"));
kontroll("blocket går att stänga av", sida.includes("K.promptKontext === false"));
for (const [vad, monster] of [
  ["starta session", "medKontext(K.prompt.session(it, FAS), it)"],
  ["kanbanflytten", "medKontext(K.prompt.flytt(it, till, grupp, FAS), it)"],
  ["panelens ändring", "medKontext(K.prompt.uppdatera(aktiv, lista), aktiv)"],
  ["pennans session", "medKontext(K.prompt.andra(aktiv, FAS), aktiv)"],
] as const) {
  kontroll(`${vad} bär kontexten`, sida.includes(monster));
}
// Tooltiparna som panelen ersatte ska vara borta, annars visas två svar på
// samma fråga — ett avhugget och ett helt.
kontroll("radens och kanbankortets tooltip är borta", !sida.includes("utanMd"));

// Översikten · en rad och inte nio rutor. Rutorna var ett inventarium som tog
// två rader innan en enda post syntes, och ritade tre olika beteenden —
// nollställning, hink, flagga — som samma ruta. Raden bär sorten i formen.
kontroll("motorn ritar filterraden", sida.includes("function chipHTML"));
kontroll("de gamla rutorna är borta", !sida.includes('class="ruta'));
kontroll("skalet bär raden", sida.includes('<div class="oversikt-rad" id="oversikt">'));
kontroll("raden bryter aldrig", sida.includes("min-width: max-content"));

// Leverans och tillstånd skiljs åt utan ett nytt konfigfält: levererat och
// uteslutet är tillstånd, resten leveranser, och den första är den som pågår.
// Ett projekt som döpt om den bortvalda hinken pekar om den med K.skippa.fas.
kontroll("faserna delas i leveranser och tillstånd", sida.includes("const ARKIV_FASER"));
kontroll("den bortvalda hinken räknas som ett tillstånd",
  sida.includes("k === 'levererat' || k === 'uteslutet' || k === SKIPPA.fas"));
kontroll("den pågående leveransen är den första", sida.includes("const PAGAENDE = LEVERANSER[0]"));
kontroll("det avslutade är dolt som förval", sida.includes("visaArkiv || !arArkiv(i.fas)"));
// Blir hinken dold försvinner släppytan med den, och då går det inte längre
// att dra ett kort till «Skippat» i Kanban. Kolumnen står därför alltid kvar.
kontroll("kanban behåller snabbvalets kolumn som släppyta",
  sida.includes("!arArkiv(k) || k === SKIPPA.fas || items.some(i => i.fas === k)"));

// Prio · axeln man prioriterar längs, som förut bara gick att sortera på i
// tabellen och aldrig att välja på. Orden kommer ur konfigen, aldrig ur motorn.
kontroll("prio går att filtrera på", sida.includes("prioFilter"));
kontroll("prioorden kommer ur konfigen", sida.includes("Object.keys(PRIO_ORDNING || {})"));
kontroll("skalet bär prio-segmentet", sida.includes('id="prio-filter"'));
kontroll("ett projekt utan prioordning får ingen kontroll", sida.includes("if (!PRIO_ORD.length)"));

// «Nästa upp» · en lins, inte ett filter. Den ersätter de andra valen i
// stället för att läggas ovanpå dem, och säger alltid vad den gör.
kontroll("motorn har linsen", sida.includes("let linsen = false"));
kontroll("linsen tar den pågående leveransen utan det blockerade",
  sida.includes("i.fas === PAGAENDE && !obesvaradLage(i)"));
kontroll("linsen förklarar sig på filterraden", sida.includes("<b>Nästa upp</b> —"));

// Flaggorna räknas inom det valda. «5 totalt» sa bara att frågorna fanns;
// att fyra av dem ligger i den leverans som pågår är det som gör talet värt
// något.
kontroll("flaggorna räknas inom urvalet", sida.includes("n: inom.filter(i => obesvaradLage(i) === lage).length"));

// Temat · ljust i botten, mörkt ur systemets läge, läsarens val överst.
// Förut stämplade motorn alltid data-theme, och den stämpeln slog ut
// temafilens mediefråga — «annars telefonens läge» var alltså aldrig sant.
kontroll("temafilens botten är ljus", /:root \{\s*\n\s*color-scheme: light;/.test(sida));
kontroll("mörkt kommer ur systemets läge",
  sida.includes("@media (prefers-color-scheme: dark)") &&
  sida.includes(':root:not([data-theme="light"])'));
kontroll("vippan vinner åt båda hållen",
  sida.includes(':root[data-theme="light"]') && sida.includes(':root[data-theme="dark"]'));
kontroll("inget val stämplar ingenting", sida.includes("function speglaSystemet"));
kontroll("värdens egen stämpel skrivs inte över",
  sida.includes("const stampel = document.documentElement.dataset.theme;"));
kontroll("vippan slutar ljuga när systemet byter läge",
  sida.includes("morkMedia.addEventListener('change'"));

// Motorstämpeln · vilken motor sidan byggdes med.
//
// Sidan publiceras för hand, så en pinnflytt som mergats i projektet behöver
// inte betyda att läsarna sett den. Utan stämpeln fanns ingenstans att läsa av
// om det steget blivit gjort — man fick öppna sidan och gissa på utseendet.
const version = (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;
kontroll("sidan bär motorns version", sida.includes(`<meta name="roadmap-motor" content="${version}">`));
kontroll("sidan bär motorns commit", /<meta name="roadmap-commit" content="[0-9a-f]{7,40}">/.test(sida));
kontroll("stämpeln syns också för en läsare", /<p class="motorstampel">roadmap-motorn v[\d.]+ · [0-9a-f]{7}<\/p>/.test(sida));

// Och den får inte bära en tidpunkt. Låsfilen spikar pinnen just för att
// `npm ci` ska ge samma sida i dag som i går; en byggtid i filen hade gjort
// varje bygge till en ny fil utan att något ändrats. Provas genom att bygga
// igen och jämföra byte för byte — det är den egenskap som ska gälla, inte
// frånvaron av något särskilt ord.
{
  const tmp = join(process.cwd(), ".prov-tmp");
  mkdirSync(tmp, { recursive: true });
  const bygge = JSON.parse(readFileSync(join(process.cwd(), "exempel/bygge.json"), "utf8")) as Record<string, unknown>;
  bygge.ut = ".prov-tmp/om.html";
  writeFileSync(join(tmp, "bygge.json"), JSON.stringify(bygge));
  const r = spawnSync("node_modules/.bin/tsx", ["bygg.ts", ".prov-tmp/bygge.json"], { encoding: "utf8" });
  const om = r.status === 0 && existsSync(join(tmp, "om.html")) ? readFileSync(join(tmp, "om.html"), "utf8") : "";
  kontroll("ett ombygge ger exakt samma fil", om === sida,
    om === "" ? `ombygget gick inte att köra: ${r.stderr?.trim() ?? ""}` : `${om.length} tecken mot ${sida.length}`);
  rmSync(tmp, { recursive: true, force: true });
}

// Källkontrollen · pekar varje posts `k` på något som finns?
//
// `k` är postens enda väg tillbaka till dokumentet som äger uppgiften, och
// varje prompt motorn bygger börjar med «läs k». Pekar den fel börjar
// sessionen med att leta efter en fil som inte finns — ett fel som är osynligt
// i en grön byggutskrift.
kontroll("exemplet kör källkontrollen strikt",
  (JSON.parse(readFileSync(join(process.cwd(), "exempel/bygge.json"), "utf8")) as { kallkontroll?: string })
    .kallkontroll === "strikt");
for (const it of ["exempel/docs/exempel.md", "exempel/docs/beslut.md", "exempel/docs/genomfort.md"]) {
  kontroll(`exemplets källa ${it} finns`, existsSync(join(process.cwd(), it)));
}
// Och kontrollen stoppar faktiskt ett bygge. Ett strukturprov hade bara sagt
// att koden står där; det här säger att den gör något.
{
  const tmp = join(process.cwd(), ".prov-tmp");
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, "data.js"),
    "const ITEMS = [{ t: 'Trasig källa', d: 'x', fas: 'nartid', omr: 'Produkt', k: 'docs/finns-inte.md' }];");
  const bygge = JSON.parse(readFileSync(join(process.cwd(), "exempel/bygge.json"), "utf8")) as Record<string, unknown>;
  bygge.data = ".prov-tmp/data.js";
  bygge.ut = ".prov-tmp/trasig.html";
  const kor = (lage: string) => {
    writeFileSync(join(tmp, "bygge.json"), JSON.stringify({ ...bygge, kallkontroll: lage }));
    return spawnSync("node_modules/.bin/tsx", ["bygg.ts", ".prov-tmp/bygge.json"], { encoding: "utf8" });
  };
  const strikt = kor("strikt");
  kontroll("strikt läge stannar bygget på en källa som inte finns", strikt.status !== 0,
    `bygget gick igenom med utfall ${strikt.status}`);
  kontroll("och säger vilken post det gäller",
    `${strikt.stdout}${strikt.stderr}`.includes("docs/finns-inte.md"));
  const varna = kor("varna");
  kontroll("förvalet varnar men bygger ändå", varna.status === 0,
    `${varna.stdout}${varna.stderr}`.slice(-300));
  kontroll("varningen syns i utskriften",
    `${varna.stdout}${varna.stderr}`.includes("docs/finns-inte.md"));
  const av = kor("av");
  kontroll("«av» tiger helt", av.status === 0 && !`${av.stdout}${av.stderr}`.includes("finns-inte"));
  rmSync(tmp, { recursive: true, force: true });
}

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
