/* =============================================================================
   calc.js — Calcolatori (VO2max e indici dei test)
   Ogni funzione ritorna { valore, unita, righe:[{label,valore}] } per il report.

   rev. 2 (1/10/2026) — BONIFICA, allineata alla piattaforma (Performance
   Soccer Lab, core/equazioni_campo.py):
   - il VALORE principale e' sempre la MISURA (distanza, velocita', altezza,
     carico, somma delle pliche); le stime stanno nelle righe;
   - ogni stima si calcola solo nella popolazione su cui e' nata (eta' in
     anni compiuti, scritta per QUESTO atleta: l'app non la ricorda piu');
     fuori, la riga «Stima» dice perche' non c'e';
   - Beep test: tolta la formula 5,857·V − 19,458 (non e' nell'articolo di
     Léger); adulti 18-50 con l'equazione (3) di Léger et al. 1988, letta per
     intero: −27,4 + 6,0·V (nell'articolo stampato −24,4 per refuso);
   - 1RM: solo sotto le 10 ripetizioni (Brzycki 1993, letto).
   rev. 1 — prima versione.
============================================================================= */

const N = v => (Math.round(v*100)/100);

const MAGGIORE_ETA = 18;
const ETA_3015 = [12, 20];             // Buchheit 2008: 16,2 ± 2,3 anni (media ± 2 DS)
const ETA_LEGER_RAGAZZI = [6, 17];     // Léger 1988: eq. (1), validata 8-19 anni
const ETA_LEGER_ADULTI = [18, 50];     // Léger 1988: eq. (3), validata 18-50 anni
const ETA_JP3 = { M:[18, 61], F:[18, 55] };  // Jackson-Pollock 1978 / 1980

const POPOLAZIONE = {
  yoyo:   'Bangsbo et al. 2008: equazione ricavata su soggetti di cui l\u2019articolo non dà età e sesso; gli autori la dicono «non accurata». Si calcola dai 18 anni: la misura vera è la distanza.',
  ift3015:'Buchheit 2008: 59 giovani giocatori di 16,2 ± 2,3 anni; tende a sovrastimare. Si calcola fra 12 e 20 anni.',
  leger:  'Léger et al. 1988: 6-17 anni equazione con l\u2019età (validata su 188 ragazzi di 8-19 anni); 18-50 anni −27,4 + 6,0·V (77 adulti). Fuori da queste età nessuna stima.',
  cooper: 'Cooper 1968: 115 militari adulti. Si calcola dai 18 anni.',
  sayers: 'Sayers et al. 1999: 108 giovani adulti. Si calcola dai 18 anni, con il peso.',
  onerm:  'Brzycki 1993: formula senza un campione dichiarato, valida solo sotto le 10 ripetizioni; Epley 1985 non letto. Si stima dai 18 anni e sotto le 10 ripetizioni; altrimenti si registrano carico e ripetizioni.',
  pliche: 'Jackson-Pollock: uomini 18-61, donne 18-55 anni, con Siri 1961. Fuori da queste età solo la somma delle pliche.'
};

/* Età in anni compiuti come l'ha scritta l'operatore: vuota = non nota. */
function etaDi(v){
  if(v===undefined || v===null || String(v).trim()==='') return null;
  const a = Math.floor(+String(v).replace(',', '.'));
  return Number.isFinite(a) && a>=0 && a<100 ? a : null;
}
function num(v){
  if(v===undefined || v===null || String(v).trim()==='') return null;
  const x = +String(v).replace(',', '.');
  return Number.isFinite(x) && x>0 ? x : null;
}
function dentro(eta, [lo, hi]){ return eta!==null && eta>=lo && eta<=hi; }
function adulto(eta){ return eta!==null && eta>=MAGGIORE_ETA; }
/* La riga che spiega una stima mancante. L'etichetta «Stima» non e' fra
   quelle che la piattaforma importa: nessun numero di questa riga diventa
   un dato. */
function rigaNoStima(cosa, eta, extra){
  const perche = eta===null ? 'età non indicata'
               : (extra || `${eta} anni, fuori dalla popolazione dell\u2019equazione`);
  return {label:'Stima', valore:`${cosa} non calcolato: ${perche}`};
}

