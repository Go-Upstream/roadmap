# Roadmap

En läsvy av ett projekts roadmap och backlog: kort, tabell och Kanban över
samma poster, med sök, filter, gruppering och sortering. Varje post har två
åtgärder som öppnar `claude.ai/code` med en förifylld prompt — **Starta
session** och **Ändra** — och ingen av dem skickas automatiskt.

Sidan är en enda HTML-fil utan externa hämtningar. Den publiceras som en
artefakt och läses lika gärna i en telefon som på en skärm.

**Ingenting sparas i sidan.** Den är byggd ur projektets repo och skriver inte
tillbaka. En ändring görs i dokumentet som äger uppgiften, sedan i `data.js`,
och sedan byggs sidan om.

**Motorn känner inte till något projekt.** Allt den behöver kommer ur `K`
(konfigen) och `ITEMS` (datan), som byggs in före den. Därför bor den här och
inte i ett projekt: en förbättring görs en gång, och varje projekt hämtar den
när det självt vill.

## Delarna

Det som ligger i paketet, och som inte byts per projekt:

| Fil | Vad |
|---|---|
| `motor.js` | Vyerna, sök, filter, gruppering, sortering, kanban-drag |
| `bas.css` | Layout och komponenter. Läser bara tokens |
| `mall.html` | Skalet, med platshållare |
| `tema-neutral.css` | Neutralt standardtema |
| `bygg.ts` | Bygget |

Det som varje projekt äger själv, i en katalog i sitt eget repo:

| Fil | Vad |
|---|---|
| `konfig.js` | Repo, regler, faser, områden, märke, prompttexter |
| `data.js` | Posterna |
| `tema.css` | Färg, typografi, mått — om projektet har en grafisk profil |
| `bygge.json` | Vilka filer bygget läser och vart det skriver |

`exempel/` i det här repot är en komplett sådan katalog. Den är minsta möjliga
och går att kopiera rakt av.

## Sätta upp en ny roadmap

1. **Installera motorn.**

   ```bash
   npm i -D @go-upstream/roadmap@github:Go-Upstream/roadmap#<commit>
   ```

   Pinna på en **commit** — inte på en tagg och inte på en gren. Det finns
   inga taggar; pinnen är hashen, och den flyttas inte för hand. Se
   **Pinnflytten** nedan.

   `tsx` behövs också, om projektet inte redan har det: `npm i -D tsx`.

   Lägg sedan till projektet i `konsumenter.json` här, annars når ingen
   pinnflytt det.

2. **Skapa katalogen.** `roadmap/` i projektets rot fungerar; namnet är fritt
   så länge `bygge.json` pekar rätt. Kopiera `exempel/konfig.js` och
   `exempel/data.js` dit som utgångspunkt.

