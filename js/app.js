/* =============================================================================
   app.js — Interfaccia, navigazione, esecuzione dei test, salvataggio risultati
============================================================================= */
const { TESTS, NORME } = window.APP_DATA;
const $ = sel => document.querySelector(sel);
const app = $('#app');

/* ----------------------------- Stato & storage ---------------------------- */
const STORE_KEY = 'test_atletici_storico_v1';
const PREF_KEY  = 'test_atletici_pref_v1';

function loadHistory(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY))||[]; }catch(e){ return []; } }
function saveHistory(h){ localStorage.setItem(STORE_KEY, JSON.stringify(h)); }
function loadPrefs(){ try{ return JSON.parse(localStorage.getItem(PREF_KEY))||{voice:true, atleta:''}; }catch(e){ return {voice:true, atleta:''}; } }
function savePrefs(p){ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

let PREFS = loadPrefs();
window.Audio.voiceOn = PREFS.voice;
let LIVE = null;          // stato live del test in corso
let RUNNER = null;        // istanza Runner attiva

/* ------------------------------ Navigazione ------------------------------- */
function go(view, arg){
  window.scrollTo(0,0);
  if(RUNNER){ RUNNER.stop(); RUNNER=null; window.Audio.releaseWakeLock(); }
  if(view==='home')    renderHome();
  else if(view==='test')   renderTest(arg);
  else if(view==='run')    renderRun(arg);
  else if(view==='storico')renderStorico();
  else if(view==='impostazioni') renderImpostazioni();
}

/* --------------------------------- HOME ----------------------------------- */
function renderHome(){
  const groups = {};
  TESTS.forEach(t=>{ (groups[t.gruppo] ||= []).push(t); });
  const atleta = PREFS.atleta || '';
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">◧</span> Test Atletici</div>
      <button class="icon-btn" id="btn-imp" aria-label="Impostazioni">⚙︎</button>
    </header>
    <div class="wrap">
      <label class="atleta-field">
        <span>Atleta</span>
        <input id="atleta" type="text" placeholder="Nome atleta / squadra" value="${escapeHtml(atleta)}" autocomplete="off">
      </label>
      ${Object.entries(groups).map(([g, arr])=>`
        <section class="group">
          <h2 class="group-title">${g}</h2>
          <div class="card-list">
            ${arr.map(t=>`
              <button class="test-card" data-id="${t.id}">
                <span class="tc-icon">${t.icon}</span>
                <span class="tc-body">
                  <span class="tc-name">${t.nome}</span>
                  <span class="tc-sub">${t.sottotitolo}</span>
                </span>
                <span class="tc-go">›</span>
              </button>`).join('')}
          </div>
        </section>`).join('')}
      <button class="ghost-btn" id="btn-storico">Storico risultati (${loadHistory().length})</button>
      <p class="foot-note">Le stime (VO₂max, potenza, % grasso) sono indicative e valgono soprattutto nel confronto longitudinale dello stesso atleta.</p>
    </div>`;
  $('#atleta').addEventListener('input', e=>{ PREFS.atleta=e.target.value; savePrefs(PREFS); });
  document.querySelectorAll('.test-card').forEach(b=> b.onclick=()=>go('test', b.dataset.id));
  $('#btn-storico').onclick=()=>go('storico');
  $('#btn-imp').onclick=()=>go('impostazioni');
}

/* ------------------------------ DETTAGLIO TEST ---------------------------- */
function renderTest(id){
  const t = TESTS.find(x=>x.id===id);
  app.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" id="back">‹</button>
      <div class="brand">${t.icon} ${t.nome}</div><span></span>
    </header>
    <div class="wrap">
      <p class="lead">${t.misura}</p>
      ${fieldDiagram(t)}
      <div class="info-block"><h3>Setup del campo</h3><p>${t.setup}</p></div>
      <div class="info-block"><h3>Come si esegue</h3><ol>${t.esecuzione.map(s=>`<li>${s}</li>`).join('')}</ol></div>
      <div class="info-block"><h3>Cosa registrare</h3><p>${t.registra}</p></div>
      <div class="info-block note"><h3>Note pratiche</h3><p>${t.note}</p></div>
      ${t.vo2 ? `<div class="info-block formula"><h3>Formula</h3><p>${t.vo2.formula}</p></div>`:''}
      <button class="primary-btn big" id="start">${startLabel(t)}</button>
    </div>`;
  $('#back').onclick=()=>go('home');
  $('#start').onclick=()=>go('run', t.id);
}

function startLabel(t){
  if(t.type==='input') return 'Inserisci i dati';
  if(t.type==='stopwatch') return 'Cronometro + starter';
  if(t.type==='repeated') return 'Avvia la serie';
  if(t.type==='timer') return 'Avvia il timer';
  return 'Avvia il test (audio)';
}

/* --------------------------- ROUTER ESECUZIONE ---------------------------- */
function renderRun(id){
  const t = TESTS.find(x=>x.id===id);
  if(t.type==='beep')          (t.id==='leger' ? runLeger(t) : runBeep(t));
  else if(t.type==='intermittent') runIntermittent(t);
  else if(t.type==='timer')    runTimer(t);
  else if(t.type==='stopwatch')runStopwatch(t);
  else if(t.type==='repeated') runRepeated(t);
  else if(t.type==='input')    runInput(t);
}

/* --------- Schermata "pista" condivisa (Yo-Yo / Léger / 30-15) ------------ */
function paceScreen(t, extra=''){
  app.innerHTML = `
    <div class="run-screen" id="runscreen">
      <div class="run-top">
        <button class="icon-btn light" id="quit">‹</button>
        <div class="run-title">${t.icon} ${t.nome}</div>
        <div class="run-elapsed" id="elapsed">0:00</div>
      </div>
      <div class="phase-panel" id="phase">
        <div class="phase-label" id="phaseLabel">PRONTI</div>
        <div class="phase-count" id="phaseCount">—</div>
        <div class="phase-speed" id="phaseSpeed"></div>
      </div>
      <div class="run-stats" id="stats">${extra}</div>
      <div class="run-actions">
        <button class="primary-btn big" id="go">Avvia</button>
        <button class="danger-btn big hidden" id="stop">STOP / Fine test</button>
      </div>
      <p class="run-hint">Tieni lo schermo acceso. Alza il volume o collega una cassa Bluetooth.</p>
    </div>`;
  $('#quit').onclick=()=>{ if(confirm('Uscire dal test in corso?')) go('test', t.id); };
}

function flash(kind){
  const p = $('#phase'); if(!p) return;
  p.classList.remove('flash-run','flash-rec');
  void p.offsetWidth;
  p.classList.add(kind==='rec'?'flash-rec':'flash-run');
  window.Audio.vibrate(kind==='rec'?[40]:[60]);
}

function runBeep(t){
  const sched = ENGINES.buildYoYo(t);
  paceScreen(t, `
    <div class="stat"><span class="s-val" id="st-speed">${t.speeds[0]}</span><span class="s-lab">km/h</span></div>
    <div class="stat"><span class="s-val" id="st-shuttle">0</span><span class="s-lab">navette</span></div>
    <div class="stat"><span class="s-val" id="st-dist">0</span><span class="s-lab">metri</span></div>`);
  $('#go').onclick=async ()=>{
    await window.Audio.unlock();
    $('#go').classList.add('hidden'); $('#stop').classList.remove('hidden');
    RUNNER = new ENGINES.Runner(sched, {
      onEvent: ev=>{ if(ev.kind==='double'||ev.kind==='go') flash('run'); if(ev.kind==='end') flash('rec'); },
      onTick: (el)=>{
        const s = ENGINES.yoyoState(el, sched); LIVE = s;
        setPhase(s.phase, s.remain, s.speed);
        $('#st-speed').textContent = fmt1(s.speed);
        $('#st-shuttle').textContent = s.phase==='run'? s.shuttle : s.shuttle;
        $('#st-dist').textContent = s.phase==='run'? Math.max(0,s.dist-40) : s.dist;
        $('#elapsed').textContent = mmss(el);
      },
      onFinish: ()=> finishBeep(t, sched.total)
    });
    RUNNER.start();
  };
  $('#stop').onclick=()=>{ RUNNER.stop(); finishBeep(t); };
}

function runLeger(t){
  const sched = ENGINES.buildLeger(t);
  paceScreen(t, `
    <div class="stat"><span class="s-val" id="st-level">1</span><span class="s-lab">livello</span></div>
    <div class="stat"><span class="s-val" id="st-speed">${fmt1(t.startSpeed)}</span><span class="s-lab">km/h</span></div>
    <div class="stat"><span class="s-val" id="st-dist">0</span><span class="s-lab">metri</span></div>`);
  $('#go').onclick=async ()=>{
    await window.Audio.unlock();
    $('#go').classList.add('hidden'); $('#stop').classList.remove('hidden');
    RUNNER = new ENGINES.Runner(sched, {
      onEvent: ev=>{ if(ev.kind==='triple') flash('run'); if(ev.kind==='line') flash('run'); },
      onTick: (el)=>{
        const s = ENGINES.legerState(el, sched); LIVE=s;
        setPhase('run', s.remain, s.speed, `Livello ${s.level}`);
        $('#st-level').textContent = s.level;
        $('#st-speed').textContent = fmt1(s.speed);
        $('#st-dist').textContent = s.dist;
        $('#elapsed').textContent = mmss(el);
      },
      onFinish: ()=> finishBeep(t, sched.total)
    });
    RUNNER.start();
  };
  $('#stop').onclick=()=>{ RUNNER.stop(); finishBeep(t); };
}

function runIntermittent(t){
  const sched = ENGINES.build3015(t);
  paceScreen(t, `
    <div class="stat"><span class="s-val" id="st-stage">1</span><span class="s-lab">stadio</span></div>
    <div class="stat"><span class="s-val" id="st-speed">${fmt1(t.startSpeed)}</span><span class="s-lab">km/h (VIFT)</span></div>`);
  $('#go').onclick=async ()=>{
    await window.Audio.unlock();
    $('#go').classList.add('hidden'); $('#stop').classList.remove('hidden');
    RUNNER = new ENGINES.Runner(sched, {
      onEvent: ev=>{ if(ev.kind==='go') flash('run'); if(ev.kind==='double') flash('rec'); },
      onTick: (el)=>{
        const s = ENGINES.iftState(el, sched); LIVE=s;
        setPhase(s.phase, s.remain, s.speed, s.phase==='run'?`Stadio ${s.stage}`:'Recupero');
        $('#st-stage').textContent = s.stage;
        $('#st-speed').textContent = fmt1(s.speed);
        $('#elapsed').textContent = mmss(el);
      },
      onFinish: ()=> finishBeep(t, sched.total)
    });
    RUNNER.start();
  };
  $('#stop').onclick=()=>{ RUNNER.stop(); finishBeep(t); };
}

function setPhase(phase, remain, speed, labelOverride){
  const pl=$('#phaseLabel'), pc=$('#phaseCount'), ps=$('#phaseSpeed'), panel=$('#phase');
  if(!pl) return;
  const isRun = phase==='run';
  panel.classList.toggle('is-run', isRun);
  panel.classList.toggle('is-rec', !isRun);
  pl.textContent = labelOverride || (isRun?'CORRI':'RECUPERO');
  pc.textContent = Math.ceil(remain).toString();
  ps.textContent = speed? fmt1(speed)+' km/h':'';
}

/* prefill risultato al termine di un test a beep/intervalli */
function finishBeep(t, totalReached){
  window.Audio.releaseWakeLock();
  let prefill={};
  if(t.id==='yoyo_ir1'||t.id==='yoyo_ir2'){
    const dist = LIVE? (LIVE.phase==='run'? Math.max(0,LIVE.dist-40) : LIVE.dist) : 0;
    prefill={ distanza: dist };
  } else if(t.id==='ift3015'){
    prefill={ vift: LIVE? fmt1(LIVE.speed):'', eta:PREFS.eta||'', peso:PREFS.peso||'', sesso:PREFS.sesso||'M' };
  } else if(t.id==='leger'){
    prefill={ velocita: LIVE? fmt1(LIVE.speed):'', eta:PREFS.eta||'' };
  }
  renderResultForm(t, prefill, 'Test terminato. Correggi il valore raggiunto dall\u2019atleta e calcola.');
}

/* ------------------------------ COOPER TIMER ------------------------------ */
function runTimer(t){
  const sched = ENGINES.buildCooper(t);
  app.innerHTML = `
    <div class="run-screen">
      <div class="run-top">
        <button class="icon-btn light" id="quit">‹</button>
        <div class="run-title">${t.icon} ${t.nome}</div><span></span>
      </div>
      <div class="phase-panel is-run big-timer">
        <div class="phase-label">TEMPO RIMANENTE</div>
        <div class="phase-count" id="bigclock">12:00</div>
      </div>
      <div class="run-actions">
        <button class="primary-btn big" id="go">Avvia 12:00</button>
        <button class="danger-btn big hidden" id="stop">Ferma</button>
      </div>
      <p class="run-hint">Allo stop misura la distanza percorsa e inseriscila.</p>
    </div>`;
  $('#quit').onclick=()=>go('test', t.id);
  $('#go').onclick=async ()=>{
    await window.Audio.unlock();
    $('#go').classList.add('hidden'); $('#stop').classList.remove('hidden');
    RUNNER = new ENGINES.Runner(sched, {
      onTick:(el)=>{ $('#bigclock').textContent = mmss(Math.max(0, t.durationSec-el)); },
      onFinish:()=>{ window.Audio.releaseWakeLock(); renderResultForm(t, {}, 'Tempo scaduto. Inserisci la distanza percorsa.'); }
    });
    RUNNER.start();
  };
  $('#stop').onclick=()=>{ RUNNER.stop(); window.Audio.releaseWakeLock(); renderResultForm(t, {}, 'Inserisci la distanza percorsa.'); };
}

/* -------------------- SPRINT / 505 : starter + split ---------------------- */
function runStopwatch(t){
  let running=false, t0=0, raf=null;
  const splits={};
  app.innerHTML = `
    <div class="run-screen">
      <div class="run-top">
        <button class="icon-btn light" id="quit">‹</button>
        <div class="run-title">${t.icon} ${t.nome}</div><span></span>
      </div>
      <div class="phase-panel is-run big-timer">
        <div class="phase-label">CRONOMETRO</div>
        <div class="phase-count" id="clock">0.00</div>
      </div>
      <div class="split-row" id="splitRow">
        ${t.splits.map(m=>`<button class="split-btn" data-m="${m}" disabled>${m} m</button>`).join('')}
      </div>
      <div class="run-actions">
        <button class="primary-btn big" id="via">Pronti… Via (3-2-1)</button>
        <button class="danger-btn big hidden" id="reset">Azzera</button>
        <button class="ghost-btn hidden" id="salva">Usa questi tempi ›</button>
      </div>
      <p class="run-hint">Tocca il pulsante del cono nell\u2019istante in cui l\u2019atleta lo supera. Precisione manuale: fai più prove.</p>
    </div>`;
  $('#quit').onclick=()=>go('test', t.id);
  const clock=$('#clock');
  function tick(){ if(!running) return; clock.textContent=((performance.now()-t0)/1000).toFixed(2); raf=requestAnimationFrame(tick); }
  $('#via').onclick=async ()=>{
    await window.Audio.unlock();
    const base=window.Audio.now();
    window.Audio.cue(base,'countdown'); window.Audio.cue(base+1,'countdown'); window.Audio.cue(base+2,'countdown');
    window.Audio.cue(base+3,'start');
    setTimeout(()=>{
      running=true; t0=performance.now(); tick();
      $('#via').classList.add('hidden'); $('#reset').classList.remove('hidden'); $('#salva').classList.remove('hidden');
      document.querySelectorAll('.split-btn').forEach(b=>b.disabled=false);
    }, 3000);
  };
  document.querySelectorAll('.split-btn').forEach(b=> b.onclick=()=>{
    const m=b.dataset.m; splits[m]=(performance.now()-t0)/1000;
    b.classList.add('done'); b.textContent=`${m} m · ${splits[m].toFixed(2)}s`; b.disabled=true;
    window.Audio.cue(window.Audio.now(),'turn');
  });
  $('#reset').onclick=()=>{ running=false; cancelAnimationFrame(raf); go('run', t.id); };
  $('#salva').onclick=()=>{ running=false; cancelAnimationFrame(raf);
    if(t.id==='cod505'){ renderResultForm(t, {5:splits[5]||'', lin10:''}, 'Inserisci (se lo hai) il tempo 10 m lineare per il COD deficit.'); }
    else { renderResultForm(t, splits, 'Verifica i parziali e calcola.'); }
  };
}

/* ----------------------- RSA / RAST : serie con recupero ------------------ */
function runRepeated(t){
  let rep=0;
  app.innerHTML = `
    <div class="run-screen">
      <div class="run-top">
        <button class="icon-btn light" id="quit">‹</button>
        <div class="run-title">${t.icon} ${t.nome}</div><span></span>
      </div>
      <div class="phase-panel is-run big-timer">
        <div class="phase-label" id="repLabel">Sprint 1 / ${t.reps}</div>
        <div class="phase-count" id="repClock">—</div>
      </div>
      <div class="run-actions">
        <button class="primary-btn big" id="via">Via sprint 1</button>
        <button class="ghost-btn hidden" id="rest">Avvia recupero (${t.restSec}s)</button>
        <button class="ghost-btn" id="tofields">Inserisci i tempi ›</button>
      </div>
      <p class="run-hint">Dai il "Via", cronometra lo sprint (o leggi le fotocellule), poi avvia il recupero. Ripeti per ${t.reps} sprint.</p>
    </div>`;
  $('#quit').onclick=()=>go('test', t.id);
  $('#via').onclick=async ()=>{
    await window.Audio.unlock();
    window.Audio.cue(window.Audio.now(),'start');
    rep++; 
    $('#repLabel').textContent=`Sprint ${rep} / ${t.reps} — corri!`;
    $('#via').classList.add('hidden'); $('#rest').classList.remove('hidden');
  };
  $('#rest').onclick=()=>{
    let n=t.restSec; $('#repLabel').textContent='Recupero';
    $('#rest').classList.add('hidden');
    const iv=setInterval(()=>{
      $('#repClock').textContent=n;
      if(n<=3 && n>0) window.Audio.cue(window.Audio.now(),'countdown');
      if(n<=0){ clearInterval(iv);
        window.Audio.cue(window.Audio.now(),'start');
        $('#repClock').textContent='—';
        if(rep>=t.reps){ $('#repLabel').textContent='Serie completa'; renderRepeatedFields(t); return; }
        rep++; $('#repLabel').textContent=`Sprint ${rep} / ${t.reps} — corri!`;
        $('#rest').classList.remove('hidden');
      }
      n--;
    },1000);
  };
  $('#tofields').onclick=()=>renderRepeatedFields(t);
}

function renderRepeatedFields(t){
  const rows = Array.from({length:t.reps}, (_,i)=>`
    <label class="field"><span>Sprint ${i+1} (s)</span>
      <input type="number" step="0.01" inputmode="decimal" data-rep="${i}"></label>`).join('');
  const extra = t.id==='rast' ? `<label class="field"><span>Peso corporeo (kg)</span>
      <input id="peso" type="number" step="0.1" inputmode="decimal" value="${PREFS.peso||''}"></label>`:'';
  app.innerHTML = `
    <header class="topbar"><button class="icon-btn" id="back">‹</button>
      <div class="brand">${t.icon} ${t.nome}</div><span></span></header>
    <div class="wrap">
      <p class="lead">Inserisci il tempo di ogni sprint.</p>
      <div class="form-grid">${rows}${extra}</div>
      <button class="primary-btn big" id="calc">Calcola</button>
    </div>`;
  $('#back').onclick=()=>go('run', t.id);
  $('#calc').onclick=()=>{
    const times=[]; document.querySelectorAll('[data-rep]').forEach(inp=> times[+inp.dataset.rep]=+inp.value||0);
    const values={ times }; if(t.id==='rast'){ values.peso=$('#peso').value; PREFS.peso=values.peso; savePrefs(PREFS); }
    const res = CALC.runCalc(t, values);
    showResult(t, res);
  };
}

/* ------------------------------ TEST A INPUT ------------------------------ */
function runInput(t){ renderResultForm(t, {}, ''); }

function renderResultForm(t, prefill, hint){
  const fields = t.fields || defaultFields(t);
  app.innerHTML = `
    <header class="topbar"><button class="icon-btn" id="back">‹</button>
      <div class="brand">${t.icon} ${t.nome}</div><span></span></header>
    <div class="wrap">
      ${hint?`<p class="lead">${hint}</p>`:''}
      <div class="form-grid">
        ${fields.map(f=>fieldHtml(f, prefill[f.key])).join('')}
      </div>
      <button class="primary-btn big" id="calc">Calcola e mostra</button>
    </div>`;
  $('#back').onclick=()=>go('test', t.id);
  $('#calc').onclick=()=>{
    const values={};
    fields.forEach(f=>{
      const el=$('#f-'+f.key);
      values[f.key]= el ? el.value : '';
    });
    // memorizza dati anagrafici comodi
    if(values.eta) PREFS.eta=values.eta; if(values.peso) PREFS.peso=values.peso; if(values.sesso) PREFS.sesso=values.sesso;
    savePrefs(PREFS);
    const res = CALC.runCalc(t, values);
    if(!res){ alert('Inserisci i valori necessari.'); return; }
    showResult(t, res);
  };
}

/* campi di default per i test a beep/timer (in fase di risultato) */
function defaultFields(t){
  if(t.id==='yoyo_ir1'||t.id==='yoyo_ir2') return [{key:'distanza',label:'Distanza totale',unit:'m'}];
  if(t.id==='cooper') return [{key:'distanza',label:'Distanza in 12 min',unit:'m'}];
  if(t.id==='ift3015') return [
    {key:'vift',label:'VIFT (ultimo stadio)',unit:'km/h'},
    {key:'eta',label:'Età',unit:'anni'},{key:'peso',label:'Peso',unit:'kg'},{key:'sesso',label:'Sesso',type:'sex'}];
  if(t.id==='leger') return [{key:'velocita',label:'Velocità ultimo livello',unit:'km/h'},{key:'eta',label:'Età',unit:'anni'}];
  if(t.id==='sprint') return t.splits.map(m=>({key:String(m),label:`${m} m`,unit:'s'}));
  if(t.id==='cod505') return [{key:'5',label:'Tempo 505',unit:'s'},{key:'lin10',label:'10 m lineare (opz.)',unit:'s',optional:true}];
  return [];
}

function fieldHtml(f, value){
  if(f.type==='sex'){
    const v=value||PREFS.sesso||'M';
    return `<label class="field"><span>${f.label}</span>
      <select id="f-${f.key}">
        <option value="M" ${v==='M'?'selected':''}>Uomo</option>
        <option value="F" ${v==='F'?'selected':''}>Donna</option>
      </select></label>`;
  }
  return `<label class="field"><span>${f.label}${f.unit?` (${f.unit})`:''}${f.optional?' ·opz.':''}</span>
    <input id="f-${f.key}" type="number" step="0.01" inputmode="decimal" value="${value!==undefined&&value!==''?value:''}"></label>`;
}

/* ------------------------------ RISULTATO --------------------------------- */
function showResult(t, res){
  const norm = normHint(t, res);
  app.innerHTML = `
    <header class="topbar"><button class="icon-btn" id="back">‹</button>
      <div class="brand">${t.icon} ${t.nome}</div><span></span></header>
    <div class="wrap">
      <div class="result-hero">
        <div class="rh-lab">${res.label}</div>
        <div class="rh-val">${res.valore}<small>${res.unita}</small></div>
        ${norm?`<div class="rh-norm">${norm}</div>`:''}
      </div>
      <div class="result-rows">
        ${res.righe.map(r=>`<div class="rr"><span>${r.label}</span><b>${r.valore}</b></div>`).join('')}
      </div>
      ${res.formula?`<p class="formula-note">${res.formula}</p>`:''}
      <button class="primary-btn big" id="save">Salva nello storico</button>
      <button class="ghost-btn" id="again">Nuova prova</button>
      <button class="ghost-btn" id="home">Torna alla home</button>
    </div>`;
  $('#back').onclick=()=>go('test', t.id);
  $('#again').onclick=()=>go('run', t.id);
  $('#home').onclick=()=>go('home');
  $('#save').onclick=()=>{
    const h=loadHistory();
    h.unshift({ id:Date.now(), testId:t.id, testName:t.nome, atleta:PREFS.atleta||'—',
      data:new Date().toISOString(), label:res.label, valore:res.valore, unita:res.unita, righe:res.righe });
    saveHistory(h);
    $('#save').textContent='✓ Salvato'; $('#save').disabled=true;
  };
}

function normHint(t, res){
  if(res.unita==='ml/kg/min'){ return `Rif. élite calcio — ${NORME.vo2max.uomo} · ${NORME.vo2max.donna}`; }
  if(t.id==='ift3015' && res.unita==='km/h'){ return `Rif. VIFT — ${NORME.vift.uomo} · ${NORME.vift.donna}`; }
  return '';
}

/* -------------------------------- STORICO --------------------------------- */
function renderStorico(){
  const h=loadHistory();
  app.innerHTML = `
    <header class="topbar"><button class="icon-btn" id="back">‹</button>
      <div class="brand">Storico</div>
      <button class="icon-btn" id="exp" aria-label="Esporta">⬇︎</button></header>
    <div class="wrap">
      ${h.length? h.map(r=>`
        <div class="hist-card">
          <div class="hc-top"><b>${escapeHtml(r.atleta)}</b><span>${new Date(r.data).toLocaleDateString('it-IT')}</span></div>
          <div class="hc-mid">${r.testName}</div>
          <div class="hc-val">${r.label}: <b>${r.valore} ${r.unita}</b></div>
          <button class="link-btn" data-del="${r.id}">Elimina</button>
        </div>`).join('')
      : `<p class="empty">Nessun risultato salvato. Esegui un test e premi "Salva nello storico".</p>`}
    </div>`;
  $('#back').onclick=()=>go('home');
  $('#exp').onclick=()=>exportCSV(h);
  document.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>{
    saveHistory(loadHistory().filter(x=>x.id!=b.dataset.del)); renderStorico();
  });
}

