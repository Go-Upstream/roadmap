/* Exempelprojektets poster — en handfull, en per sak rökprovet bryr sig om.
 *
 * Fälten: t rubrik · d beskrivning · fas · omr område · prio · k källa.
 * Fas och område måste finnas i konfigens listor, annars faller posten ur
 * grupperingen utan att bygget säger något. */
  const ITEMS = [
    { t: 'Den första posten',
      d: 'En post under Närtid, med en prioritet. Beskrivningen bär **fetstil**, *kursiv* och `kod` — de tre former motorn renderar, och inga fler. En rubrik eller en lista hör hemma i filen posten kommer ur, och källfältet pekar dit.',
      fas: 'nartid', omr: 'Produkt', prio: 'hög', k: 'exempel/docs/exempel.md' },
    { t: 'En obesvarad fråga',
      d: 'En obesvarad post ligger i den leverans den blockerar och bär en flagga — inte i en egen hink. Så syns det **vad** frågan står i vägen för, inte bara att den finns.',
      fas: 'nartid', omr: 'Produkt', prio: 'mellan', obesvarad: true, k: 'exempel/docs/beslut.md' },
    { t: 'En post som väntar på en extern part',
      d: 'Samma flagga, ett annat läge: bollen ligger inte hos teamet utan hos någon utanför det. `obesvarad: \'extern\'` i stället för `true`.',
      fas: 'nartid', omr: 'Drift', prio: 'låg', obesvarad: 'extern', k: 'exempel/docs/beslut.md' },
    { t: 'Något som redan är byggt',
      d: 'Levererat är dolt som förval — det som är gjort ska inte konkurrera med det som återstår. Klicka fasrutan eller sök för att se den här raden.',
      fas: 'levererat', omr: 'Drift', k: 'exempel/docs/genomfort.md' },
    { t: 'Något som valdes bort',
      d: 'Snabbvalet **Skippa** i vyerna lägger en post här. Hinken är inte en skräphög: den bär *skälet*, så att frågan inte kommer tillbaka om ett halvår utan svar. Posten har inget snabbval kvar — den ligger redan där.',
      fas: 'uteslutet', omr: 'Drift', k: 'exempel/docs/beslut.md' },
  ];
