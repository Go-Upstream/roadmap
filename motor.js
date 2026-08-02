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

  // ── Djuplänkar · öppnar en session med posten förifylld ──────────
  // Prompten skickas inte automatiskt, och texten i den hör till projektet,
  // inte till motorn — den står i konfigens prompt-block.
  const lank = (prompt) => 'https://claude.ai/code?' + new URLSearchParams({ prompt, repositories: K.repo }).toString();

  const sessionURL = (it) => lank(K.prompt.session(it, FAS));
  const andraURL   = (it) => lank(K.prompt.andra(it, FAS));
  const flyttURL   = (it, till) => lank(K.prompt.flytt(it, till, grupp, FAS));

  // ── Läge ────────────────────────────────────────────────────────
  let fasFilter = null;
  let fraga = '';        // normaliserad sökning
  let fragaRa = '';      // som skriven, för visning
  let vy = 'kort';       // 'kort' | 'tabell' | 'kanban'
  let grupp = 'tid';     // 'tid' (fas) | 'omrade'
  let dragIndex = null;
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
    (it.t + ' ' + it.d + ' ' + it.omr + ' ' + it.k + ' ' + FAS[it.fas].label).toLowerCase().includes(fraga);

  // Levererat är dolt som förval — det som är gjort ska inte konkurrera med det som återstår.
  const synliga = () => (fasFilter ? ITEMS.filter(i => i.fas === fasFilter)
    : ITEMS.filter(i => fraga || i.fas !== 'levererat')).filter(traffar);

  function prioHTML(it, tom) {
    if (!it.prio) return tom ? '<span class="t-tom">—</span>' : '';
    return `<span class="prio" data-p="${it.prio}" title="Prioritet: ${it.prio}">` +
      `<span class="staplar"><i></i><i></i><i></i></span><span class="ord">${it.prio}</span></span>`;
  }

  function kortHTML(it) {
    const f = FAS[it.fas];
    return `
      <article class="kort" style="--c:${f.color}">
        <h3>${hl(it.t)}</h3>
        <p class="brod">${hl(it.d)}</p>
        <div class="fot">
          <span class="bricka"><span class="bprick"></span>${f.label}</span>
          ${prioHTML(it, false)}
          <span class="kategori">${hl(it.omr)}</span>
        </div>
        <p class="kalla" style="margin:0"><b>Källa</b> · ${hl(it.k)}</p>
        <div class="atgarder">
          <a class="starta" href="${esc(sessionURL(it))}" target="_blank" rel="noopener"
             title="Öppnar claude.ai/code med en förifylld prompt — du granskar den innan sessionen startar">
            Starta session <span class="pil" aria-hidden="true">→</span>
          </a>
          <button class="andra" type="button" data-i="${ITEMS.indexOf(it)}" aria-expanded="false">Ändra ✎</button>
        </div>
        <form class="blankett" hidden>
          <p class="lapp">Ändringen görs i dokumentet posten kommer ur — och i den här vyn — av en ny session. Du granskar prompten innan start.</p>
          <label>Rubrik
            <input name="t" value="${esc(it.t)}">
          </label>
          <label>Beskrivning
            <textarea name="d" rows="3">${esc(it.d)}</textarea>
          </label>
          <div class="rad">
            <a class="verkstall slack" title="Inga ändringar ännu">Öppna session med ändringen <span class="pil" aria-hidden="true">→</span></a>
            <button class="avbryt" type="button">Avbryt</button>
          </div>
        </form>
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
    ov.innerHTML = html;
    ov.querySelectorAll('.ruta').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.fas || null;
      fasFilter = (k === fasFilter) ? null : k;
      ritaAllt();
    }));
  }

  function ritaFilterrad() {
    const el = document.getElementById('filterrad');
    if (fasFilter) {
      el.hidden = false;
      el.innerHTML = `Visar bara <b>${FAS[fasFilter].label}</b> — ${esc(FAS[fasFilter].desc)} ` +
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
      <tr style="--c:${f.color}" title="${esc(it.d)}">
        <td class="t-rubrik-cell"><a class="t-start" href="${esc(sessionURL(it))}" target="_blank" rel="noopener"
              title="Öppnar claude.ai/code med en förifylld prompt — du granskar den innan sessionen startar"
              >${hl(it.t)} <span class="pil" aria-hidden="true">→</span></a></td>
        <td><span class="bricka" style="--c:${f.color}"><span class="bprick"></span>${f.label}</span></td>
        <td class="t-mono">${hl(it.omr)}</td>
        <td>${prioHTML(it, true)}</td>
        <td class="t-mono t-kalla">${hl(it.k)}</td>
        <td class="t-atg-bred"><a class="t-starta-ord" href="${esc(sessionURL(it))}" target="_blank" rel="noopener"
              title="Öppnar claude.ai/code med en förifylld prompt" aria-label="Starta session för ${esc(it.t)}"
              >Starta <span class="pil" aria-hidden="true">→</span></a><a class="t-lank" href="${esc(andraURL(it))}" target="_blank" rel="noopener"
              title="Ändra posten" aria-label="Ändra ${esc(it.t)}">✎</a></td>
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
      <article class="kkort" draggable="true" data-i="${ITEMS.indexOf(it)}" style="--c:${f.color}" title="${esc(it.d)}">
        <div class="krubrik">${hl(it.t)}</div>
        <div class="kmeta">${prioHTML(it, false)}${meta}
          <a class="kstarta" href="${esc(sessionURL(it))}" draggable="false" target="_blank" rel="noopener"
             title="Öppnar claude.ai/code med en förifylld prompt" aria-label="Starta session för ${esc(it.t)}"
             >Starta <span class="pil" aria-hidden="true">→</span></a><a class="kandra" href="${esc(andraURL(it))}" draggable="false" target="_blank" rel="noopener"
             title="Ändra posten" aria-label="Ändra ${esc(it.t)}">✎</a></div>
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

  // ── Ändra-formuläret ────────────────────────────────────────────
  function uppdateraVerkstall(form, i) {
    const it = ITEMS[i];
    const nyT = form.elements.t.value.trim();
    const nyD = form.elements.d.value.trim();
    const andringar = [];
    if (nyT && nyT !== it.t) andringar.push(`ny rubrik: "${nyT}"`);
    if (nyD && nyD !== it.d) andringar.push(`ny beskrivning: "${nyD}"`);
    const a = form.querySelector('.verkstall');
    if (!andringar.length) {
      a.classList.add('slack'); a.removeAttribute('href'); a.title = 'Inga ändringar ännu';
      return;
    }
    a.classList.remove('slack');
    a.title = 'Öppnar claude.ai/code med ändringen förifylld';
    a.target = '_blank'; a.rel = 'noopener';
    a.href = lank(K.prompt.uppdatera(it, andringar));
  }

  document.addEventListener('click', (e) => {
    const andraKnapp = e.target.closest('.andra');
    if (andraKnapp) {
      const form = andraKnapp.closest('.kort').querySelector('.blankett');
      form.hidden = !form.hidden;
      andraKnapp.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) { uppdateraVerkstall(form, +andraKnapp.dataset.i); form.elements.t.focus(); }
      return;
    }
    const avbrytKnapp = e.target.closest('.kort .avbryt');
    if (avbrytKnapp) {
      const kort = avbrytKnapp.closest('.kort');
      kort.querySelector('.blankett').hidden = true;
      kort.querySelector('.andra').setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('input', (e) => {
    const form = e.target.closest('.blankett');
    if (form) uppdateraVerkstall(form, +form.closest('.kort').querySelector('.andra').dataset.i);
  });
  document.addEventListener('submit', (e) => { if (e.target.closest('.blankett')) e.preventDefault(); });

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
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', kort.dataset.i);
    kort.classList.add('dras');
  });
  kanban.addEventListener('dragend', (e) => {
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

  lasVal();
  gruppTid.setAttribute('aria-pressed', String(grupp === 'tid'));
  gruppOmr.setAttribute('aria-pressed', String(grupp === 'omrade'));
  ritaAllt();