3. **Skriv om konfigen.** Fälten:

   - `titel`, `under` — sidhuvudet.
   - `repo` — `ägare/repo`, går med i varje sessionslänk.
   - `regler` — projektets grenregler, en eller två meningar. De skrivs in i
     varje prompt så att sessionen inte hinner bryta dem innan den läst något.
   - `nyckel` — **ett eget prefix per projekt.** Alla artefakter ligger på
     `claude.ai`, och `localStorage` är per origin, inte per sida. Två projekt
     med samma nyckel skriver över varandras sparade vy, gruppering och
     temaval.
   - `faser` och `fasOrdning` — **projektets leveranser, i ordning, plus två
     tillstånd.** `levererat` och `uteslutet` är tillstånd; resten är
     leveranser, och den första är per definition den som pågår. Ett projekt
     behöver alltså ingen fas som heter «närtid» — den heter Pilot, Etapp 4
     eller vad leveransen nu kallas i projektets egna dokument. Sist bör det
     stå en hink för det som inte är placerat; «Obestämt» är ett bra namn,
     eftersom den då ställer en fråga i stället för att vara en skräphög.
     Varje fas pekar på en `--fas-*`-token i temat.
   - `skippa` — **snabbvalet i vyerna**, `{ ord, fas }`. `ord` är verbet på
     knappen och `fas` är hinken den lägger posten i; förvalet är
     `{ ord: 'Skippa', fas: 'uteslutet' }`, så fältet behövs bara för ett
     projekt som kallar hinken något annat. Saknas hinken i `faser` ritas
     knappen inte alls.
   - `promptKontext` — sätt `false` för att stänga av faktablocket motorn
     annars lägger sist i varje prompt. Se `prompt` nedan.
   - `obesvarad` — etiketten för flaggan nedan. Utelämnas den blir det
     «Öppen fråga».
   - `omradeOrdning` — områdena i den ordning de ska stå. Ett område som
     saknas här hamnar sist, inte utanför.
   - `prioOrdning` — orden för prioritet och deras inbördes ordning.
   - `sidfot`, `kallor` — HTML. Bruksanvisningen för vyerna står i
     `mall.html` och behöver inte upprepas.
   - `prompt` — texterna. Det är den enda delen som är värd att lägga tid på.

     **De ska säga vad sessionen ska göra, inte vad posten innehåller.**
     Motorn lägger själv posten i klartext sist i varje prompt — rubrik,
     beskrivning, leverans med sin förklaring, område, prio, källa och en
     eventuell flagga — under rubriken `--- Posten, ur roadmapen ---`. Det
     löser felet som annars är svårt att se: en prompt som bara namnger en
     rubrik ger en session som börjar med att gissa vad rubriken betyder,
     eftersom **beskrivningen aldrig följde med**. En konfig som räknar upp
     samma fakta säger dem två gånger; `promptKontext: false` stänger av
     blocket för ett projekt som hellre skriver dem själv.

     Det som gör resten av prompten användbar är ordningen: *läs först, säg
     vad du tänker göra, bygg sedan* — och var ändringen ska landa när den är
     gjord. `exempel/konfig.js` är skriven så och går att kopiera rakt av.

     Fyra texter, alla fyra använda: `session` (Starta session), `andra`
     (pennan, öppnad utan att något ändrats), `flytt` (ett drag i Kanban) och
     `uppdatera` (varje konkret ändring i panelen, snabbvalet inräknat).

4. **Skriv `data.js`.** En `const ITEMS = [...]` där varje post har
   `t` (rubrik), `d` (beskrivning), `fas`, `omr` (område), `prio` och
   `k` (källa — vilket dokument posten kommer ur). `fas` och `omr` måste finnas
   i konfigens listor.

   **En post kan bära `obesvarad: true`.** Det är en post vars nästa steg är
   ett svar och inte ett bygge — och den är **en flagga, inte en fas**, just
   för att en fråga hör till den leverans den blockerar. Låg frågorna i en egen
   hink gick det att se att de fanns, men inte vad de stod i vägen för. Brickan
   ritas i alla tre vyerna och får en egen ruta i översikten att filtrera på.

   **Beskrivningen tål `**fet**`, `*kursiv*` och `` `kod` ``** — de tre, och
   inga fler. Texten escapas först och taggarna skrivs efteråt, så en post kan
   aldrig smuggla in HTML. Rubriker, listor och länkar hör hemma i filen posten
   kommer ur; `k` pekar dit.

   **En tryckning på en posts rubrik öppnar den i en panel** — i alla tre
   vyerna, och i Kanban är det bara rubriken, eftersom kortet i övrigt är
   dragbart. Panelen visar hela beskrivningen, vad hinken betyder (`desc` ur
   konfigens `faser`), vad `prio` betyder *inom* hinken, och vilken leverans
   en öppen fråga blockerar. Den ersatte webbläsarens `title`-tooltip, som
   inte bryter rad, kommer efter en sekunds hovrande — och **på en telefon
   inte finns alls**, eftersom det inte går att hovra.

   **Sex fält går att ändra i panelen**: rubriken, beskrivningen, hinken,
   området, prio och flaggan. Ett val skriver om **prompten**, aldrig posten —
   sidan byggs ur repot, så ett sparat värde hade skrivits över tyst vid nästa
   bygge. Det valda får en streckad ram, en rad säger vad som ändrats, och
   knappen byter till «Öppna session med ändringen», som öppnar
   `K.prompt.uppdatera`. Samma mekanik som en flytt i Kanban, och samma skydd
   mot att trycka fel.

   **Pennan ✎ i alla tre vyerna öppnar samma panel**, med rubrik och
   beskrivning framme som textfält. Den låg förut som ett formulär inne i
   kortet — tre rader att skriva en beskrivning i, i ett rutnät som hoppade
   när kortet växte — och bara där, så pennan i tabellen och i Kanban startade
   en session i stället för att öppna en redigering. Nu är ytan en, och den
   har bladets hela bredd.

   **Snabbvalet ⊘ lägger posten åt sidan.** Det finns i alla tre vyerna och på
   varje post som inte redan ligger där, och det öppnar panelen med hinken
   omställd i utkastet — inte en session direkt. Ändringsraden är då redan
   framme och «Ångra» ligger bredvid, vilket är samma skydd som Kanban-draget
   har. Prompten ber sessionen fråga efter **skälet** och skriva in det:
   hinken finns för det aktivt bortvalda, och utan skäl är den en skräphög.

   Det snabbaste sättet att få den första versionen är att låta en session
   läsa projektets egna dokument och skriva filen. Räkna med att rätta den
   efteråt — en avläsning missar det som bara står i förbigående.

