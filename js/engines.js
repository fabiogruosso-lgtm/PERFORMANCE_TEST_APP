/* =============================================================================
   engines.js — Costruzione delle "scalette" (schedule) dei test e scheduler live
   Ogni evento: { t, kind, ...info }  con t = secondi dall'avvio.
   Lo scheduler usa l'orologio audio per accodare i beep in anticipo (lookahead).
============================================================================= */

const LOOKAHEAD = 0.15;   // s: quanto in anticipo accodiamo i beep
const TICK = 25;          // ms: frequenza del ticker dello scheduler

/* tempo (s) per percorrere d metri a v km/h */
function timeFor(meters, kmh){ return meters / (kmh/3.6); }

/* ---------- Yo-Yo IR1 / IR2 (navette 2×20 m + recupero) -------------------- */
function buildYoYo(test){
  const events = [];
  const stages = [];          // per il display: [{shuttle,speed,distFine,tStart}]
  let t = 0, dist = 0, prevSpeed = null;
  test.speeds.forEach((v, i)=>{
    const shuttle = i+1;
    const seg = timeFor(20, v);             // tempo per 20 m
    const levelUp = (v !== prevSpeed);
    events.push({ t, kind: levelUp ? 'double':'go', phase:'run', shuttle, speed:v, dist });
    if(levelUp && prevSpeed!==null) events.push({ t, kind:'voice', text:`${fmtSpeed(v)}` });
    events.push({ t: t+seg,   kind:'turn', phase:'run', shuttle, speed:v, dist:dist+20 });
    events.push({ t: t+2*seg, kind:'end',  phase:'rec', shuttle, speed:v, dist:dist+40 });
    dist += test.shuttleDist;
    stages.push({ shuttle, speed:v, dist, tStart:t, tRunEnd:t+2*seg, tRecEnd:t+2*seg+test.recovery });
    t += 2*seg + test.recovery;
    prevSpeed = v;
  });
  return { events, stages, total:t, kind:'yoyo' };
}

/* ---------- 30-15 IFT (30 s corsa / 15 s recupero passivo) ----------------- */
function build3015(test){
  const events = [];
  const stages = [];
  let t = 0;
  for(let s=1; s<=test.maxStages; s++){
    const v = test.startSpeed + test.speedStep*(s-1);
    const seg = timeFor(test.segMeters, v);      // tempo per 20 m
    const tStart = t;
    events.push({ t, kind:'go', phase:'run', stage:s, speed:v });
    events.push({ t, kind:'voice', text:`Stadio ${s}, ${fmtSpeed(v)}` });
    let bt = seg;
    // beep intermedi finché restiamo dentro i 30 s (tolleranza mezzo beep)
    while(bt <= test.runSec - seg*0.5 + 0.001){
      events.push({ t: t+bt, kind:'line', phase:'run', stage:s, speed:v });
      bt += seg;
    }
    events.push({ t: t+test.runSec, kind:'double', phase:'rec', stage:s, speed:v }); // fine 30 s
    stages.push({ stage:s, speed:v, tStart, tRunEnd:t+test.runSec, tRecEnd:t+test.runSec+test.recSec });
    t += test.runSec + test.recSec;
  }
  return { events, stages, total:t, kind:'ift' };
}

/* ---------- Léger 20 m (continuo, livelli ~60 s) --------------------------- */
function buildLeger(test){
  const events = [];
  const levels = [];
  let t = 0, dist = 0;
  for(let L=1; L<=test.maxLevels; L++){
    const v = test.startSpeed + test.speedStep*(L-1);
    const seg = timeFor(test.shuttleDist, v);                 // tempo per 20 m
    const nShuttles = Math.max(1, Math.round(test.levelSec / seg));
    events.push({ t, kind:'triple', phase:'run', level:L, speed:v, dist });
    events.push({ t, kind:'voice', text:`Livello ${L}, ${fmtSpeed(v)}` });
    for(let sh=1; sh<=nShuttles; sh++){
      events.push({ t: t+seg*sh, kind:'line', phase:'run', level:L, speed:v, shuttle:sh, dist:dist+test.shuttleDist*sh });
    }
    const tEnd = t + seg*nShuttles;
    levels.push({ level:L, speed:v, shuttles:nShuttles, tStart:t, tEnd, dist:dist+test.shuttleDist*nShuttles });
    dist += test.shuttleDist*nShuttles;
    t = tEnd;
  }
  return { events, levels, total:t, kind:'leger' };
}

