# Roadmap-motorn

Delad motor för Go-Upstreams roadmapsidor. Konsumenterna hämtar den som ett
pinnat beroende — en tarball låst till en commit i respektive `package.json` —
och vilka de är står i `konsumenter.json`, som är den enda listan.

**Två mål, och båda gäller:** en förbättring görs *en gång* här, och *alla* kör
den senaste motorn. Det andra är nytt. Pinnen är kvar för att bygget ska vara
reproducerbart, men den flyttas av arbetsflödet `Pinnflytt` vid varje grön
merge till `main` — inte av någon som råkar komma ihåg det. Se **Pinnflytten**
i README.

## Arbetsregler

- **Allt landar via pull request på `main`.** Kontrollen `prov` (npm test +
  typkontroll) måste vara grön — ett fel här är ett fel hos alla tre
  konsumenterna, och `prov.ts` säger vad varje kontroll skyddar mot.
- **Öppna PR:en själv när arbetet är pushat**, utan att fråga och utan att
  erbjuda. Prenumerera på den med `mcp__github__subscribe_pr_activity` —
  aldrig tvillingen på `claude-code-remote`-servern, som gör samma sak men
  kostar en godkännandedialog — och driv den till grönt. Rapportera bara det
  som ändrat sig.
- **`send_later` aldrig på eget initiativ** — varje anrop är en
  godkännandedialog, och den kommer när ingen sitter vid datorn. Det som inte
  syns via PR-prenumerationen eller skalet rapporteras som overifierat; en
  påminnelse schemaläggs bara när ägaren uttryckligen bett om en. (Gemensamt
  Go-Upstream-beslut 4 aug 2026, underlaget i ABkolls `docs/beslut.md`.)
- **Auto-merge får användas brett här — men väg in att merge nu betyder
  pinnflytt nu.** En merge till `main` driftsätter fortfarande ingenting av
  sig självt: pinnflyttens PR går in i konsumenten, men sidan de läser byter
  först när någon bygger om och publicerar. Slå på auto-merge när PR:en är
  grön — utom när ändringen bryter motorns kontrakt mot konsumenterna
  (fältnamn i posterna, CSS-klasser temafilerna riktar sig mot, mallens
  platshållare). Den sortens PR lämnas åt ägaren; nu är skälet inte att nästa
  pinnflytt ärver överraskningen utan att den kommer inom minuter.
- **En «release» sker av sig själv.** `Pinnflytt` öppnar PR:en i varje
  konsument; skriv inte hashar för hand. Bumpa `version` här vid
  beteendeändringar — numret är lässtöd och står i pinnflyttens PR-titel. Det
  finns inga npm-publiceringar och inga git-taggar.
- **Ett nytt projekt läggs till i `konsumenter.json`**, annars når ingen
  pinnflytt det. Ett projekt som tas bort ur listan slutar flyttas fram — det
  är den enda vägen ur, och den ska vara ett medvetet val.
- **Publiceringen är kvar hos en människa.** Ett GitHub-jobb kan inte köra
  Artifact-verktyget. Rapportera aldrig en pinnflytt som «ute hos läsarna»
  förrän sidan byggts om och publicerats med `url=` den befintliga artefakten.
- Svenska i dokumentation och commit-meddelanden, som i resten av repot.

## Skydd och nycklar på `main` (görs en gång, av ägaren)

**Nyckeln pinnflytten behöver:** en fine-grained PAT med *Contents: read and
write* och *Pull requests: read and write* på varje repo i
`konsumenter.json`, lagd som hemligheten **`PINNFLYTT_TOKEN`** under
*Settings → Secrets and variables → Actions*. Utan den stannar arbetsflödet
på första steget med just det felmeddelandet i stället för att falla någonstans
längre in. Slå också på *Allow auto-merge* i varje konsumentrepo, annars står
pinnflyttens PR öppen och väntar på en tryckning.

Repot är publikt och konsumenterna privata. Därför har `pinnflytt.yml` ingen
`pull_request`-utlösare: en gren från en fork skulle annars kunna nå nyckeln.
`workflow_run` kör alltid med basrepots hemligheter, och bara `main` släpps
igenom.


**Settings → Rules → Rulesets → New branch ruleset:** namn `main`, Enforcement
**Active**, target *Include default branch*. Kryssa i: **Restrict deletions**,
**Block force pushes**, **Require a pull request before merging** (0
approvals, endast **squash**, require conversation resolution) och **Require
status checks to pass** med kontrollen **`prov`** samt *require branches to be
up to date*. Bypass-listan lämnas tom. Under **Settings → General → Pull
Requests:** slå på *Allow auto-merge* och *Automatically delete head
branches*. Samma uppsättning som i ABkoll, Drilla och Helny.