function exportCSV(h){
  if(!h.length){ alert('Storico vuoto.'); return; }
  const rows=[['data','atleta','test','risultato','valore','unita']];
  h.forEach(r=> rows.push([r.data, r.atleta, r.testName, r.label, r.valore, r.unita]));
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='test_atletici.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------ IMPOSTAZIONI ------------------------------ */
function renderImpostazioni(){
  app.innerHTML = `
    <header class="topbar"><button class="icon-btn" id="back">‹</button>
      <div class="brand">Impostazioni</div><span></span></header>
    <div class="wrap">
      <label class="toggle-row">
        <span>Annunci vocali (livello / velocità)</span>
        <input type="checkbox" id="voice" ${PREFS.voice?'checked':''}>
      </label>
      <div class="info-block note"><h3>Audio in campo</h3>
        <p>Collega una cassa Bluetooth e alza il volume. Su iPhone tieni lo schermo acceso: quando è bloccato l\u2019audio può interrompersi.</p></div>
      <div class="info-block"><h3>Dati anagrafici predefiniti</h3>
        <div class="form-grid">
          <label class="field"><span>Età (anni)</span><input id="eta" type="number" value="${PREFS.eta||''}"></label>
          <label class="field"><span>Peso (kg)</span><input id="peso" type="number" value="${PREFS.peso||''}"></label>
        </div>
      </div>
      <button class="ghost-btn danger-text" id="clear">Cancella tutto lo storico</button>
      <p class="foot-note">Versione 1.0 · Dati salvati solo su questo dispositivo (nessun invio in rete).</p>
    </div>`;
  $('#back').onclick=()=>go('home');
  $('#voice').onchange=e=>{ PREFS.voice=e.target.checked; window.Audio.voiceOn=PREFS.voice; savePrefs(PREFS); };
  $('#eta').oninput=e=>{ PREFS.eta=e.target.value; savePrefs(PREFS); };
  $('#peso').oninput=e=>{ PREFS.peso=e.target.value; savePrefs(PREFS); };
  $('#clear').onclick=()=>{ if(confirm('Eliminare tutti i risultati salvati?')){ saveHistory([]); alert('Storico cancellato.'); } };
}

/* ----------------------------- Diagrammi campo ---------------------------- */
function fieldDiagram(t){
  let svg='';
  const W=320,H=120;
  if(t.id==='yoyo_ir1'||t.id==='yoyo_ir2'){
    svg=`<svg viewBox="0 0 ${W} ${H}"><rect class="pitch" x="0" y="0" width="${W}" height="${H}"/>
      <line class="ln" x1="60" y1="20" x2="60" y2="100"/><line class="ln" x1="280" y1="20" x2="280" y2="100"/>
      <line class="ln dash" x1="20" y1="20" x2="20" y2="100"/>
      <path class="arrow" d="M70 60 H270" marker-end="url(#a)"/><path class="arrow" d="M270 76 H70" marker-end="url(#a)"/>
      <text class="tx" x="150" y="14" text-anchor="middle">20 m</text>
      <text class="tx" x="40" y="14" text-anchor="middle">5 m rec.</text>${arrowDef()}</svg>`;
  } else if(t.id==='ift3015'){
    svg=`<svg viewBox="0 0 ${W} ${H}"><rect class="pitch" x="0" y="0" width="${W}" height="${H}"/>
      <line class="ln" x1="30" y1="20" x2="30" y2="100"/><line class="ln" x1="160" y1="20" x2="160" y2="100"/><line class="ln" x1="290" y1="20" x2="290" y2="100"/>
      <line class="ln dash" x1="50" y1="24" x2="50" y2="96"/><line class="ln dash" x1="140" y1="24" x2="140" y2="96"/><line class="ln dash" x1="180" y1="24" x2="180" y2="96"/><line class="ln dash" x1="270" y1="24" x2="270" y2="96"/>
      <text class="tx" x="30" y="14" text-anchor="middle">A</text><text class="tx" x="160" y="14" text-anchor="middle">B (20m)</text><text class="tx" x="290" y="14" text-anchor="middle">C (40m)</text>
      <text class="tx small" x="160" y="112" text-anchor="middle">zone di tolleranza 3 m</text></svg>`;
  } else if(t.id==='leger'){
    svg=`<svg viewBox="0 0 ${W} ${H}"><rect class="pitch" x="0" y="0" width="${W}" height="${H}"/>
      <line class="ln" x1="40" y1="20" x2="40" y2="100"/><line class="ln" x1="280" y1="20" x2="280" y2="100"/>
      <path class="arrow" d="M50 60 H270" marker-end="url(#a)"/><path class="arrow" d="M270 76 H50" marker-end="url(#a)"/>
      <text class="tx" x="160" y="14" text-anchor="middle">20 m — corsa continua</text>${arrowDef()}</svg>`;
  } else if(t.id==='sprint'){
    svg=`<svg viewBox="0 0 ${W} ${H}"><rect class="pitch" x="0" y="0" width="${W}" height="${H}"/>
      ${[30,110,190,270].map((x,i)=>`<line class="ln" x1="${x}" y1="24" x2="${x}" y2="96"/><text class="tx small" x="${x}" y="16" text-anchor="middle">${[0,10,20,30][i]}m</text>`).join('')}
      <path class="arrow" d="M30 60 H270" marker-end="url(#a)"/>${arrowDef()}</svg>`;
  } else if(t.id==='cod505'){
    svg=`<svg viewBox="0 0 ${W} ${H}"><rect class="pitch" x="0" y="0" width="${W}" height="${H}"/>
      <line class="ln" x1="40" y1="20" x2="40" y2="100"/><line class="ln dash" x1="160" y1="20" x2="160" y2="100"/><line class="ln" x1="280" y1="20" x2="280" y2="100"/>
      <text class="tx small" x="40" y="14" text-anchor="middle">start 15m</text><text class="tx small" x="160" y="14" text-anchor="middle">gate 5m</text><text class="tx small" x="280" y="14" text-anchor="middle">virata 180°</text>
      <path class="arrow" d="M50 60 H270" marker-end="url(#a)"/><path class="arrow" d="M270 76 H170" marker-end="url(#a)"/>${arrowDef()}</svg>`;
  } else { return ''; }
  return `<div class="field-diagram">${svg}</div>`;
}
function arrowDef(){ return `<defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="currentColor"/></marker></defs>`; }

/* -------------------------------- Utility --------------------------------- */
function mmss(s){ s=Math.max(0,Math.floor(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
function fmt1(v){ const r=Math.round(v*10)/10; return Number.isInteger(r)? r : r.toString().replace('.',','); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ------------------------------ Service Worker ---------------------------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

/* Avvio */
renderHome();
