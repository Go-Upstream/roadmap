/* Roadmap · motorn. Tre vyer, sök, filter, gruppering, sortering och
   kanban-drag. Den känner inte till något projekt: allt sådant kommer ur
   K (konfig.js) och ITEMS (data.js), som byggs in före den här filen.
   Se verktyg/roadmap/README.md. */
  // Motorn känner inte till något projekt. Allt den behöver kommer ur K
  // (konfig.js) och ITEMS (data.js), som båda byggs in före den här filen.
  // Aliasen finns för att kroppen nedan ska vara ordagrant den som körde
  // före uppdelningen — en omdöpning här hade blivit en diff överallt.
  // REPO och REGLER har inga alias: de deklareras i konfigen, och ett
  // andra const med samma namn i samma svep stoppar hela sidan.
  const FAS = K.faser;
  const FAS_ORDNING = K.fasOrdning;
  const OMRADE_ORDNING = K.omradeOrdning;
  const PRIO_ORDNING = K.prioOrdning;
  const VAL_NYCKEL = K.nyckel + '-val';
  const TEMA_NYCKEL = K.nyckel + '-tema';
  /**
   * Flaggan «obesvarad»: en post vars nästa steg är ett svar, inte ett bygge.
   *
   * Den är ett **tillstånd på posten och inte en fas**, eftersom en fråga hör
   * till den leverans den blockerar. Låg den som en egen fas gick det inte att
   * se vad den stod i vägen för — bara att den fanns.
   *
   * Etiketten är projektets, med ett förval: motorn känner inget projekt, men
   * «öppen fråga» är ett allmänt nog begrepp för att inte kräva konfiguration
   * av den som bara vill komma igång.
   */
  const OBESVARAD = Object.assign(
    { label: 'Öppen fråga', desc: 'Nästa steg är ett svar, inte kod. Den blockerar leveransen den står i.' },
    K.obesvarad || {},
  );

  /**
   * Snabbvalet «Skippa»: ett klick i vilken vy som helst som lägger posten i
   * den fas projektet använder för det aktivt bortvalda.
   *
   * Motorn känner inget projekt, men **`levererat` och `uteslutet` är
   * tillstånd och inte leveranser** — de två nycklarna är redan en konvention
   * i konfigen, och `uteslutet` är därför förvalet här. Ett projekt som kallar
   * hinken något annat pekar om den med `K.skippa`.
   *
   * `ord` är verbet på knappen och `fas` är hinken den lägger posten i. Saknas
   * hinken i `K.faser` ritas snabbvalet inte alls — hellre ingen knapp än en
   * knapp som pekar på en fas som inte finns.
   */
  const SKIPPA = Object.assign({ fas: 'uteslutet', ord: 'Skippa' }, K.skippa || {});
  const kanSkippa = (it) => !!FAS[SKIPPA.fas] && it.fas !== SKIPPA.fas;

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  // Escapa och markera sökträffar — skiftlägesokänsligt, alla förekomster.
  function hl(text) {
    const e = esc(text);
    if (!fraga) return e;
    const q = esc(fraga);
    const lc = e.toLowerCase(), ql = q.toLowerCase();
    let ut = '', pos = 0, i = lc.indexOf(ql);
    if (i === -1) return e;
    while (i !== -1) {
      ut += e.slice(pos, i) + '<mark>' + e.slice(i, i + q.length) + '</mark>';
      pos = i + q.length;
      i = lc.indexOf(ql, pos);
    }
    return ut + e.slice(pos);
  }

  /**
   * Fetstil, kursiv och kod i en beskrivning.
   *
   * **Körs på en redan escapad sträng**, aldrig på rå text — det är hela
   * skyddet. `esc` har då gjort om varje `<` till `&lt;`, så den enda HTML som
   * kan finnas i resultatet är de taggar som skrivs här. Vänd på ordningen och
   * en beskrivning blir en väg in för godtycklig HTML.
   *
   * Strängen kan innehålla `<mark>` från `hl`, och det gör ingen skada:
   * uttrycken matchar inte över en asterisk, och taggarna har inga.
   *
   * Tre former, medvetet inte fler. En roadmap-post är en mening om vad som
   * ska byggas, inte ett dokument — rubriker, listor och länkar hör hemma i
   * filen posten kommer ur, och `k` pekar dit.
   */
  function md(escapat) {
    return escapat
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(«"'—–])\*([^*\n]+)\*(?=$|[\s)»"'.,;:!?—–])/g, '$1<i>$2</i>');
  }


  // ── Djuplänkar · öppnar en session med posten förifylld ──────────
  // Prompten skickas inte automatiskt, och texten i den hör till projektet,
  // inte till motorn — den står i konfigens prompt-block.
  const lank = (prompt) => 'https://claude.ai/code?' + new URLSearchParams({ prompt, repositories: K.repo }).toString();

  /**
   * Posten i klartext, lagd sist i varje prompt.
   *
   * Konfigens prompttexter är korta av en anledning: de skrivs en gång och ska
   * gå att läsa. Men en session som bara får «jag vill jobba på "X"» får en
   * rubrik och ingenting annat — **beskrivningen, som är hela innehållet i en
   * roadmap-post, följde inte med**, och sessionen börjar med att gissa eller
   * med att leta. Det är motorn som har posten, så det är motorn som lägger på
   * fakta; konfigen får fortsätta handla om vad sessionen ska göra.
   *
   * Blocket är märkt och står sist, så att det går att läsa som en bilaga och
   * inte blandas ihop med uppdraget. Ett projekt som hellre skriver sina egna
   * fakta stänger av det med `promptKontext: false` i konfigen.
   */
  function promptKontext(it) {
    const f = FAS[it.fas];
    const rader = [
      '',
      '--- Posten, ur roadmapen ---',
      `Rubrik: ${it.t}`,
      `Beskrivning: ${it.d}`,
      `Leverans: ${f.label}${f.desc ? ` — ${f.desc}` : ''}`,
      `Område: ${it.omr}`,
    ];
    if (it.prio) rader.push(`Prio: ${it.prio} (ordningen inom ${f.label}, inte mellan leveranser)`);
    rader.push(`Källa: ${it.k} — posten kommer därifrån, så det dokumentet ändras först.`);
    if (it.obesvarad) rader.push(`Flagga: ${OBESVARAD.label} — ${OBESVARAD.desc}`);
    return rader.join('\n');
  }
  const medKontext = (text, it) => K.promptKontext === false ? text : `${text}\n${promptKontext(it)}`;

  const sessionURL = (it) => lank(medKontext(K.prompt.session(it, FAS), it));
  const flyttURL   = (it, till) => lank(medKontext(K.prompt.flytt(it, till, grupp, FAS), it));

  // ── Läge ────────────────────────────────────────────────────────
  let fasFilter = null;
  let obesvaradFilter = false;
  let fraga = '';        // normaliserad sökning
  let fragaRa = '';      // som skriven, för visning
  let vy = 'kort';       // 'kort' | 'tabell' | 'kanban'
  let grupp = 'tid';     // 'tid' (fas) | 'omrade'
  let dragIndex = null;
  // Sant medan ett kanbankort dras. Rubriken öppnar panelen, och utan den här
  // skulle ett släpp som råkar bli ett klick göra båda sakerna. Flaggan nollas
  // både av `dragend` och av nästa `pointerdown`: fastnade den skulle rubriken
  // sluta öppna panelen — tyst, och för alltid.
  let dragPagar = false;
  let sortNyckel = 'fas';
  let sortRiktning = 'asc';

  function sparaVal() {
    try { localStorage.setItem(VAL_NYCKEL, JSON.stringify({ vy, grupp, sortNyckel, sortRiktning })); }
    catch (e) { /* lagring kan vara blockerad — strunta */ }
  }
  function lasVal() {
    try {
      const p = JSON.parse(localStorage.getItem(VAL_NYCKEL) || '{}');
      if (['kort', 'tabell', 'kanban'].includes(p.vy)) vy = p.vy;
      if (p.grupp === 'tid' || p.grupp === 'omrade') grupp = p.grupp;
      if (['rubrik', 'fas', 'omrade', 'prio'].includes(p.sortNyckel)) sortNyckel = p.sortNyckel;
      if (p.sortRiktning === 'asc' || p.sortRiktning === 'desc') sortRiktning = p.sortRiktning;
    } catch (e) { /* trasig lagring — behåll standard */ }
  }

  const traffar = (it) => !fraga ||
    (it.t + ' ' + it.d + ' ' + it.omr + ' ' + it.k + ' ' + FAS[it.fas].label +
     (it.obesvarad ? ' ' + OBESVARAD.label : '')).toLowerCase().includes(fraga);

  // Levererat är dolt som förval — det som är gjort ska inte konkurrera med det som återstår.
  const synliga = () => (fasFilter ? ITEMS.filter(i => i.fas === fasFilter)
    : ITEMS.filter(i => fraga || i.fas !== 'levererat'))
    .filter(i => !obesvaradFilter || i.obesvarad)
    .filter(traffar);

  /** Brickan som säger att posten är obesvarad. Tom sträng när den inte är det. */
  function obesvaradHTML(it) {
    if (!it.obesvarad) return '';
    return `<span class="obesvarad" title="${esc(OBESVARAD.desc)}">${esc(OBESVARAD.label)}</span>`;
  }

  function prioHTML(it, tom) {
    if (!it.prio) return tom ? '<span class="t-tom">—</span>' : '';
    return `<span class="prio" data-p="${it.prio}" title="Prioritet: ${it.prio}">` +
      `<span class="staplar"><i></i><i></i><i></i></span><span class="ord">${it.prio}</span></span>`;
  }

  /**
   * Snabbvalet, ritat i alla tre vyerna.
   *
   * Det öppnar panelen med hinken redan omställd i utkastet — det vill säga
   * **samma mekanik och samma skydd mot att trycka fel som en flytt i
   * Kanban**, inte en genväg förbi dem. Sidan sparar ingenting, så ett klick
   * som direkt öppnat en session hade varit det enda stället i motorn där ett
   * misstag inte gick att ta tillbaka innan det lämnade sidan.
   *
   * `klass` skiljer bara på formen i de tre vyerna; beteendet är ett.
   */
  function skippaHTML(it, klass, text) {
    if (!kanSkippa(it)) return '';
    return `<button type="button" class="${klass}" draggable="false" data-skippa="${ITEMS.indexOf(it)}" ` +
      `title="${esc(SKIPPA.ord)} — lägger posten i «${esc(FAS[SKIPPA.fas].label)}». Du får se ändringen innan sessionen öppnas." ` +
      `aria-label="${esc(SKIPPA.ord)} ${esc(it.t)}">${text}</button>`;
  }

  /** Pennan · öppnar posten i panelen med rubrik och beskrivning redigerbara. */
  function andraHTML(it, klass, text) {
    return `<button type="button" class="${klass}" draggable="false" data-andra="${ITEMS.indexOf(it)}" ` +
      `title="Ändra rubrik, beskrivning, leverans, område eller prio" ` +
      `aria-label="Ändra ${esc(it.t)}">${text}</button>`;
  }

  function kortHTML(it) {
    const f = FAS[it.fas];
    return `
      <article class="kort" style="--c:${f.color}">
        <h3 role="button" tabindex="0" data-oppna="${ITEMS.indexOf(it)}"
            aria-label="Öppna posten ${esc(it.t)}">${hl(it.t)}</h3>
        <p class="brod">${md(hl(it.d))}</p>
        <div class="fot">
          <span class="bricka"><span class="bprick"></span>${f.label}</span>
          ${obesvaradHTML(it)}
          ${prioHTML(it, false)}
          <span class="kategori">${hl(it.omr)}</span>
        </div>
        <p class="kalla" style="margin:0"><b>Källa</b> · ${hl(it.k)}</p>
        <div class="atgarder">
          <a class="starta" href="${esc(sessionURL(it))}" target="_blank" rel="noopener"
             title="Öppnar claude.ai/code med en förifylld prompt — du granskar den innan sessionen startar">
            Starta session <span class="pil" aria-hidden="true">→</span>
          </a>
          ${skippaHTML(it, 'skippa', esc(SKIPPA.ord) + ' <span aria-hidden="true">⊘</span>')}
          ${andraHTML(it, 'andra', 'Ändra ✎')}
        </div>
      </article>`;
  }

  function grupperna(items) {
    if (grupp === 'omrade') {
      const omr = [...new Set([...OMRADE_ORDNING, ...items.map(i => i.omr)])];
      return omr.map(o => ({ nyckel: o, label: o, farg: null, items: items.filter(i => i.omr === o) }))
        .filter(g => g.items.length);
    }
    return FAS_ORDNING.map(k => ({ nyckel: k, label: FAS[k].label, farg: FAS[k].color, items: items.filter(i => i.fas === k) }))
      .filter(g => g.items.length);
  }

  function ritaKort() {
    const el = document.getElementById('panel-kort');
    const items = synliga();
    if (!items.length) { el.innerHTML = tomtHTML(); return; }
    el.innerHTML = grupperna(items).map(g => {
      const inre = grupp === 'omrade'
        ? [...g.items].sort((a, b) => FAS_ORDNING.indexOf(a.fas) - FAS_ORDNING.indexOf(b.fas))
        : g.items;
      const spar = (grupp === 'tid' && g.nyckel === 'nartid') ? '<span class="spar">näst på tur</span>' : '';
      return `
        <section class="faltgrupp">
          <div class="faltgrupp-huvud" style="--c:${g.farg || 'var(--accent)'}">
            <span class="hprick" aria-hidden="true"></span>
            <h2>${esc(g.label)}</h2>
            ${spar}
            <span class="antal">${g.items.length} ${g.items.length === 1 ? 'post' : 'poster'}</span>
          </div>
          <div class="rutnat">${inre.map(kortHTML).join('')}</div>
        </section>`;
    }).join('');
  }

  function tomtHTML() {
    return `
      <div class="tomt">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"></circle>
          <path d="M20 20l-3.2-3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        <div>Ingenting matchar <b>"${esc(fragaRa)}"</b>.
          <span class="lapp">Prova ett kortare ord, eller rensa sökningen för att se hela roadmapen.</span>
        </div>
      </div>`;
  }

  function ritaOversikt() {
    const ov = document.getElementById('oversikt');
    let html = `<button class="ruta allt" data-fas="" aria-pressed="${fasFilter === null}" title="Visa allt — rensar filtret">` +
      `<div class="tal">${ITEMS.length}</div><div class="etikett"><span class="prick"></span>Poster totalt</div></button>`;
    FAS_ORDNING.forEach(k => {
      const n = ITEMS.filter(i => i.fas === k).length;
      if (!n) return;
      const av = (k === 'levererat' && !fraga && fasFilter !== k) ? ' av' : '';
      html += `<button class="ruta${av}" data-fas="${k}" aria-pressed="${fasFilter === k}" style="--c:${FAS[k].color}" ` +
        `title="${esc(FAS[k].desc)} Klicka för att visa bara ${FAS[k].label.toLowerCase()}.">` +
        `<div class="tal">${n}</div><div class="etikett"><span class="prick"></span>${FAS[k].label}</div></button>`;
    });
    // Obesvarade får en egen ruta, sist och bara om det finns några. Den
    // filtrerar på tvären mot faserna — en fråga har både en leverans och det
    // här tillståndet, så rutorna utesluter inte varandra.
    const nObes = ITEMS.filter(i => i.obesvarad).length;
    if (nObes) {
      html += `<button class="ruta obesvarad-ruta${obesvaradFilter ? '' : ' av'}" data-obesvarad="1" ` +
        `aria-pressed="${obesvaradFilter}" title="${esc(OBESVARAD.desc)} Klicka för att visa bara dem.">` +
        `<div class="tal">${nObes}</div><div class="etikett"><span class="prick"></span>${esc(OBESVARAD.label)}</div></button>`;
    }

    ov.innerHTML = html;
    ov.querySelectorAll('.ruta').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.obesvarad) {
        obesvaradFilter = !obesvaradFilter;
      } else {
        const k = btn.dataset.fas || null;
        fasFilter = (k === fasFilter) ? null : k;
        if (!k) obesvaradFilter = false;   // «Poster totalt» rensar allt
      }
      ritaAllt();
    }));
  }

  function ritaFilterrad() {
    const el = document.getElementById('filterrad');
    const delar = [];
    if (fasFilter) delar.push(`<b>${FAS[fasFilter].label}</b> — ${esc(FAS[fasFilter].desc)}`);
    if (obesvaradFilter) delar.push(`<b>${esc(OBESVARAD.label)}</b> — ${esc(OBESVARAD.desc)}`);
    if (delar.length) {
      el.hidden = false;
      el.innerHTML = `Visar bara ${delar.join(' och ')} ` +
        `Klicka rutan igen, eller «Poster totalt», för att rensa.`;
    } else {
      el.hidden = true;
      el.innerHTML = '';
    }
  }

  function sortera(items) {
    const r = sortRiktning === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      let d = 0;
      if (sortNyckel === 'rubrik') d = a.t.localeCompare(b.t, 'sv');
      else if (sortNyckel === 'fas') d = FAS_ORDNING.indexOf(a.fas) - FAS_ORDNING.indexOf(b.fas);
      else if (sortNyckel === 'omrade') {
        const ai = OMRADE_ORDNING.indexOf(a.omr), bi = OMRADE_ORDNING.indexOf(b.omr);
        d = (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        if (d === 0) d = a.omr.localeCompare(b.omr, 'sv');
      } else if (sortNyckel === 'prio') {
        d = (PRIO_ORDNING[a.prio] ?? 3) - (PRIO_ORDNING[b.prio] ?? 3);
      }
      if (d === 0) d = a.t.localeCompare(b.t, 'sv');
      return d * r;
    });
  }

  function radHTML(it) {
    const f = FAS[it.fas];
    return `
      <tr style="--c:${f.color}">
        <td class="t-rubrik-cell"><button type="button" class="t-start" data-oppna="${ITEMS.indexOf(it)}"
              aria-label="Öppna posten ${esc(it.t)}"
              >${hl(it.t)} <span class="pil" aria-hidden="true">→</span></button></td>
        <td><span class="bricka" style="--c:${f.color}"><span class="bprick"></span>${f.label}</span>${obesvaradHTML(it)}</td>
        <td class="t-mono">${hl(it.omr)}</td>
        <td>${prioHTML(it, true)}</td>
        <td class="t-mono t-kalla">${hl(it.k)}</td>
        <td class="t-atg-bred"><a class="t-starta-ord" href="${esc(sessionURL(it))}" target="_blank" rel="noopener"
              title="Öppnar claude.ai/code med en förifylld prompt" aria-label="Starta session för ${esc(it.t)}"
              >Starta <span class="pil" aria-hidden="true">→</span></a>${skippaHTML(it, 't-lank', '⊘')}${andraHTML(it, 't-lank', '✎')}</td>
      </tr>`;
  }

  function ritaTabell() {
    const el = document.getElementById('panel-tabell');
    const items = synliga();
    if (!items.length) { el.innerHTML = tomtHTML(); return; }
    const kolumner = [
      { nyckel: 'rubrik', label: 'Rubrik' },
      { nyckel: 'fas',    label: 'Fas' },
      { nyckel: 'omrade', label: 'Område' },
      { nyckel: 'prio',   label: 'Prio' },
    ];
    const sortAttr = (k) => sortNyckel === k ? (sortRiktning === 'asc' ? 'ascending' : 'descending') : 'none';
    const pil = (k) => sortNyckel === k ? `<span class="pilspets" aria-hidden="true">${sortRiktning === 'asc' ? '▲' : '▼'}</span>` : '';
    const huvud = kolumner.map(c =>
      `<th class="sorterbar" data-sort="${c.nyckel}" aria-sort="${sortAttr(c.nyckel)}" role="button" tabindex="0" title="Sortera på ${c.label}">${c.label}${pil(c.nyckel)}</th>`
    ).join('') + '<th>Källa</th><th class="t-atg-bred">Åtgärd</th>';
    const kropp = grupperna(items).map(g => {
      const rader = sortera(g.items).map(radHTML).join('');
      const prickStil = `background:${g.farg || 'var(--accent)'}`;
      return `<tr class="grupprad"><td colspan="6"><span class="gprick" style="${prickStil}"></span>${esc(g.label)}<span class="gantal">${g.items.length}</span></td></tr>${rader}`;
    }).join('');
    el.innerHTML = `<div class="tabellram"><table class="roadmap"><thead><tr>${huvud}</tr></thead><tbody>${kropp}</tbody></table></div>`;
  }

  function kkortHTML(it) {
    const f = FAS[it.fas];
    const meta = grupp === 'omrade'
      ? `<span class="bricka" style="--c:${f.color}"><span class="bprick"></span>${f.label}</span>`
      : `<span class="kategori" style="margin:0">${hl(it.omr)}</span>`;
    return `
      <article class="kkort" draggable="true" data-i="${ITEMS.indexOf(it)}" style="--c:${f.color}">
        <div class="krubrik" role="button" tabindex="0" data-oppna="${ITEMS.indexOf(it)}"
             aria-label="Öppna posten ${esc(it.t)}">${hl(it.t)}</div>
        <div class="kmeta">${obesvaradHTML(it)}${prioHTML(it, false)}${meta}
          <a class="kstarta" href="${esc(sessionURL(it))}" draggable="false" target="_blank" rel="noopener"
             title="Öppnar claude.ai/code med en förifylld prompt" aria-label="Starta session för ${esc(it.t)}"
             >Starta <span class="pil" aria-hidden="true">→</span></a>${skippaHTML(it, 'kandra', '⊘')}${andraHTML(it, 'kandra', '✎')}</div>
      </article>`;
  }

  function ritaKanban() {
    const el = document.getElementById('panel-kanban');
    const items = synliga();
    if (!items.length) { el.innerHTML = tomtHTML(); return; }
    let grupperna_ = [];
    if (grupp === 'tid') {
      const nycklar = FAS_ORDNING.filter(k => k !== 'levererat' || items.some(i => i.fas === 'levererat'));
      grupperna_ = nycklar.map(k => ({ nyckel: k, label: FAS[k].label, farg: FAS[k].color, items: items.filter(i => i.fas === k) }));
    } else {
      grupperna_ = grupperna(items);
    }
    const spalter = grupperna_.map(g => {
      const kort = g.items.map(kkortHTML).join('') || '<div class="ktomt">Inga poster</div>';
      return `
        <div class="kspalt" data-nyckel="${esc(g.nyckel)}" style="--c:${g.farg || 'var(--accent)'}">
          <div class="kspalt-huvud"><span class="hprick" aria-hidden="true"></span><h2>${esc(g.label)}</h2><span class="antal">${g.items.length}</span></div>
          <div class="kspalt-kropp">${kort}</div>
        </div>`;
    }).join('');
    el.innerHTML = `
      <p class="klapp">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        Dra ett kort till en annan kolumn för att flytta det — inget sparas tyst, du får en länk till en session som gör ändringen i dokumentet.
      </p>
      <div class="kbord">${spalter}</div>`;
  }

  function visaFlytt(it, till) {
    const panel = document.getElementById('panel-kanban');
    let banner = panel.querySelector('.kflytt');
    if (!banner) { banner = document.createElement('div'); banner.className = 'kflytt'; panel.prepend(banner); }
    const fran = grupp === 'omrade' ? it.omr : FAS[it.fas].label;
    const tillEtikett = grupp === 'omrade' ? till : FAS[till].label;
    banner.innerHTML =
      `<span class="text">Flytta <b>${esc(it.t)}</b> från <b>${esc(fran)}</b> till <b>${esc(tillEtikett)}</b>?</span>` +
      `<a class="oppna" href="${esc(flyttURL(it, till))}" target="_blank" rel="noopener">Öppna session ↗</a>` +
      `<button class="avbryt" type="button">Avbryt</button>`;
    banner.querySelector('.avbryt').onclick = () => banner.remove();
  }

  function ritaSokmeta() {
    const antal = document.getElementById('traffar');
    const rensaKnapp = document.getElementById('rensa');
    if (fraga) {
      const n = synliga().length;
      antal.hidden = false;
      antal.textContent = n === 1 ? '1 träff' : `${n} träffar`;
      rensaKnapp.hidden = false;
    } else {
      antal.hidden = true; antal.textContent = ''; rensaKnapp.hidden = true;
    }
  }

  function ritaAllt() {
    ritaOversikt(); ritaFilterrad(); ritaKort(); ritaTabell(); ritaKanban(); ritaSokmeta(); visaVy();
  }

  // ── Sökfältet ───────────────────────────────────────────────────
  const sokInput = document.getElementById('sok');
  const rensaKnapp = document.getElementById('rensa');
  sokInput.addEventListener('input', () => {
    fragaRa = sokInput.value.trim();
    fraga = fragaRa.toLowerCase();
    ritaAllt();
  });
  sokInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sokInput.value) { e.preventDefault(); rensaSok(true); }
  });
  rensaKnapp.addEventListener('click', () => rensaSok(true));
  function rensaSok(fokus) {
    sokInput.value = ''; fragaRa = ''; fraga = '';
    ritaAllt();
    if (fokus) sokInput.focus();
  }

  // Rubriken och beskrivningen redigeras i panelen och inte i kortet. Ett
  // inbäddat formulär i ett kort ger tre rader att skriva en beskrivning i,
  // mitt i ett rutnät som hoppar när kortet växer — och det fanns bara i
  // kortvyn, så pennan i tabellen och i Kanban ledde någon annanstans. Panelen
  // är ett svar på båda: samma yta i alla tre vyerna, och plats att skriva i.
  document.addEventListener('submit', (e) => { if (e.target.closest('.pp-red')) e.preventDefault(); });

  // ── Vy och gruppering ───────────────────────────────────────────
  const vyKort = document.getElementById('vy-kort');
  const vyTabell = document.getElementById('vy-tabell');
  const vyKanban = document.getElementById('vy-kanban');

  function visaVy() {
    vyKort.setAttribute('aria-selected', String(vy === 'kort'));
    vyTabell.setAttribute('aria-selected', String(vy === 'tabell'));
    vyKanban.setAttribute('aria-selected', String(vy === 'kanban'));
    const visa = (id, pa) => {
      const el = document.getElementById(id);
      el.hidden = !pa; el.classList.toggle('pa', pa);
    };
    visa('panel-kort', vy === 'kort');
    visa('panel-tabell', vy === 'tabell');
    visa('panel-kanban', vy === 'kanban');
  }
  vyKort.addEventListener('click', () => { vy = 'kort'; visaVy(); sparaVal(); });
  vyTabell.addEventListener('click', () => { vy = 'tabell'; visaVy(); sparaVal(); });
  vyKanban.addEventListener('click', () => { vy = 'kanban'; visaVy(); sparaVal(); });

  const gruppTid = document.getElementById('grupp-tid');
  const gruppOmr = document.getElementById('grupp-omrade');
  function sattGrupp(g) {
    if (g === grupp) return;
    grupp = g;
    gruppTid.setAttribute('aria-pressed', String(g === 'tid'));
    gruppOmr.setAttribute('aria-pressed', String(g === 'omrade'));
    ritaKort(); ritaTabell(); ritaKanban(); sparaVal();
  }
  gruppTid.addEventListener('click', () => sattGrupp('tid'));
  gruppOmr.addEventListener('click', () => sattGrupp('omrade'));

  // ── Kanban: dra och släpp ───────────────────────────────────────
  const kanban = document.getElementById('panel-kanban');
  kanban.addEventListener('dragstart', (e) => {
    const kort = e.target.closest('.kkort');
    if (!kort) return;
    dragIndex = +kort.dataset.i;
    dragPagar = true;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', kort.dataset.i);
    kort.classList.add('dras');
  });
  kanban.addEventListener('dragend', (e) => {
    dragPagar = false;
    const kort = e.target.closest('.kkort');
    if (kort) kort.classList.remove('dras');
    kanban.querySelectorAll('.kspalt.slappyta').forEach(s => s.classList.remove('slappyta'));
  });
  kanban.addEventListener('dragover', (e) => {
    const spalt = e.target.closest('.kspalt');
    if (!spalt) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!spalt.classList.contains('slappyta')) {
      kanban.querySelectorAll('.kspalt.slappyta').forEach(s => s.classList.remove('slappyta'));
      spalt.classList.add('slappyta');
    }
  });
  kanban.addEventListener('drop', (e) => {
    const spalt = e.target.closest('.kspalt');
    if (!spalt) return;
    e.preventDefault();
    spalt.classList.remove('slappyta');
    const ra = e.dataTransfer.getData('text/plain');
    const i = ra !== '' ? +ra : dragIndex;
    const it = ITEMS[i];
    const till = spalt.dataset.nyckel;
    const nu = grupp === 'omrade' ? (it && it.omr) : (it && it.fas);
    if (it && till && till !== nu) visaFlytt(it, till);
  });

  // ── Tabellsortering ─────────────────────────────────────────────
  function sorteraPa(th) {
    const k = th.dataset.sort;
    if (sortNyckel === k) sortRiktning = sortRiktning === 'asc' ? 'desc' : 'asc';
    else { sortNyckel = k; sortRiktning = 'asc'; }
    ritaTabell(); sparaVal();
  }
  document.addEventListener('click', (e) => {
    const th = e.target.closest('#panel-tabell th.sorterbar');
    if (th) sorteraPa(th);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const th = e.target.closest('#panel-tabell th.sorterbar');
      if (th) { e.preventDefault(); sorteraPa(th); }
    }
  });

  // ── Mörkt och ljust ─────────────────────────────────────────────
  const temaMork = document.getElementById('tema-mork');
  const temaLjus = document.getElementById('tema-ljus');
  function sattTema(t, spara) {
    document.documentElement.dataset.theme = t;
    temaMork.setAttribute('aria-pressed', String(t === 'dark'));
    temaLjus.setAttribute('aria-pressed', String(t === 'light'));
    if (spara) { try { localStorage.setItem(TEMA_NYCKEL, t); } catch (e) { /* strunta */ } }
  }
  temaMork.addEventListener('click', () => sattTema('dark', true));
  temaLjus.addEventListener('click', () => sattTema('light', true));

  // Läsarens eget val vinner; annars telefonens läge; annars mörkt, som är standard.
  let tema = null;
  try { tema = localStorage.getItem(TEMA_NYCKEL); } catch (e) { /* strunta */ }
  if (tema !== 'dark' && tema !== 'light') {
    // Standardläget kommer ur temafilen. Läsarens eget val stämplas som
  // data-theme och vinner över mediefrågan, åt båda hållen.
    tema = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }
  sattTema(tema, false);

  // ── Posten, öppnad från sin rubrik ──────────────────────────────
  /**
   * Förklaringen bakom en post låg förut i webbläsarens `title`-tooltip. Den
   * bryter aldrig rad, kommer efter en sekunds hovrande, försvinner när musen
   * rör sig, och **på en telefon finns den inte alls** — det går inte att
   * hovra. Ingenting av det går att styla, så den är utbytt och inte
   * förbättrad.
   *
   * Panelen svarar dessutom på tre saker tooltipen inte kunde: vad hinken
   * betyder (texten står i konfigen och syntes bara som ännu en tooltip), vad
   * prio betyder *inom* hinken, och vilken leverans en öppen fråga blockerar.
   *
   * **Sidan sparar ingenting.** Den byggs om ur repot, så ett sparat värde
   * hade skrivits över tyst vid nästa bygge. Ett val i panelen skriver därför
   * om prompten, aldrig posten — samma mekanik som en flytt i Kanban, och
   * samma skydd mot att trycka fel: ändringen går genom en session som
   * läsaren granskar först.
   *
   * **Panelen bär också rubriken och beskrivningen.** De redigerades förut i
   * ett formulär inne i kortet: tre rader att skriva en beskrivning i, i ett
   * rutnät som hoppade när kortet växte — och bara i kortvyn, så pennan i
   * tabellen och i Kanban ledde till en session i stället för till en
   * redigering. Här får texten hela bladets bredd, och de sex fälten ligger
   * på samma ställe oavsett vilken vy man kom från.
   */
  const slöja = document.getElementById('slöja');
  const postpanel = document.getElementById('postpanel');
  const valjare = document.getElementById('valjare');
  const ppRed = document.getElementById('pp-red');
  const ppRedVipp = document.getElementById('pp-red-vipp');

  let aktiv = null;      // posten som visas
  let utkast = {};       // valt men inte skickat
  let sistFokus = null;  // dit fokus går tillbaka när panelen stängs
  let redigerar = false; // står textfälten framme?

  const ppNu = (falt) => (falt in utkast ? utkast[falt] : aktiv[falt]);

  /** Fälten som går att ändra, och vad väljaren erbjuder för var och en. */
  const PP_FALT = {
    fas: () => ({
      rubrik: 'Vilken leverans?',
      val: FAS_ORDNING.map(k => ({ v: k, label: FAS[k].label, farg: FAS[k].color })),
    }),
    omr: () => ({
      rubrik: 'Vilket område?',
      // Konfigens ordning först, sedan områden som bara finns i datan.
      val: [...new Set([...OMRADE_ORDNING, ...ITEMS.map(i => i.omr)])]
        .map(o => ({ v: o, label: o, farg: 'var(--ink-3)' })),
    }),
    prio: () => ({
      rubrik: 'Ordningen inom leveransen',
      val: Object.keys(PRIO_ORDNING).map(p => ({ v: p, label: p, farg: 'var(--ink-3)' })),
    }),
    obesvarad: () => ({
      rubrik: 'Väntar posten på ett svar?',
      val: [
        { v: false, label: 'Nej — nästa steg är att bygga', farg: 'var(--ink-3)' },
        { v: true, label: 'Ja — ' + OBESVARAD.label.toLowerCase(), farg: 'var(--serious)' },
      ],
    }),
  };

  const ppUrsprung = (falt) => (falt === 'obesvarad' ? !!aktiv[falt] : aktiv[falt]);

  /** Ändringarna i ord — samma meningar går in i prompten och i raden. */
  function ppAndringar() {
    const lista = [];
    if ('t' in utkast)
      lista.push(`byt rubrik från "${aktiv.t}" till "${utkast.t}"`);
    if ('d' in utkast)
      lista.push(`skriv om beskrivningen till: "${utkast.d}"`);
    if ('fas' in utkast)
      // Snabbvalet är en flytt som alla andra, med ett tillägg: hinken finns
      // för det aktivt bortvalda, och utan skälet är den en skräphög.
      lista.push(utkast.fas === SKIPPA.fas
        ? `flytta från leveransen "${FAS[aktiv.fas].label}" till "${FAS[SKIPPA.fas].label}" — ` +
          `fråga mig varför den valdes bort och skriv in skälet, så att det går att förstå i efterhand`
        : `flytta från leveransen "${FAS[aktiv.fas].label}" till "${FAS[utkast.fas].label}"`);
    if ('omr' in utkast)
      lista.push(`byt område från "${aktiv.omr}" till "${utkast.omr}"`);
    if ('prio' in utkast)
      lista.push(`sätt prio till ${utkast.prio} (den var ${aktiv.prio || 'inte satt'})`);
    if ('obesvarad' in utkast)
      lista.push(utkast.obesvarad
        ? `markera posten som ${OBESVARAD.label.toLowerCase()} — nästa steg är ett svar, inte kod`
        : `ta bort flaggan ${OBESVARAD.label.toLowerCase()}, frågan är besvarad`);
    return lista;
  }

  /**
   * Prompten är projektets, precis som överallt annars i motorn. Tre lägen,
   * och alla tre står i konfigen: en konkret ändring skickas som `uppdatera`,
   * en öppnad redigering utan ändring som `andra` — det är just den frågan
   * pennan ställer — och allt annat som `session`.
   */
  function ppPrompt() {
    const lista = ppAndringar();
    if (lista.length) return medKontext(K.prompt.uppdatera(aktiv, lista), aktiv);
    if (redigerar) return medKontext(K.prompt.andra(aktiv, FAS), aktiv);
    return medKontext(K.prompt.session(aktiv, FAS), aktiv);
  }

  function ppRitaAndringar() {
    const lista = ppAndringar();
    const primar = document.getElementById('pp-primar');
    primar.innerHTML = (lista.length ? 'Öppna session med ändringen'
      : redigerar ? 'Öppna session för att ändra' : 'Starta session') +
      ' <span class="pil" aria-hidden="true">→</span>';
    primar.href = lank(ppPrompt());
    const rutan = document.getElementById('pp-andringar');
    if (!lista.length) { rutan.removeAttribute('data-öppen'); return; }
    rutan.setAttribute('data-öppen', '');
    document.getElementById('pp-andringar-text').innerHTML =
      `<b>Inte sparat.</b> ${esc(lista.join('; '))} — ändringen görs av sessionen, i det ` +
      `dokument som äger uppgiften och i posternas fil.`;
  }

  function ppVisaPrompt(behall) {
    const rutan = document.getElementById('pp-promptruta');
    if (rutan.innerHTML && !behall) { rutan.innerHTML = ''; return; }
    rutan.innerHTML = `<div class="pp-prompt">${esc(ppPrompt())}</div>`;
  }

  function ppRita() {
    const f = FAS[ppNu('fas')];
    const obesvarad = !!ppNu('obesvarad');
    const andrad = (falt) => (falt in utkast ? ' data-andrad' : '');
    postpanel.style.setProperty('--c', f.color);

    document.getElementById('pp-brickor').innerHTML =
      `<button type="button" class="bricka" data-valj="fas"${andrad('fas')} style="--c:${f.color}" ` +
        `title="Byt leverans"><span class="bprick"></span>${esc(f.label)}` +
        `<span class="karet" aria-hidden="true">▾</span></button>` +
      `<button type="button" class="obesvarad${obesvarad ? '' : ' tom'}" data-valj="obesvarad"${andrad('obesvarad')} ` +
        `title="${obesvarad ? 'Ta bort flaggan' : 'Markera som ' + esc(OBESVARAD.label.toLowerCase())}">` +
        `${esc(OBESVARAD.label)}<span class="karet" aria-hidden="true">▾</span></button>`;

    // Rubriken och brödtexten visar utkastet och inte posten: skriver man om
    // dem i formuläret nedan ska panelen visa det man skickar, inte det som
    // stod i filen. Blir de tomma faller de tillbaka på posten — ett halvt
    // raderat fält är inte en ändring.
    document.getElementById('pp-titel').textContent = ppNu('t');

    document.getElementById('pp-flagga').innerHTML = obesvarad
      ? `<div class="pp-flagga"><span class="tecken" aria-hidden="true">⚑</span><div>` +
        `<b>${esc(OBESVARAD.desc)}</b> Den blockerar ${esc(f.label)}.</div></div>`
      : '';

    // Brödtexten står inte kvar bredvid rutan som redigerar den — samma text
    // två gånger, med två svar på vad som gäller.
    const brod = document.getElementById('pp-brod');
    brod.innerHTML = md(esc(ppNu('d')));
    brod.hidden = redigerar;

    document.getElementById('pp-hink').innerHTML =
      `<span class="etikett" style="--c:${f.color}">${esc(f.label)}</span><p>${esc(f.desc)}</p>`;

    const prio = ppNu('prio');
    document.getElementById('pp-fakta').innerHTML =
      `<dt>Område</dt><dd><button type="button" class="faltknapp" data-valj="omr"${andrad('omr')} title="Byt område">` +
        `<span class="stark">${esc(ppNu('omr'))}</span><span class="karet" aria-hidden="true">▾</span></button></dd>` +
      `<dt>Prio</dt><dd>` +
        `<button type="button" class="faltknapp" data-valj="prio"${andrad('prio')} title="Byt prio">` +
        (prio ? `<span class="prio" data-p="${esc(prio)}" aria-hidden="true">` +
                `<span class="staplar"><i></i><i></i><i></i></span></span>&nbsp;` : '') +
        `<span class="stark">${esc(prio || 'inte satt')}</span>&nbsp;` +
        `<span class="inom">— ordningen inom ${esc(f.label)}</span>` +
        `<span class="karet" aria-hidden="true">▾</span></button></dd>` +
      `<dt>Källa</dt><dd class="kalla">${esc(aktiv.k)}</dd>`;

    ppRitaAndringar();
    if (document.getElementById('pp-promptruta').innerHTML) ppVisaPrompt(true);
  }

  function ppOppnaValjare(falt, ankare) {
    const { rubrik, val } = PP_FALT[falt]();
    const aktuellt = falt === 'obesvarad' ? !!ppNu(falt) : ppNu(falt);
    valjare.dataset.falt = falt;
    valjare.innerHTML = `<span class="rubrik">${esc(rubrik)}</span>` + val.map(o =>
      `<button type="button" role="option" aria-checked="${o.v === aktuellt}" data-v="${esc(o.v)}" ` +
      `style="--c:${o.farg}"><span class="markor" aria-hidden="true"></span>${esc(o.label)}` +
      (o.v === ppUrsprung(falt) ? '<span class="nu">nu</span>' : '') + `</button>`
    ).join('');

    const r = ankare.getBoundingClientRect();
    valjare.setAttribute('data-öppen', '');
    const h = valjare.offsetHeight, b = valjare.offsetWidth;
    valjare.style.top = (r.bottom + 8 + h > innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px';
    valjare.style.left = Math.max(8, Math.min(r.left, innerWidth - b - 8)) + 'px';
    valjare.querySelector('button')?.focus();
  }

  const ppStangValjare = () => valjare.removeAttribute('data-öppen');

  /** Textfälten fram eller undan. Fälten fylls ur utkastet, aldrig tvärtom. */
  function ppSattRed(pa) {
    redigerar = pa;
    ppRed.hidden = !pa;
    ppRedVipp.setAttribute('aria-expanded', String(pa));
    ppRedVipp.textContent = pa ? 'Dölj textfälten' : 'Ändra rubrik och beskrivning ✎';
    if (pa) { ppRed.elements.t.value = ppNu('t'); ppRed.elements.d.value = ppNu('d'); }
  }

  /**
   * Läser textfälten in i utkastet.
   *
   * Ett tomt fält är ingen ändring utan en halvt raderad rad — «byt rubrik
   * till ""» är inte något en session kan göra något vettigt av. Samma regel
   * som väljaren följer: skrivs ursprunget tillbaka finns ingen ändring kvar.
   */
  function ppLasRed() {
    ['t', 'd'].forEach(falt => {
      const v = ppRed.elements[falt].value.trim();
      if (!v || v === aktiv[falt]) delete utkast[falt]; else utkast[falt] = v;
    });
    document.getElementById('pp-titel').textContent = ppNu('t');
    ppRitaAndringar();
    if (document.getElementById('pp-promptruta').innerHTML) ppVisaPrompt(true);
  }

  /**
   * `opt.utkast` är förvalda ändringar — snabbvalet «Skippa» kommer in den
   * vägen, och panelen öppnas då med ändringsraden redan framme och fokus på
   * knappen som skickar den. `opt.redigera` öppnar textfälten, vilket är vad
   * pennan i de tre vyerna gör.
   */
  function ppOppna(it, fran, opt) {
    aktiv = it;
    utkast = Object.assign({}, opt && opt.utkast);
    sistFokus = fran || null;
    document.getElementById('pp-promptruta').innerHTML = '';
    ppSattRed(!!(opt && opt.redigera));
    ppRita();
    slöja.setAttribute('data-öppen', '');
    slöja.setAttribute('aria-hidden', 'false');
    document.documentElement.setAttribute('data-panel', '');
    document.getElementById('pp-kropp').scrollTop = 0;
    if (redigerar) ppRed.elements.t.focus();
    else if (opt && opt.utkast) document.getElementById('pp-primar').focus();
    else document.getElementById('pp-stang').focus();
  }

  function ppStang() {
    slöja.removeAttribute('data-öppen');
    slöja.setAttribute('aria-hidden', 'true');
    document.documentElement.removeAttribute('data-panel');
    ppStangValjare();
    if (sistFokus && document.contains(sistFokus)) sistFokus.focus();
    sistFokus = null;
  }

  valjare.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    const falt = valjare.dataset.falt;
    const varde = falt === 'obesvarad' ? b.dataset.v === 'true' : b.dataset.v;
    // Väljs ursprungsvärdet tillbaka finns ingen ändring kvar att skicka.
    if (varde === ppUrsprung(falt)) delete utkast[falt]; else utkast[falt] = varde;
    ppStangValjare();
    ppRita();
    postpanel.querySelector(`[data-valj="${falt}"]`)?.focus();
  });

  postpanel.addEventListener('click', (e) => {
    const knapp = e.target.closest('[data-valj]');
    if (!knapp) return;
    if (valjare.hasAttribute('data-öppen') && valjare.dataset.falt === knapp.dataset.valj) ppStangValjare();
    else ppOppnaValjare(knapp.dataset.valj, knapp);
  });

  document.getElementById('pp-angra').addEventListener('click', () => {
    utkast = {};
    if (redigerar) ppSattRed(true);   // fälten tillbaka till postens text
    ppRita();
  });
  document.getElementById('pp-visa-prompt').addEventListener('click', () => ppVisaPrompt(false));
  document.getElementById('pp-stang').addEventListener('click', ppStang);
  ppRedVipp.addEventListener('click', () => { ppSattRed(!redigerar); ppRita(); if (redigerar) ppRed.elements.t.focus(); });
  ppRed.addEventListener('input', ppLasRed);
  slöja.addEventListener('click', (e) => { if (e.target === slöja) ppStang(); });
  addEventListener('resize', ppStangValjare);

  /* Rubriken i alla tre vyerna. Delegerat, eftersom vyerna ritas om.
     I Kanban är det **bara rubriken** som öppnar — kortet i övrigt är
     dragbart, och de två gesterna skulle annars krocka på en telefon.
     dragIndex är satt under ett pågående drag och stänger dörren. */
  // En ny nedtryckning är en ny gest: skulle `dragend` ha uteblivit står
  // flaggan inte i vägen för nästa klick.
  document.addEventListener('pointerdown', () => { dragPagar = false; }, true);

  document.addEventListener('click', (e) => {
    if (dragPagar) return;
    // Pennan och snabbvalet, i alla tre vyerna. Båda öppnar samma panel —
    // skillnaden är vad den står öppnad på.
    const red = e.target.closest('[data-andra]');
    if (red) { e.preventDefault(); ppOppna(ITEMS[+red.dataset.andra], red, { redigera: true }); return; }
    const sk = e.target.closest('[data-skippa]');
    if (sk) { e.preventDefault(); ppOppna(ITEMS[+sk.dataset.skippa], sk, { utkast: { fas: SKIPPA.fas } }); return; }
    const traff = e.target.closest('[data-oppna]');
    if (!traff) return;
    e.preventDefault();
    ppOppna(ITEMS[+traff.dataset.oppna], traff);
  });

  document.addEventListener('keydown', (e) => {
    const traff = e.target.closest?.('[data-oppna]');
    if (traff && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      ppOppna(ITEMS[+traff.dataset.oppna], traff);
      return;
    }
    if (e.key !== 'Escape') return;
    // Escape i ett textfält stänger inte panelen. Den som skrivit ett stycke
    // och råkar trycka Escape ska inte förlora det på en tangenttryckning —
    // fokus lämnar fältet, och nästa Escape stänger som vanligt.
    if (e.target.closest?.('.pp-red')) { e.preventDefault(); ppRedVipp.focus(); return; }
    if (valjare.hasAttribute('data-öppen')) ppStangValjare();
    else if (slöja.hasAttribute('data-öppen')) ppStang();
  });

  lasVal();
  gruppTid.setAttribute('aria-pressed', String(grupp === 'tid'));
  gruppOmr.setAttribute('aria-pressed', String(grupp === 'omrade'));
  ritaAllt();
