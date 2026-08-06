# Roadmap-motorn

Delad motor för Go-Upstreams roadmapsidor. ABkoll, Drilla och AntiqFlow hämtar
den som ett pinnat beroende — en tarball låst till en commit i respektive
`package.json`. En förbättring görs en gång här, och den når ett projekt först
när projektet flyttar fram sin pinnade commit.

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
- **Auto-merge får användas brett här.** En merge till `main` driftsätter
  ingenting: konsumenterna är pinnade och påverkas först när pinnen flyttas.
  Slå på auto-merge när PR:en är grön — utom när ändringen bryter motorns
  kontrakt mot konsumenterna (fältnamn i posterna, CSS-klasser temafilerna
  riktar sig mot, mallens platshållare). Den sortens PR lämnas åt ägaren,
  annars ärver nästa pinnflytt överraskningen.
- **En «release» är en pinnflytt.** Uppdatera commit-hashen för
  `@go-upstream/roadmap` i konsumentens `package.json` (ABkoll, Drilla,
  AntiqFlow), i en egen PR i det repot. Bumpa `version` här vid
  beteendeändringar som lässtöd — det finns inga npm-publiceringar och inga
  git-taggar.
- Svenska i dokumentation och commit-meddelanden, som i resten av repot.

## Skydd på `main` (görs en gång, av ägaren)

**Settings → Rules → Rulesets → New branch ruleset:** namn `main`, Enforcement
**Active**, target *Include default branch*. Kryssa i: **Restrict deletions**,
**Block force pushes**, **Require a pull request before merging** (0
approvals, endast **squash**, require conversation resolution) och **Require
status checks to pass** med kontrollen **`prov`** samt *require branches to be
up to date*. Bypass-listan lämnas tom. Under **Settings → General → Pull
Requests:** slå på *Allow auto-merge* och *Automatically delete head
branches*. Samma uppsättning som i ABkoll, AntiqFlow och Drilla.
