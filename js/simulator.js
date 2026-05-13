import { classifyIntent } from "./classifier.js";
import { planQueries } from "./planner.js";
import { queryConnector } from "./connectors.js";
import { getCached, setCache, checkConsistency } from "./cache.js";
import { synthesise } from "./synthesiser.js";

const SCENARIOS = [
  { query: "Which at-risk deals this quarter have fulfilment issues that could affect close?", connectors: ["CRM","ERP","Ticketing"] },
  { query: "Which SKUs are below reorder threshold today?",                                    connectors: ["ERP"] },
  { query: "How is Q2 pipeline tracking against target by stage?",                             connectors: ["CRM"] },
  { query: "How many open P1 tickets are at risk of SLA breach right now?",                    connectors: ["Ticketing"] }
];

let selectedScenario = 0;
let running = false;

// ── Stage helpers ────────────────────────────────────────────────────────────

function setStageActive(n) {
  for (let i = 1; i <= 7; i++) {
    document.getElementById("stage-" + i)?.classList.remove("active");
  }
  document.getElementById("stage-" + n)?.classList.add("active");
}

function markStageDone(n) {
  const el = document.getElementById("stage-" + n);
  el?.classList.remove("active");
  el?.classList.add("done");
}

function resetStages() {
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById("stage-" + i);
    el?.classList.remove("active", "done");
  }
}

// ── Connector helpers ────────────────────────────────────────────────────────

const CONN_ID = { CRM: "crm", ERP: "erp", Ticketing: "ticket" };

function setConnector(name, status) {
  const id = CONN_ID[name];
  const el = document.getElementById("conn-" + id);
  const st = document.getElementById("conn-" + id + "-status");
  if (!el || !st) return;
  el.classList.remove("active", "done");
  if (status === "fetching") { el.classList.add("active");  st.textContent = "fetching..."; }
  if (status === "done")     { el.classList.add("done");    st.textContent = "done · " + new Date().toLocaleTimeString(); }
  if (status === "idle")     {                               st.textContent = "idle"; }
}

function resetConnectors() {
  ["crm","erp","ticket"].forEach(c => {
    document.getElementById("conn-"+c)?.classList.remove("active","done");
    const st = document.getElementById("conn-"+c+"-status");
    if (st) st.textContent = "idle";
  });
}

// ── Source attribution ───────────────────────────────────────────────────────

function renderSourceAttribution(results, consistency) {
  const bar   = document.getElementById("sourceBar");
  const items = document.getElementById("sourceItems");
  if (!bar || !items) return;

  items.innerHTML = Object.entries(results).map(([name, r]) => {
    const ageS   = Math.round((Date.now() - r.fetched_at) / 1000);
    const isWarn = ageS > r.ttl_policy;
    const badge  = isWarn
      ? `<span class="stale-badge">STALE</span>`
      : `<span class="fresh-badge">FRESH</span>`;
    return `
      <div class="source-item">
        <div class="src-name">${name} ${badge}</div>
        <div class="src-age ${isWarn ? 'warn' : ''}">fetched ${ageS}s ago · TTL ${r.ttl_policy}s</div>
      </div>`;
  }).join("");

  if (consistency.warning) {
    items.innerHTML += `
      <div class="source-item" style="grid-column:1/-1;border-top:1px solid var(--border)">
        <div class="src-name" style="color:var(--yellow)">⚠ Consistency warning</div>
        <div class="src-age warn">Temporal skew ${consistency.skewSeconds}s exceeds 120s threshold — results may join data from different operational moments</div>
      </div>`;
  }

  bar.style.display = "block";
}