5. **Välj tema.** Har projektet ingen grafisk profil: peka `bygge.json` på
   `node_modules/@go-upstream/roadmap/tema-neutral.css`. Har det en: kopiera
   den filen in i projektet och byt värdena. Temat måste sätta **varje** token
   `bas.css` läser — bygget kontrollerar det och stannar med en lista om något
   fattas.

6. **Skriv `bygge.json`.** Sökvägar räknas från projektets rot.

   ```json
   {
     "namn": "Projektet",
     "ut": "roadmap/byggd/projektet-roadmap.html",
     "konfig": "roadmap/konfig.js",
     "data": "roadmap/data.js",
     "tema": "node_modules/@go-upstream/roadmap/tema-neutral.css",
     "marke": "roadmap/marke.svg",
     "typsnittCss": [],
     "typsnittFiler": []
   }
   ```

   `marke` är valfritt — utan det blir platsen i sidhuvudet tom.

7. **Lägg till skriptet** i `package.json`:

   ```json
   "roadmap": "tsx node_modules/@go-upstream/roadmap/bygg.ts"
   ```

   och lägg utkatalogen i `.gitignore` — den byggda filen är härledd.

8. **Bygg och publicera.** `npm run roadmap`, sedan Artifact-verktyget på den
   byggda filen. Publicera **med `url`** när sidan redan finns, annars skapas
   en ny artefakt varje gång och länken du delat slutar uppdateras.

## Typsnitt

`typsnittCss` klistrar in CSS-filer med `@font-face` orörda.
`typsnittFiler` bakar in en `.woff2` eller `.ttf` som data-URI. Båda finns för
att en artefaktsida inte får hämta från någon annan värd — ett `<link>` till
ett typsnitts-CDN blockeras och sidan faller tyst tillbaka på systemets snitt.
Rökprovet kontrollerar just det.

Sprider du ett typsnitt med sidan gäller dess licens. Standardtemat använder
bara systemtypsnitt, så där följer ingen licens med.

## Ändra i motorn

```bash
npm install
npm test        # bygger exempel/ och kör prov.ts
```

Provet bygger exempelinstansen och kontrollerar att skalet är ifyllt, att
konfigen och datan nådde fram, att temat kom med, och att sidan inte hämtar
något från en annan värd. Det körs också av GitHub Actions på varje push.

Bumpa `version` i `package.json` vid beteendeändringar — höj major när ett
projekts `konfig.js`, `data.js` eller `bygge.json` måste ändras för att
fortsätta bygga. Numret är lässtöd och står i pinnflyttens PR-titel; det finns
inga npm-publiceringar och inga git-taggar.

## Pinnflytten

**Målet är att alla projekt kör senaste motorn.** Motorn byggs en gång, och
den ska nå alla — det första är skälet till att den bor här, det andra är vad
som gör det värt något.