const CALC = {

  /* Yo-Yo IR1/IR2: la misura e' la distanza; VO2max solo dai 18 anni */
  yoyo(test, {distanza, eta}){
    const d = num(distanza); const A = etaDi(eta);
    if(!d) return null;
    const righe = [
      {label:'Distanza totale', valore:`${d} m`},
      {label:'Navette (×40 m)', valore:`${Math.round(d/40)}`}
    ];
    let vo2 = null;
    if(adulto(A)){
      vo2 = N(d * test.vo2.a + test.vo2.b);
      righe.push({label:'VO₂max', valore:`${vo2} ml/kg/min`});
    } else righe.push(rigaNoStima('VO₂max', A));
    righe.push({label:'Popolazione', valore:POPOLAZIONE.yoyo});
    return { valore:d, unita:'m', label:'Distanza totale', righe, formula:test.vo2.formula,
             eta:A, vo2 };
  },

  /* 30-15 IFT: la misura e' la VIFT; VO2max (Buchheit) solo fra 12 e 20 anni */
  ift3015(test, {vift, eta, peso, sesso}){
    const V=num(vift), A=etaDi(eta), W=num(peso);
    if(!V) return null;
    const righe=[{label:'VIFT', valore:`${V} km/h`}];
    let vo2=null;
    if(!(sesso==='M'||sesso==='F')) righe.push(rigaNoStima('VO₂max', A, 'sesso non indicato'));
    else if(!W) righe.push(rigaNoStima('VO₂max', A, 'peso non indicato'));
    else if(dentro(A, ETA_3015)){
      const G = (sesso==='F'?2:1);
      vo2 = N(28.3 - 2.15*G - 0.741*A - 0.0357*W + 0.0586*A*V + 1.03*V);
      righe.push({label:'VO₂max (Buchheit)', valore:`${vo2} ml/kg/min`});
    } else righe.push(rigaNoStima('VO₂max', A));
    // velocità di riferimento per HIIT individualizzato (valgono a ogni età)
    righe.push({label:'Rif. HIIT — 95% VIFT', valore:`${N(V*0.95)} km/h`});
    righe.push({label:'Rif. HIIT — 100% VIFT', valore:`${V} km/h`});
    righe.push({label:'Rif. HIIT — 105% VIFT', valore:`${N(V*1.05)} km/h`});
    righe.push({label:'Popolazione', valore:POPOLAZIONE.ift3015});
    return { valore:V, unita:'km/h', label:'VIFT', righe, formula:test.vo2.formula, eta:A, vo2 };
  },

  /* Léger: la misura e' la velocita' dell'ultimo livello; VO2max per eta' */
  leger(test, {velocita, eta}){
    const V=num(velocita), A=etaDi(eta);
    if(!V) return null;
    const righe=[{label:'Velocità ultimo livello', valore:`${V} km/h`}];
    let vo2=null, formula=test.vo2.formula;
    if(dentro(A, ETA_LEGER_RAGAZZI)){
      vo2 = N(31.025 + 3.238*V - 3.248*A + 0.1536*A*V);
      formula = 'VO₂max = 31.025 + 3.238·V − 3.248·età + 0.1536·età·V (Léger 1988, 6-17 anni)';
    } else if(dentro(A, ETA_LEGER_ADULTI)){
      vo2 = N(-27.4 + 6.0*V);
      formula = 'VO₂max = −27,4 + 6,0·V (Léger 1988, eq. 3, dai 18 anni; nell\u2019articolo stampato −24,4 per refuso)';
    }
    righe.push(vo2!==null ? {label:'VO₂max', valore:`${vo2} ml/kg/min`}
                          : rigaNoStima('VO₂max', A, A!==null ? `${A} anni, fuori dalle età dell\u2019equazione (6-17 e 18-50)` : null));
    righe.push({label:'Popolazione', valore:POPOLAZIONE.leger});
    return { valore:V, unita:'km/h', label:'Velocità ultimo livello', righe, formula, eta:A, vo2 };
  },

  /* Cooper: la misura e' la distanza; VO2max solo dai 18 anni */
  cooper(test, {distanza, eta}){
    const d=num(distanza), A=etaDi(eta);
    if(!d) return null;
    const righe=[{label:'Distanza (12 min)', valore:`${d} m`}];
    let vo2=null;
    if(adulto(A)){ vo2 = N((d - 504.9)/44.73); righe.push({label:'VO₂max', valore:`${vo2} ml/kg/min`}); }
    else righe.push(rigaNoStima('VO₂max', A));
    righe.push({label:'Popolazione', valore:POPOLAZIONE.cooper});
    return { valore:d, unita:'m', label:'Distanza (12 min)', righe, formula:test.vo2.formula, eta:A, vo2 };
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

  /* CMJ: la misura e' l'altezza; potenza (Sayers) dai 18 anni e col peso */
  cmj(test, {altezza, peso, eta}){
    const h=num(altezza), W=num(peso), A=etaDi(eta);
    if(!h) return null;
    const righe=[{label:'Altezza salto', valore:`${N(h)} cm`}];
    if(!adulto(A)) righe.push(rigaNoStima('Potenza', A));
    else if(!W) righe.push(rigaNoStima('Potenza', A, 'peso non indicato'));
    else {
      const P = N(60.7*h + 45.3*W - 2055); // Sayers 1999 (h in cm, W in kg)
      righe.push({label:'Potenza di picco (Sayers)', valore:`${P} W`});
    }
    righe.push({label:'Popolazione', valore:POPOLAZIONE.sayers});
    return { valore:N(h), unita:'cm', label:'Altezza CMJ', righe,
             formula:'Potenza(W) = 60.7·h(cm) + 45.3·peso − 2055', eta:A };
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
        {label:'Lettura', valore: eur>1 ? 'il contromovimento aggiunge altezza'
                                        : 'il contromovimento non aggiunge altezza: rivedere tecnica o componente elastica'}
      ], formula:'EUR = CMJ / SJ' };
  },

  broad(test, {distanza}){
    const d=+distanza;
    if(!d) return null;
    return { valore:N(d), unita:'cm', label:'Salto in lungo',
      righe:[{label:'Distanza', valore:`${N(d)} cm`}], formula:'—' };
  },

  /* 1RM: la misura e' carico × ripetizioni; il massimale stimato dai 18 anni */
  onerm(test, {carico, reps, peso, eta}){
    const w=num(carico), r=num(reps), A=etaDi(eta);
    if(!w||!r) return null;
    const rip = Math.round(r);
    const righe=[
      {label:'Carico', valore:`${w} kg`},
      {label:'Ripetizioni', valore:`${rip}`}
    ];
    let media=null;
    if(adulto(A) && rip<10){   // Brzycki 1993: valida solo sotto le 10 ripetizioni
      const brzycki = N(w * 36 / (37 - rip));
      const epley   = N(w * (1 + rip/30));
      media = N((brzycki+epley)/2);
      righe.push({label:'1RM Brzycki', valore:`${brzycki} kg`},
                 {label:'1RM Epley', valore:`${epley} kg`},
                 {label:'1RM medio', valore:`${media} kg`});
      if(num(peso)) righe.push({label:'Rapporto forza/peso', valore:`${N(media/num(peso))}`});
    } else righe.push(rigaNoStima('Massimale', A, adulto(A) ? `${rip} ripetizioni: la formula vale sotto le 10` : null));
    righe.push({label:'Popolazione', valore:POPOLAZIONE.onerm});
    return media!==null
      ? { valore:media, unita:'kg', label:'1RM stimato', righe,
          formula:'Brzycki = w·36/(37−rip) · Epley = w·(1+rip/30)', eta:A }
      : { valore:w, unita:'kg', label:`Carico × ${rip} ripetizioni`, righe,
          formula:'Brzycki = w·36/(37−rip) · Epley = w·(1+rip/30)', eta:A };
  },

  /* Plicometria 3 pliche — la misura e' la somma; % grasso (JP + Siri) nelle eta' dell'equazione */
  pliche(test, {sesso, eta, p1, p2, p3}){
    const A=etaDi(eta), P=[num(p1), num(p2), num(p3)];
    if(P.some(x=>x===null)) return null;
    const S=P[0]+P[1]+P[2];
    const righe=[{label:'Somma 3 pliche', valore:`${N(S)} mm`}];
    let grasso=null;
    if(!(sesso==='M'||sesso==='F')) righe.push(rigaNoStima('% di grasso', A, 'sesso non indicato'));
    else if(dentro(A, ETA_JP3[sesso])){
      const densita = sesso==='F'
        ? 1.0994921 - 0.0009929*S + 0.0000023*S*S - 0.0001392*A   // JP donne
        : 1.10938 - 0.0008267*S + 0.0000016*S*S - 0.0002574*A;    // JP uomini
      grasso = N((4.95/densita - 4.50)*100); // Siri
      righe.push({label:'Densità corporea', valore:`${N(densita*1000)/1000}`},
                 {label:'% Massa grassa (Siri)', valore:`${grasso} %`});
    } else righe.push(rigaNoStima('% di grasso', A));
    righe.push({label:'Popolazione', valore:POPOLAZIONE.pliche});
    return grasso!==null
      ? { valore:grasso, unita:'%', label:'Massa grassa', righe, formula:'Jackson-Pollock 3 siti → densità → Siri', eta:A }
      : { valore:N(S), unita:'mm', label:'Somma 3 pliche', righe, formula:'Jackson-Pollock 3 siti → densità → Siri', eta:A };
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

/* IMPORTANTE (scope condiviso del browser): "CALC" usato da app.js si risolve
   sulla const qui sopra, quindi runCalc va agganciato a QUELLA, non a un
   oggetto nuovo su window (causava: CALC.runCalc is not a function). */
CALC.runCalc = runCalc;
CALC.POPOLAZIONE = POPOLAZIONE;
CALC.adulto = adulto;
CALC.etaDi = etaDi;
window.CALC = CALC;