// ── Core pipeline ────────────────────────────────────────────────────────────

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runPipeline(query) {
  if (running) return;
  running = true;

  const btn      = document.getElementById("runBtn");
  const freeBtn  = document.getElementById("freeQueryBtn");
  if (btn)     { btn.textContent = "running...";  btn.disabled = true; }
  if (freeBtn) { freeBtn.disabled = true; }

  const connLat   = parseInt(document.getElementById("latencySlider")?.value || 600);
  const ttlExpire = document.getElementById("ttlExpireToggle")?.checked;

  resetStages();
  resetConnectors();
  document.getElementById("simOutput").classList.remove("populated");
  document.getElementById("simOutput").textContent = "running…";
  document.getElementById("simLatency").style.display = "none";
  const sourceBar = document.getElementById("sourceBar");
  if (sourceBar) sourceBar.style.display = "none";

  const t0 = Date.now();

  // Stage 1 — receive
  setStageActive(1);
  await wait(60);
  markStageDone(1);

  // Stage 2 — classify via Groq
  setStageActive(2);
  const classifier = await classifyIntent(query);
  markStageDone(2);
  document.getElementById("lat-classify").textContent = (Date.now()-t0) + "ms · Groq";

  // Stage 3 — rule-based planner
  setStageActive(3);
  const connectors = classifier.connectors?.length ? classifier.connectors : ["CRM","ERP","Ticketing"];
  const plan = planQueries(classifier.intent, connectors);
  await wait(15);
  markStageDone(3);
  document.getElementById("lat-plan").textContent = "15";

  // Stage 4 — connector fetch (parallel, cache-aware)
  setStageActive(4);
  connectors.forEach(c => setConnector(c, "fetching"));

  const cacheKey = query.slice(0,40) + "_" + classifier.intent;
  let results = {};

  if (!ttlExpire) {
    connectors.forEach(c => {
      const hit = getCached(cacheKey + "_" + c);
      if (hit) results[c] = hit;
    });
  }

  const missing = connectors.filter(c => !results[c]);
  if (missing.length) {
    await wait(connLat);
    missing.forEach(c => {
      results[c] = queryConnector(c, plan[c]);
      setCache(cacheKey + "_" + c, results[c], classifier.intent);
    });
  }

  connectors.forEach(c => setConnector(c, "done"));
  markStageDone(4);
  document.getElementById("lat-conn").textContent = (Date.now()-t0) + "ms";

  // Stage 5 — freshness + consistency check
  setStageActive(5);
  const consistency = checkConsistency(results);
  await wait(20);
  markStageDone(5);

  // Stage 6 — synthesise via Groq
  setStageActive(6);
  const synthesis = await synthesise(query, classifier, results);
  markStageDone(6);
  document.getElementById("lat-synth").textContent = (Date.now()-t0) + "ms · Groq";

  // Stage 7 — render
  setStageActive(7);
  await wait(20);
  markStageDone(7);

  // Output
  const total = Date.now() - t0;
  document.getElementById("lat-total").textContent = total + "ms";
  document.getElementById("simLatency").style.display = "flex";

  const out = document.getElementById("simOutput");
  out.textContent = synthesis;
  out.classList.add("populated");

  renderSourceAttribution(results, consistency);

  if (btn)     { btn.textContent = "run simulation →"; btn.disabled = false; }
  if (freeBtn) { freeBtn.disabled = false; }
  running = false;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function selectScenario(btn, idx) {
  document.querySelectorAll(".sim-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  selectedScenario = idx;
  const qd = document.getElementById("simQuery");
  if (qd) qd.textContent = `"${SCENARIOS[idx].query}"`;
  const fi = document.getElementById("freeQueryInput");
  if (fi) fi.value = "";
  const out = document.getElementById("simOutput");
  if (out) { out.textContent = "Select a scenario and run simulation"; out.classList.remove("populated"); }
  document.getElementById("simLatency").style.display = "none";
  const sourceBar = document.getElementById("sourceBar");
  if (sourceBar) sourceBar.style.display = "none";
  resetStages();
  resetConnectors();
}

export function runSimulation() {
  const query = SCENARIOS[selectedScenario].query;
  document.getElementById("simQuery").textContent = `"${query}"`;
  runPipeline(query);
}

export function runFreeQuery() {
  const input = document.getElementById("freeQueryInput");
  const query = input?.value?.trim();
  if (!query) return;
  document.querySelectorAll(".sim-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("simQuery").textContent = `"${query}"`;
  runPipeline(query);
}
