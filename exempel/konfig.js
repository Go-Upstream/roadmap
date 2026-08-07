/* Exempelprojektets konfig — den minsta som är komplett.
 *
 * Finns för rökprovet i prov.ts, och som mall att kopiera. Varje fält motorn
 * läser står med, så en tom kopia av den här filen räcker för att komma igång.
 * Se README.md under **Sätta upp en ny roadmap**.
 */

const REPO = 'Exempel/exempel';
const REGLER = 'Läs projektets egna regler innan du börjar.';

const OMBYGGE =
  'Posterna ligger i exempel/data.js. Ändra där och kör `npm run exempel`.';

const K = {
  titel: 'Exempelprojektet — Roadmap och backlog',
  under: 'Byggd ur exempel/data.js. Sidan finns för att prova motorn.',

  repo: REPO,
  regler: REGLER,

  // Eget prefix per projekt. localStorage är per origin och inte per sida, så
  // två roadmaps utan egna nycklar skriver över varandras vy och temaval.
  nyckel: 'exempel-roadmap',

  faser: {
    levererat: { label: 'Levererat', color: 'var(--fas-levererat)',
      desc: 'Byggt och verifierat.' },
    nartid:    { label: 'Närtid', color: 'var(--fas-nartid)',
      desc: 'Näst på tur.' },
    senare:    { label: 'Senare', color: 'var(--fas-senare)',
      desc: 'Medvetet framskjutet.' },
    uteslutet: { label: 'Skippat', color: 'var(--fas-uteslutet)',
      desc: 'Aktivt bortvalt, med skälet sparat.' },
  },
  fasOrdning: ['nartid', 'senare', 'levererat', 'uteslutet'],

  // Snabbvalet i vyerna: verbet på knappen och hinken den lägger posten i.
  // Förvalet är just det här, så blocket behövs bara för ett projekt som
  // kallar hinken något annat. Saknas hinken i `faser` ritas knappen inte.
  skippa: { ord: 'Skippa', fas: 'uteslutet' },

  // Etiketten för posternas obesvarad-flagga. Utelämnas den använder motorn
  // «Öppen fråga». Flaggan är inte en fas: en fråga hör till den leverans den
  // blockerar, och det är just det den ska visa.
  obesvarad: {
    label: 'Öppen fråga',
    desc: 'Nästa steg är ett svar, inte kod. Den blockerar leveransen den står i.',
  },

  omradeOrdning: ['Produkt', 'Drift'],

  prioOrdning: { 'hög': 0, 'mellan': 1, 'låg': 2 },

  sidfot: `
    <p style="margin:0">
      <b>Ingenting sparas här.</b> Sidan är en läsvy, byggd ur repot.
    </p>`,

  kallor: `
    <p class="kallrad" style="margin:0">
      Källa: exempel/data.js
    </p>`,

  /* Prompttexterna — den enda delen av konfigen som är värd att lägga tid på.
   *
   * De säger **vad sessionen ska göra**, och ingenting annat. Fakta om posten
   * — beskrivning, leverans, område, prio, källa — lägger motorn själv på
   * sist, i ett eget block; en prompt som räknar upp dem igen säger bara
   * samma sak två gånger. (Ett projekt som hellre skriver sina egna fakta
   * stänger av blocket med `promptKontext: false`.)
   *
   * Det som gör en prompt användbar är ordningen: läs först, säg vad du tänker
   * göra, bygg sedan. En prompt som bara namnger en rubrik ger en session som
   * börjar med att gissa vad rubriken betyder. */
  prompt: {
    session(it) {
      return [
        `Jag vill jobba på roadmap-posten "${it.t}". Börja så här:`,
        '',
        `1. Läs ${it.k}. Posten är en sammanfattning — dokumentet är källan, och det står saker där som inte fick plats i posten.`,
        '2. Berätta vad du förstått att uppgiften innebär och vad du tänker göra. Jag vill se planen innan något byggs.',
        '3. Fråga i stället för att gissa om något är oklart.',
        `4. När arbetet är klart: uppdatera posten så att roadmapen stämmer. ${OMBYGGE}`,
        '',
        REGLER,
      ].join('\n');
    },
    andra(it) {
      return [
        `Jag vill ändra roadmap-posten "${it.t}" — själva posten, inte det den beskriver.`,
        '',
        `Ändringen görs först i ${it.k}, som äger uppgiften, och sedan i posternas fil. ${OMBYGGE}`,
        'Fråga mig vad som ska stå om det inte framgår nedan.',
        '',
        REGLER,
      ].join('\n');
    },
    flytt(it, till, grupp, FAS) {
      const vad = grupp === 'omrade'
        ? `Byt område för "${it.t}" från "${it.omr}" till "${till}".`
        : `Flytta "${it.t}" från "${FAS[it.fas].label}" till "${FAS[till].label}".`;
      return [
        vad,
        '',
        `Ändringen görs först i ${it.k}, som äger uppgiften, och sedan i posternas fil. ${OMBYGGE}`,
        'Stämmer inte flytten mot vad som faktiskt gäller — säg det i stället för att genomföra den.',
        '',
        REGLER,
      ].join('\n');
    },
    uppdatera(it, andringar) {
      return [
        `Uppdatera roadmap-posten "${it.t}":`,
        '',
        ...andringar.map(a => `- ${a}`),
        '',
        `Ändringarna görs först i ${it.k}, som äger uppgiften, och sedan i posternas fil. ${OMBYGGE}`,
        'Ingenting är sparat än — de kommer från en roadmapsida som bara läser.',
        '',
        REGLER,
      ].join('\n');
    },
  },
};