Pinnen finns ändå kvar, för att den gör bygget reproducerbart: `package-lock.json`
spikar den upplösta commiten, så `npm ci` ger samma sida i dag som i går. Det
som är borta är kravet att någon ska komma ihåg att flytta den.

Arbetsgången, som ingen behöver driva:

1. En PR mergas till `main` här och kontrollen `prov` blir grön.
2. Arbetsflödet **Pinnflytt** går igenom `konsumenter.json` och öppnar — eller
   uppdaterar — en PR i varje projekt som skriver om hashen i `package.json`
   och `package-lock.json`. Grenen heter `roadmap/pinnflytt` och återanvänds,
   så två motorcommiter tätt inpå varandra ger en PR och inte två.
3. Projektets egna kontroller kör. Är `automerge` sann i `konsumenter.json`
   går PR:en in av sig själv när de är gröna.

Ett projekt som inte hämtar `@go-upstream/roadmap` hoppas över med en rad i
loggen, så en felaktig post i listan öppnar ingen PR.

**Det sista steget är fortfarande manuellt, och det är avsiktligt.** Sidan är
en artefakt som publiceras med Artifact-verktyget, vilket ett GitHub-jobb inte
kan göra. Pinnflyttens PR bär därför både byggkommandot och artefaktens url,
och den url:en måste återanvändas — publicerar man utan `url` skapas en ny
artefakt och den länk som redan delats slutar uppdateras.

Vill man se en flytt hända utan att vänta på en merge: kör **Pinnflytt** via
*Actions → Run workflow*.

### «Skapa roadmap»

Frasen som betyder «gör det sista, manuella steget för det här projektet»: en
session som får **`Skapa roadmap <Projekt>`** — till exempel `Skapa roadmap
Helny` — ska

1. klona eller uppdatera projektets repo,
2. `npm install`, så att den pinnade motorn (eller en ny pinne, om en
   pinnflytts-PR redan mergats) hämtas,
3. köra byggkommandot ur `konsumenter.json` — `npm run roadmap` för alla tre
   idag,
4. verifiera den byggda sidan (öppna den, pröva snabbvalet, pennan och
   prompten — ett grönt bygge bevisar inte att sidan fungerar i webbläsaren),
5. publicera med Artifact-verktyget och **`url=` projektets rad i
   `konsumenter.json`** — aldrig utan, annars mister den delade länken sin
   koppling.

Projektnamnet är valfritt när sessionen redan bara har ett konsumentrepo
öppet — bara **`Skapa roadmap`** räcker då. Med flera repo i sammanhanget
pekar namnet ut vilket, och det ska matcha en `repo`-post i
`konsumenter.json` (`ABkoll`, `drilla` eller `Helny` just nu).

Är pinnen i `package.json` redan den senaste — inget att flytta, alltså
inget att bygga om — säg det i stället för att publicera en oförändrad sida.

## Att veta

- **Levererat är dolt som förval.** Det som är gjort ska inte konkurrera med
  det som återstår. Det visas när man klickar fasrutan eller söker.
- **Sidan är bred.** Tabellen har `min-width: 780px` i en ram som scrollar i
  sidled, så på en telefon syns rubrikkolumnen först. Därför startar en
  session både från rubriken och från åtgärdscellen.
- **En flytt i Kanban ändrar ingenting.** Den öppnar en prompt som föreslår
  ändringen i dokumentet posten kommer ur. Det gäller varje ändring i sidan,
  snabbvalet ⊘ inräknat.
- **Prompten bär posten i klartext.** Motorn lägger den sist, under
  `--- Posten, ur roadmapen ---`. Konfigens texter kan därför handla om vad
  sessionen ska göra.
- **Motorn körs utan `use strict`**, insvept i en IIFE i `mall.html`.
- **`bygg.ts` läser projektets filer från `process.cwd()`** och sina egna från
  sin egen katalog. Det är därför motorn kan bo i `node_modules/` utan att
  någon sökväg i ett projekt behöver veta om det.
