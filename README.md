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
   npm i -D @go-upstream/roadmap@github:Go-Upstream/roadmap#v1.0.0
   ```

   Pinna på en tagg och inte på en gren. Ett projekt ska kunna ligga kvar på en
   äldre motor tills det självt vill flytta — annars är en förbättring här en
   ändring i varje projekt samtidigt, vilket är precis vad ett delat verktyg
   ska slippa.

   `tsx` behövs också, om projektet inte redan har det: `npm i -D tsx`.

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
   - `faser` och `fasOrdning` — fem räcker långt, men antalet är fritt. Varje
     fas pekar på en `--fas-*`-token i temat.
   - `omradeOrdning` — områdena i den ordning de ska stå. Ett område som
     saknas här hamnar sist, inte utanför.
   - `prioOrdning` — orden för prioritet och deras inbördes ordning.
   - `sidfot`, `kallor` — HTML. Bruksanvisningen för vyerna står i
     `mall.html` och behöver inte upprepas.
   - `prompt` — texterna. Det är den enda delen som är värd att lägga tid på:
     en prompt som inte säger var posten bor ger en session som gissar.

4. **Skriv `data.js`.** En `const ITEMS = [...]` där varje post har
   `t` (rubrik), `d` (beskrivning), `fas`, `omr` (område), `prio` och
   `k` (källa — vilket dokument posten kommer ur). `fas` och `omr` måste finnas
   i konfigens listor.

   **Beskrivningen tål `**fet**`, `*kursiv*` och `` `kod` ``** — de tre, och
   inga fler. Texten escapas först och taggarna skrivs efteråt, så en post kan
   aldrig smuggla in HTML. Rubriker, listor och länkar hör hemma i filen posten
   kommer ur; `k` pekar dit. I tabellens och Kanbans tooltip tas markörerna
   bort i stället, eftersom ett `title`-attribut visar text och inte HTML.

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

En ändring når inget projekt förrän den fått en tagg och projektet flyttat sin
pinning dit. Tagga med `vMAJOR.MINOR.PATCH`, och höj major när ett projekts
`konfig.js`, `data.js` eller `bygge.json` måste ändras för att fortsätta bygga.

## Att veta

- **Levererat är dolt som förval.** Det som är gjort ska inte konkurrera med
  det som återstår. Det visas när man klickar fasrutan eller söker.
- **Sidan är bred.** Tabellen har `min-width: 780px` i en ram som scrollar i
  sidled, så på en telefon syns rubrikkolumnen först. Därför startar en
  session både från rubriken och från åtgärdscellen.
- **En flytt i Kanban ändrar ingenting.** Den öppnar en prompt som föreslår
  ändringen i dokumentet posten kommer ur.
- **Motorn körs utan `use strict`**, insvept i en IIFE i `mall.html`.
- **`bygg.ts` läser projektets filer från `process.cwd()`** och sina egna från
  sin egen katalog. Det är därför motorn kan bo i `node_modules/` utan att
  någon sökväg i ett projekt behöver veta om det.
