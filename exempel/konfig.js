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
    uteslutet: { label: 'Uteslutet', color: 'var(--fas-uteslutet)',
      desc: 'Aktivt bortvalt, med skälet sparat.' },
  },
  fasOrdning: ['nartid', 'senare', 'levererat', 'uteslutet'],

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

  prompt: {
    session(it) {
      return `Jag vill jobba på "${it.t}" (område: ${it.omr}). Läs ${it.k} först. ${REGLER}`;
    },
    andra(it, FAS) {
      return `Jag vill ändra roadmap-posten "${it.t}" (fas: ${FAS[it.fas].label}). ` +
        `Posten kommer ur ${it.k} — ändra först där. ${OMBYGGE} ${REGLER}`;
    },
    flytt(it, till, grupp, FAS) {
      if (grupp === 'omrade') {
        return `Ändra område för "${it.t}" från "${it.omr}" till "${till}". ${OMBYGGE} ${REGLER}`;
      }
      return `Flytta "${it.t}" från "${FAS[it.fas].label}" till "${FAS[till].label}". ` +
        `${OMBYGGE} ${REGLER}`;
    },
    uppdatera(it, andringar) {
      return `Uppdatera "${it.t}": ${andringar.join('; ')}. ${OMBYGGE} ${REGLER}`;
    },
  },
};
