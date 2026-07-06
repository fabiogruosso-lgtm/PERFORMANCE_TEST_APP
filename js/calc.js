/* =============================================================================
   calc.js — Calcolatori (VO2max e indici dei test)
   Ogni funzione ritorna { valore, unita, righe:[{label,valore}] } per il report.
============================================================================= */

const N = v => (Math.round(v*100)/100);

const CALC = {

  /* Yo-Yo IR1/IR2: VO2max da distanza */
  yoyo(test, {distanza}){
    const d = +distanza;
    if(!d) return null;
    const vo2 = N(d * test.vo2.a + test.vo2.b);
    return { valore:vo2, unita:'ml/kg/min', label:'VO₂max stimato',
      righe:[
        {label:'Distanza totale', valore:`${d} m`},
        {label:'Navette (×40 m)', valore:`${Math.round(d/40)}`},
        {label:'VO₂max', valore:`${vo2} ml/kg/min`}
      ], formula:test.vo2.formula };
  },

  /* 30-15 IFT: VO2max (Buchheit) da VIFT + età + peso + sesso */
  ift3015(test, {vift, eta, peso, sesso}){
    const V=+vift, A=+eta, W=+peso, G = (sesso==='F'?2:1);
    if(!V) return null;
    let righe=[{label:'VIFT', valore:`${V} km/h`}];
    let vo2=null;
    if(A && W){
      vo2 = N(28.3 - 2.15*G - 0.741*A - 0.0357*W + 0.0586*A*V + 1.03*V);
      righe.push({label:'VO₂max (Buchheit)', valore:`${vo2} ml/kg/min`});
    } else {
      righe.push({label:'VO₂max', valore:'inserisci età e peso'});
    }
    // velocità di riferimento per HIIT individualizzato
    righe.push({label:'Rif. HIIT — 95% VIFT', valore:`${N(V*0.95)} km/h`});
    righe.push({label:'Rif. HIIT — 100% VIFT', valore:`${V} km/h`});
    righe.push({label:'Rif. HIIT — 105% VIFT', valore:`${N(V*1.05)} km/h`});
    return { valore: vo2!==null?vo2:V, unita: vo2!==null?'ml/kg/min':'km/h',
      label: vo2!==null?'VO₂max stimato':'VIFT', righe, formula:test.vo2.formula };
  },

  /* Léger: VO2max da velocità ultimo livello + età */
  leger(test, {velocita, eta}){
    const V=+velocita, A=+eta;
    if(!V) return null;
    let vo2;
    if(A) vo2 = N(31.025 + 3.238*V - 3.248*A + 0.1536*A*V);
    else  vo2 = N(5.857*V - 19.458); // adulti, senza età (approssimazione)
    return { valore:vo2, unita:'ml/kg/min', label:'VO₂max stimato',
      righe:[
        {label:'Velocità ultimo livello', valore:`${V} km/h`},
        {label:'VO₂max', valore:`${vo2} ml/kg/min`}
      ], formula: A ? test.vo2.formula : 'VO₂max = 5.857·V − 19.458 (adulti, senza età)' };
  },

  /* Cooper: VO2max da distanza in 12 min */
  cooper(test, {distanza}){
    const d=+distanza;
    if(!d) return null;
    const vo2 = N((d - 504.9)/44.73);
    return { valore:vo2, unita:'ml/kg/min', label:'VO₂max stimato',
      righe:[{label:'Distanza (12 min)', valore:`${d} m`},{label:'VO₂max', valore:`${vo2} ml/kg/min`}],
      formula:test.vo2.formula };
  },

  /* Sprint 10/20/30: parziali + velocità lanciata 10→30 */
  sprint(test, splits){
    const righe=[]; const t={};
    test.splits.forEach(m=>{ if(splits[m]) t[m]=+splits[m]; });
    test.splits.forEach(m=>{ if(t[m]) righe.push({label:`${m} m`, valore:`${N(t[m])} s`}); });
    if(t[10] && t[30]){
      const vLan = N(20 / (t[30]-t[10]) * 3.6);
      righe.push({label:'Velocità lanciata 10→30 m', valore:`${vLan} km/h`});
    }
    if(t[30]) righe.push({label:'Velocità media 0→30 m', valore:`${N(30/t[30]*3.6)} km/h`});
    return { valore: t[30]||t[20]||t[10]||0, unita:'s', label:'Tempo', righe, formula:'v = spazio/tempo' };
  },

  cod505(test, splits){
    const righe=[];
    const t = splits[5] ? +splits[5] : null;
    if(t) righe.push({label:'Tempo 505', valore:`${N(t)} s`});
    if(t && splits.lin10) righe.push({label:'COD deficit', valore:`${N(t - (+splits.lin10))} s`});
    return { valore:t||0, unita:'s', label:'Tempo 505', righe, formula:'COD deficit = 505 − 10 m lineare' };
  },

  /* RSA: migliore, media, decremento % */
  rsa(test, times){
    const arr = times.filter(x=>x>0).map(Number);
    if(!arr.length) return null;
    const best = Math.min(...arr);
    const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
    const dec  = N((mean/best - 1)*100);
    return { valore:dec, unita:'%', label:'Sprint Decrement',
      righe:[
        {label:'Sprint validi', valore:`${arr.length}`},
        {label:'Tempo migliore', valore:`${N(best)} s`},
        {label:'Tempo medio', valore:`${N(mean)} s`},
        {label:'Decremento', valore:`${dec} %`}
      ], formula:'Decremento % = (medio/migliore − 1) × 100' };
  },

  /* RAST: potenza da massa, distanza, tempi; indice di fatica */
  rast(test, times, peso){
    const arr = times.filter(x=>x>0).map(Number);
    const W = +peso;
    if(!arr.length || !W) return null;
    const D = test.distance;
    const powers = arr.map(t => (W * D*D) / (t*t*t));
    const peak = Math.max(...powers), min = Math.min(...powers);
    const mean = powers.reduce((a,b)=>a+b,0)/powers.length;
    const fi = N((peak - min) / (arr.reduce((a,b)=>a+b,0)));  // W/s
    return { valore:N(peak), unita:'W', label:'Potenza di picco',
      righe:[
        {label:'Potenza picco', valore:`${N(peak)} W`},
        {label:'Potenza media', valore:`${N(mean)} W`},
        {label:'Potenza minima', valore:`${N(min)} W`},
        {label:'Indice di fatica', valore:`${fi} W/s`}
      ], formula:'Potenza = (massa × distanza²) / tempo³' };
  },

  /* CMJ: potenza di picco (Sayers) se c'è il peso */
  cmj(test, {altezza, peso}){
    const h=+altezza, W=+peso;
    if(!h) return null;
    const righe=[{label:'Altezza salto', valore:`${N(h)} cm`}];
    let val=h, unita='cm', label='Altezza CMJ';
    if(W){
      const P = N(60.7*h + 45.3*W - 2055); // Sayers 1999 (h in cm, W in kg)
      righe.push({label:'Potenza di picco (Sayers)', valore:`${P} W`});
      val=P; unita='W'; label='Potenza di picco';
    }
    return { valore:val, unita, label, righe, formula:'Potenza(W) = 60.7·h(cm) + 45.3·peso − 2055' };
  },

  eur(test, {cmj, sj}){
    const c=+cmj, s=+sj;
    if(!c||!s) return null;
    const eur=N(c/s);
    return { valore:eur, unita:'', label:'EUR (CMJ/SJ)',
      righe:[
        {label:'CMJ', valore:`${N(c)} cm`},
        {label:'Squat Jump', valore:`${N(s)} cm`},
        {label:'EUR', valore:`${eur}`},
        {label:'Interpretazione', valore: eur>=1 ? 'buono sfruttamento elastico' : 'da migliorare (pliometria)'}
      ], formula:'EUR = CMJ / SJ (atteso ≥ 1,0)' };
  },

  broad(test, {distanza}){
    const d=+distanza;
    if(!d) return null;
    return { valore:N(d), unita:'cm', label:'Salto in lungo',
      righe:[{label:'Distanza', valore:`${N(d)} cm`}], formula:'—' };
  },

  onerm(test, {carico, reps, peso}){
    const w=+carico, r=+reps;
    if(!w||!r) return null;
    const brzycki = N(w * 36 / (37 - r));
    const epley   = N(w * (1 + r/30));
    const media   = N((brzycki+epley)/2);
    const righe=[
      {label:'Carico × ripetizioni', valore:`${w} kg × ${r}`},
      {label:'1RM Brzycki', valore:`${brzycki} kg`},
      {label:'1RM Epley', valore:`${epley} kg`},
      {label:'1RM medio', valore:`${media} kg`}
    ];
    if(+peso) righe.push({label:'Rapporto forza/peso', valore:`${N(media/(+peso))}`});
    return { valore:media, unita:'kg', label:'1RM stimato', righe,
      formula:'Brzycki = w·36/(37−rip) · Epley = w·(1+rip/30)' };
  },

  /* Plicometria 3 pliche — Jackson-Pollock + Siri */
  pliche(test, {sesso, eta, p1, p2, p3}){
    const A=+eta, S=(+p1)+(+p2)+(+p3);
    if(!A || !S) return null;
    let densita;
    if(sesso==='F'){
      densita = 1.0994921 - 0.0009929*S + 0.0000023*S*S - 0.0001392*A; // JP donne
    } else {
      densita = 1.10938 - 0.0008267*S + 0.0000016*S*S - 0.0002574*A;   // JP uomini
    }
    const grasso = N((4.95/densita - 4.50)*100); // Siri
    return { valore:grasso, unita:'%', label:'Massa grassa',
      righe:[
        {label:'Somma 3 pliche', valore:`${N(S)} mm`},
        {label:'Densità corporea', valore:`${N(densita*1000)/1000}`},
        {label:'% Massa grassa (Siri)', valore:`${grasso} %`}
      ], formula:'Jackson-Pollock 3 siti → densità → Siri' };
  }
};

/* mappa test → funzione calcolo */
function runCalc(test, values){
  switch(test.id){
    case 'yoyo_ir1':
    case 'yoyo_ir2': return CALC.yoyo(test, values);
    case 'ift3015':  return CALC.ift3015(test, values);
    case 'leger':    return CALC.leger(test, values);
    case 'cooper':   return CALC.cooper(test, values);
    case 'sprint':   return CALC.sprint(test, values);
    case 'cod505':   return CALC.cod505(test, values);
    case 'rsa':      return CALC.rsa(test, values.times);
    case 'rast':     return CALC.rast(test, values.times, values.peso);
    case 'cmj':      return CALC.cmj(test, values);
    case 'eur':      return CALC.eur(test, values);
    case 'broad':    return CALC.broad(test, values);
    case 'onerm':    return CALC.onerm(test, values);
    case 'pliche':   return CALC.pliche(test, values);
    default: return null;
  }
}

window.CALC = { runCalc };
