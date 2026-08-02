/* Exempelprojektets poster. Tre stycken, en per fas som rökprovet bryr sig om.
 *
 * Fälten: t rubrik · d beskrivning · fas · omr område · prio · k källa.
 * Fas och område måste finnas i konfigens listor, annars faller posten ur
 * grupperingen utan att bygget säger något. */
  const ITEMS = [
    { t: 'Den första posten',
      d: 'En post under Närtid, med en prioritet. Beskrivningen får vara så lång som den behöver — tabellen och kortet klipper den, och Kanban visar den hel.',
      fas: 'nartid', omr: 'Produkt', prio: 'hög', k: 'docs/exempel.md' },
    { t: 'En obesvarad fråga',
      d: 'En öppen fråga ser annorlunda ut än en uppgift, och startar en annan prompt: den ber om ett förslag på hur frågan stängs, inte om kod.',
      fas: 'fraga', omr: 'Produkt', prio: 'mellan', k: 'docs/beslut.md' },
    { t: 'Något som redan är byggt',
      d: 'Levererat är dolt som förval — det som är gjort ska inte konkurrera med det som återstår. Klicka fasrutan eller sök för att se den här raden.',
      fas: 'levererat', omr: 'Drift', k: 'docs/genomfort.md' },
  ];
