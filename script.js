/* =========================================================
   London 2025 – script.js (robuste Daten-Parser)
   ========================================================= */

/* Utils */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* 1) Tagesabhängiger Banner */
(function bannerByTime(){
  const TZ   = 'Europe/Berlin';
  const HERO = $('#trip-info');
  if (!HERO) return;

  const HERO_IMAGES = {
    morning: 'img/london-morning.jpg',  // 05–09:59
    day:     'img/london-day.jpg',      // 10–16:59
    evening: 'img/london-evening.jpg',  // 17–20:59
    night:   'img/london-night.jpg'     // 21–04:59
  };

  function getHourInTZ(tz){
    const fmt = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hourCycle: 'h23', hour: '2-digit' });
    const parts = fmt.formatToParts(new Date());
    return parseInt(parts.find(p => p.type === 'hour').value, 10);
  }
  function getDaypart(h){ if (h>=5&&h<10) return 'morning'; if (h>=10&&h<17) return 'day'; if (h>=17&&h<21) return 'evening'; return 'night'; }
  function preload(src){ return new Promise(res=>{ const i=new Image(); i.onload=()=>res(src); i.onerror=()=>res(null); i.src=src; }); }

  async function applyHero(){
    const hour = (typeof window.__forceTestHour === 'number') ? window.__forceTestHour : getHourInTZ(TZ);
    const part = getDaypart(hour);
    HERO.setAttribute('data-daypart', part);
    const loaded = await preload(HERO_IMAGES[part]);
    HERO.style.setProperty('--hero-image', `url("${loaded || HERO_IMAGES.day}")`);
  }

  document.addEventListener('DOMContentLoaded', applyHero, { once:true });
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) applyHero(); });
  setInterval(applyHero, 60*60*1000);
})();

/* 2) State */
const AppState = {
  data: { days: [], ideas: [] },
  activeDayIndex: 0,
  map: null,
  mapLayer: null
};

/* 3) Robuste Parser */
function pick(obj, keys){ for (const k of keys){ if (obj && obj[k] != null) return obj[k]; } return undefined; }

function normalizeDays(rawDays){
  const days = Array.isArray(rawDays) ? rawDays : [];
  return days.map((d, i) => {
    if (typeof d === 'string') return { title: d, items: [] };

    const title = pick(d, ['title','name','heading','titel','ueberschrift','überschrift']) ?? `Tag ${i+1}`;

    let items = pick(d, ['items','entries','timeline','points','program','schedule','eintraege','einträge','punkte']);
    if (!Array.isArray(items)) items = [];

    items = items.map(it => {
      if (typeof it === 'string') return { title: it };
      const time = pick(it, ['time','uhr','zeit','when']);
      const t    = pick(it, ['title','name','what','titel']);
      const note = pick(it, ['note','hint','info','notiz','beschreibung']);
      const lat  = typeof it.lat === 'number' ? it.lat : (typeof pick(it,['latitude'])==='number' ? pick(it,['latitude']) : undefined);
      const lng  = typeof it.lng === 'number' ? it.lng : (typeof pick(it,['longitude','lon','long'])==='number' ? pick(it,['longitude','lon','long']) : undefined);
      return { time, title: t || it.title || '—', note, lat, lng };
    });

    return { title, items };
  });
}

function normalizeIdeas(rawIdeas){
  const arr = Array.isArray(rawIdeas) ? rawIdeas : [];
  return arr.map(g => {
    const group = pick(g, ['group','title','name','gruppe','kategorie']) || 'Ideen';
    const hint  = pick(g, ['hint','note','info','hinweis']) || '';
    let options = pick(g, ['options','list','entries','punkte','eintraege','einträge']);
    if (!Array.isArray(options)) options = [];
    options = options.map(o => {
      if (typeof o === 'string') return { name: o };
      const name = pick(o, ['name','title','titel']);
      const note = pick(o, ['note','hint','info','notiz']);
      const lat  = typeof o.lat === 'number' ? o.lat : (typeof pick(o,['latitude'])==='number' ? pick(o,['latitude']) : undefined);
      const lng  = typeof o.lng === 'number' ? o.lng : (typeof pick(o,['longitude','lon','long'])==='number' ? pick(o,['longitude','lon','long']) : undefined);
      return { name: name || '—', note, lat, lng };
    });
    return { group, hint, options };
  });
}

