/* tests/calc.test.js — rev. 1 (1/10/2026: NUOVO — prova dei calcolatori
   dopo la bonifica: stime solo nella popolazione dell'equazione, misura come
   valore principale, nessun numero nelle righe «Stima»).
   Si esegue con:  node tests/calc.test.js   (nessuna dipendenza) */
global.window = {};
require('../js/calc.js');
const C = window.CALC;
let ok = 0, ko = 0;
function prova(nome, cond, det){ if(cond){ ok++; console.log('  [OK  ] '+nome); }
  else { ko++; console.log('  [FALLITO] '+nome+(det?' — '+JSON.stringify(det):'')); } }
const riga = (r, l) => (r.righe.find(x=>x.label===l)||{}).valore;
const T = id => ({ id, vo2: id==='yoyo_ir1' ? {a:0.0084, b:36.4, formula:'f'} : id==='yoyo_ir2' ? {a:0.0136, b:45.3, formula:'f'} : {formula:'f'} });

// Yo-Yo
let r = C.yoyo(T('yoyo_ir1'), {distanza:'2000', eta:''});
prova('Yo-Yo senza età: valore = distanza, niente VO2', r.valore===2000 && r.unita==='m' && !riga(r,'VO₂max'), r);
prova('...la riga «Stima» spiega perché', /età non indicata/.test(riga(r,'Stima')));
r = C.yoyo(T('yoyo_ir1'), {distanza:'2000', eta:'15'});
prova('Yo-Yo 15 anni: niente VO2', !riga(r,'VO₂max') && /15 anni/.test(riga(r,'Stima')));
r = C.yoyo(T('yoyo_ir1'), {distanza:'2000', eta:'26'});
prova('Yo-Yo adulto: VO2 = 2000·0,0084 + 36,4', riga(r,'VO₂max')==='53.2 ml/kg/min', r);
prova('Yo-Yo senza distanza: nessun risultato', C.yoyo(T('yoyo_ir1'), {distanza:'', eta:'26'})===null);

// 30-15
r = C.ift3015(T('ift3015'), {vift:'19', eta:'16', peso:'65', sesso:'M'});
prova('30-15, 16 anni: Buchheit', riga(r,'VO₂max (Buchheit)')!==undefined && r.valore===19 && r.unita==='km/h');
r = C.ift3015(T('ift3015'), {vift:'19', eta:'26', peso:'75', sesso:'M'});
prova('30-15, 26 anni: fuori campione, niente stima', !riga(r,'VO₂max (Buchheit)'));
r = C.ift3015(T('ift3015'), {vift:'19', eta:'16', peso:'65', sesso:''});
prova('30-15 senza sesso: niente stima', !riga(r,'VO₂max (Buchheit)') && /sesso/.test(riga(r,'Stima')));

// Léger
r = C.leger(T('leger'), {velocita:'12.5', eta:'14'});
prova('Léger 14 anni: equazione (1)', riga(r,'VO₂max')===`${Math.round((31.025+3.238*12.5-3.248*14+0.1536*14*12.5)*100)/100} ml/kg/min`, r);
r = C.leger(T('leger'), {velocita:'12.5', eta:'30'});
prova('Léger 30 anni: −27,4 + 6,0·V', riga(r,'VO₂max')==='47.6 ml/kg/min', r);
r = C.leger(T('leger'), {velocita:'12.5', eta:''});
prova('Léger senza età: niente stima (via la 5,857·V − 19,458)', !riga(r,'VO₂max') && r.valore===12.5 && r.unita==='km/h');
r = C.leger(T('leger'), {velocita:'12.5', eta:'55'});
prova('Léger 55 anni: fuori dalle età dell\'equazione', !riga(r,'VO₂max'));

// Cooper
prova('Cooper 15 anni: solo distanza', !riga(C.cooper(T('cooper'), {distanza:'2800', eta:'15'}),'VO₂max'));
prova('Cooper adulto: stima', riga(C.cooper(T('cooper'), {distanza:'3000', eta:'30'}),'VO₂max')==='55.78 ml/kg/min');

// CMJ
r = C.cmj(T('cmj'), {altezza:'30', peso:'45', eta:'15'});
prova('CMJ ragazzo: altezza sì, potenza no', r.valore===30 && r.unita==='cm' && !riga(r,'Potenza di picco (Sayers)'));
r = C.cmj(T('cmj'), {altezza:'40', peso:'80', eta:'25'});
prova('CMJ adulto con peso: Sayers', riga(r,'Potenza di picco (Sayers)')===`${60.7*40+45.3*80-2055} W` && r.unita==='cm', r);

// 1RM
r = C.onerm(T('onerm'), {carico:'60', reps:'6', eta:'16'});
prova('1RM ragazzo: carico e ripetizioni, nessun massimale', r.label.startsWith('Carico') && !riga(r,'1RM medio') && riga(r,'Carico')==='60 kg' && riga(r,'Ripetizioni')==='6');
r = C.onerm(T('onerm'), {carico:'100', reps:'5', eta:'30'});
prova('1RM adulto: massimale stimato', r.label==='1RM stimato' && riga(r,'1RM medio')!==undefined);

r = C.onerm(T('onerm'), {carico:'80', reps:'10', eta:'30'});
prova('1RM adulto con 10 ripetizioni: nessuna stima (Brzycki: sotto le 10)', !riga(r,'1RM medio') && /sotto le 10/.test(riga(r,'Stima')));

// Pliche
r = C.pliche(T('pliche'), {sesso:'M', eta:'15', p1:'6', p2:'8', p3:'10'});
prova('Pliche ragazzo: solo somma', r.unita==='mm' && r.valore===24 && !riga(r,'% Massa grassa (Siri)'));
r = C.pliche(T('pliche'), {sesso:'', eta:'30', p1:'6', p2:'8', p3:'10'});
prova('Pliche senza sesso: solo somma', r.unita==='mm' && /sesso/.test(riga(r,'Stima')));
r = C.pliche(T('pliche'), {sesso:'F', eta:'30', p1:'16', p2:'14', p3:'22'});
prova('Pliche donna 30 anni: % grasso', r.unita==='%' && riga(r,'% Massa grassa (Siri)')!==undefined);
prova('Pliche: una plica mancante = nessun risultato', C.pliche(T('pliche'), {sesso:'M', eta:'30', p1:'6', p2:'', p3:'10'})===null);

// Nessuna riga «Stima» con un'etichetta che la piattaforma importa
const tutte = [C.yoyo(T('yoyo_ir1'),{distanza:'1000',eta:'10'}), C.leger(T('leger'),{velocita:'10',eta:''}),
  C.cmj(T('cmj'),{altezza:'20',eta:'12'}), C.onerm(T('onerm'),{carico:'40',reps:'5',eta:'14'})];
prova('le righe di spiegazione si chiamano solo «Stima» e «Popolazione»',
  tutte.every(x=>x.righe.filter(y=>/non calcolat/.test(y.valore)).every(y=>y.label==='Stima')));

console.log(`\n  ${ok} prove superate su ${ok+ko}`);
process.exit(ko ? 1 : 0);