/* ---------- Cooper (timer 12 min con avvisi) ------------------------------- */
function buildCooper(test){
  const D = test.durationSec, events = [];
  events.push({ t:0, kind:'start' });
  events.push({ t:D/2, kind:'countdown', mark:'metà tempo' });
  events.push({ t:D-60, kind:'countdown', mark:'ultimo minuto' });
  events.push({ t:D-30, kind:'countdown', mark:'ultimi 30 s' });
  [10,9,8,7,6,5,4,3,2,1].forEach(n=> events.push({ t:D-n, kind:'countdown', mark:n }));
  events.push({ t:D, kind:'finish' });
  return { events, total:D, kind:'timer' };
}

function fmtSpeed(v){
  // "14,5 km/h" leggibile a voce
  const r = Math.round(v*10)/10;
  return (Number.isInteger(r) ? r : r.toString().replace('.',',')) + ' chilometri orari';
}

/* =============================================================================
   Scheduler — riproduce una scaletta e notifica il display ad ogni frame
============================================================================= */
class Runner {
  constructor(schedule, {onTick, onEvent, onFinish}={}){
    this.schedule = schedule;
    this.onTick = onTick; this.onEvent = onEvent; this.onFinish = onFinish;
    this.idx = 0; this.timer = null; this.raf = null; this.startAt = 0; this.running = false;
  }
  start(){
    const A = window.Audio;
    this.startAt = A.now();
    this.running = true;
    this.timer = setInterval(()=>this._scheduleAhead(), TICK);
    this._loop();
  }
  _scheduleAhead(){
    const A = window.Audio;
    const elapsed = A.now() - this.startAt;
    while(this.idx < this.schedule.events.length &&
          this.schedule.events[this.idx].t < elapsed + LOOKAHEAD){
      const ev = this.schedule.events[this.idx];
      const when = this.startAt + ev.t;
      if(ev.kind === 'voice'){ setTimeout(()=>A.say(ev.text), Math.max(0,(when-A.now())*1000)); }
      else { A.cue(when, ev.kind); }
      if(this.onEvent) this.onEvent(ev);
      this.idx++;
    }
    if(elapsed >= this.schedule.total + 0.2){ this.stop(true); }
  }
  _loop(){
    if(!this.running) return;
    const elapsed = window.Audio.now() - this.startAt;
    if(this.onTick) this.onTick(elapsed, this.schedule);
    this.raf = requestAnimationFrame(()=>this._loop());
  }
  stop(finished=false){
    if(!this.running) return;
    this.running = false;
    clearInterval(this.timer); cancelAnimationFrame(this.raf);
    if(finished && this.onFinish) this.onFinish();
  }
}

/* stato corrente (fase/velocità/distanza) dato l'elapsed — per il display live */
function yoyoState(elapsed, sched){
  let cur = sched.stages[0];
  for(const st of sched.stages){ if(elapsed >= st.tStart) cur = st; else break; }
  const inRun = elapsed <= cur.tRunEnd;
  const phase = inRun ? 'run' : 'rec';
  const remain = inRun ? (cur.tRunEnd - elapsed) : Math.max(0, cur.tRecEnd - elapsed);
  return { phase, remain, speed:cur.speed, shuttle:cur.shuttle, dist:cur.dist, distDone: inRun ? (cur.dist-40) : cur.dist };
}
function iftState(elapsed, sched){
  let cur = sched.stages[0];
  for(const st of sched.stages){ if(elapsed >= st.tStart) cur = st; else break; }
  const inRun = elapsed <= cur.tRunEnd;
  const phase = inRun ? 'run' : 'rec';
  const remain = inRun ? (cur.tRunEnd - elapsed) : Math.max(0, cur.tRecEnd - elapsed);
  return { phase, remain, speed:cur.speed, stage:cur.stage };
}
function legerState(elapsed, sched){
  let cur = sched.levels[0];
  for(const lv of sched.levels){ if(elapsed >= lv.tStart) cur = lv; else break; }
  const remain = Math.max(0, cur.tEnd - elapsed);
  return { phase:'run', remain, speed:cur.speed, level:cur.level, dist:cur.dist };
}

window.ENGINES = {
  buildYoYo, build3015, buildLeger, buildCooper, Runner,
  yoyoState, iftState, legerState, timeFor
};