/* 4) Daten laden (robuster Pfad + Cachebust + Varianten-Support) */
async function loadData() {
  const url = new URL('london2025_data.json', document.baseURI); // funktioniert im GitHub-Pages-Subfolder
  url.searchParams.set('v', '5'); // Cachebust

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} für ${url.pathname}`);
    const json = await res.json();

    const rawDays  = Array.isArray(json.days)  ? json.days  : (Array.isArray(json.tage)  ? json.tage  : []);
    const rawIdeas = Array.isArray(json.ideas) ? json.ideas : (Array.isArray(json.ideen) ? json.ideen : (Array.isArray(json.groups) ? json.groups : []));

    AppState.data.days  = normalizeDays(rawDays);
    AppState.data.ideas = normalizeIdeas(rawIdeas);

    console.log('JSON geladen:', url.pathname, { days: AppState.data.days.length, ideas: AppState.data.ideas.length });
  } catch (e) {
    console.error('Daten-Fehler:', e);
    AppState.data = { days: [], ideas: [] };
  }
}

/* 5) Render */
function renderDays() {
  const grid = $('#day-grid'); if (!grid) return;
  grid.innerHTML = '';

  if (!AppState.data.days.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = 'Keine Tage geladen. Prüfe london2025_data.json';
    grid.appendChild(empty);
    return;
  }

  AppState.data.days.forEach((day, idx) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.setAttribute('role','listitem');
    card.style.textAlign = 'left';
    const title = day.title || `Tag ${idx+1}`;
    card.innerHTML = `<strong>Tag ${idx + 1}</strong><br/><span style="opacity:.8">${title}</span>`;
    card.addEventListener('click', () => window.showDay(idx));
    grid.appendChild(card);
  });
}

function renderIdeas() {
  const wrap = $('#ideas'); if (!wrap) return;
  wrap.innerHTML = '';

  if (!AppState.data.ideas.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = 'Keine Ideen geladen. Prüfe london2025_data.json';
    wrap.appendChild(empty);
    return;
  }

  AppState.data.ideas.forEach(group => {
    const card = document.createElement('div');
    card.className = 'card';
    const options = (group.options || []).map(opt => {
      const parts = [opt.name].filter(Boolean);
      if (opt.note) parts.push(`<span style="opacity:.75">(${opt.note})</span>`);
      return `<li>${parts.join(' ')}</li>`;
    }).join('');
    card.innerHTML = `
      <h3 style="margin:0 0 6px">${group.group || 'Ideen'}</h3>
      ${group.hint ? `<p style="margin:0 0 6px;opacity:.8">${group.hint}</p>` : ''}
      <ul style="margin:0;padding-left:18px">${options}</ul>
    `;
    wrap.appendChild(card);
  });
}

/* 6) Bottom Sheet */
(function sheetControls(){
  const sheet = $('#sheet'); if (!sheet) return;
  const closeBtn = $('#closeSheet'), prevBtn = $('#prevDayTop'), nextBtn = $('#nextDayTop');
  const titleEl = $('#sheetTitle'), timeline = $('#timeline');

  function openSheet(){ sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden','false'); }
  function closeSheet(){ sheet.classList.add('hidden'); sheet.setAttribute('aria-hidden','true'); }

  window.showDay = function showDay(idx = 0){
    AppState.activeDayIndex = Math.max(0, Math.min(idx, AppState.data.days.length - 1));
    const day = AppState.data.days[AppState.activeDayIndex] || {};
    const title = day.title || `Tag ${AppState.activeDayIndex + 1}`;
    titleEl && (titleEl.textContent = `Tag ${AppState.activeDayIndex + 1} – ${title}`);

    if (timeline){
      timeline.innerHTML = '';
      (day.items || []).forEach(it => {
        const el = document.createElement('div');
        el.className = 'item';
        const t = it.time ? `<strong>${it.time}</strong> · ` : '';
        const name = it.title || '—';
        const note = it.note ? ` <span style="opacity:.75">(${it.note})</span>` : '';
        el.innerHTML = `${t}${name}${note}`;
        timeline.appendChild(el);
      });
    }

    prepareMapMarkersFromDay(day);
    openSheet();
  };

  closeBtn && closeBtn.addEventListener('click', closeSheet);
  prevBtn  && prevBtn.addEventListener('click', () => window.showDay(Math.max(0, AppState.activeDayIndex - 1)));
  nextBtn  && nextBtn.addEventListener('click', () => window.showDay(AppState.activeDayIndex + 1));
})();

/* 7) Karte (Leaflet) + Globaler Button */
(function mapModal(){
  const modal = $('#mapModal'), mapDiv = $('#map');
  const openBtn = $('#openMap'), closeBtn = $('#closeMap'), dblHint = $('#mapHint');
  const openGlobal = $('#openMapGlobal');
  if (!modal || !mapDiv) return;

  function ensureMap(){
    if (AppState.map) return AppState.map;
    AppState.map = L.map(mapDiv).setView([51.5074, -0.1278], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(AppState.map);
    AppState.mapLayer = L.layerGroup().addTo(AppState.map);
    return AppState.map;
  }

  function openModal(){ modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); ensureMap(); setTimeout(()=>{ AppState.map && AppState.map.invalidateSize(); }, 0); }
  function closeModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }

  openBtn   && openBtn.addEventListener('click', openModal);
  closeBtn  && closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('dblclick', (e)=>{ if (e.target === modal || e.target === dblHint) closeModal(); });

  openGlobal && openGlobal.addEventListener('click', ()=>{
    if (typeof window.showDay === 'function') window.showDay(0);
    openModal();
  });
})();

/* Marker aus aktivem Tag */
function prepareMapMarkersFromDay(day){
  if (!day || !Array.isArray(day.items) || !window.L || !AppState.map) return;
  if (AppState.mapLayer){ AppState.mapLayer.clearLayers(); }
  const pts = day.items.filter(i => typeof i.lat === 'number' && typeof i.lng === 'number');
  pts.forEach(p => { L.marker([p.lat, p.lng]).addTo(AppState.mapLayer).bindPopup(p.title || 'Ort'); });
  if (pts.length){ const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng])); AppState.map.fitBounds(bounds.pad(0.25)); }
}

/* 8) Boot */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderDays();
  renderIdeas();
});
