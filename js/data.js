/* =============================================================================
   data.js  —  Dati dei protocolli e istruzioni dei test da campo
   Fonti scientifiche:
   - Yo-Yo IR1 / IR2: Bangsbo J., Iaia F.M., Krustrup P. (2008), Sports Med 38(1):37-51
   - 30-15 IFT: Buchheit M. (2008), J Strength Cond Res
   - Léger 20m MSFT: Léger L.A. et al. (1988), J Sports Sci 6(2):93-101
   - Cooper (1968); Jackson-Pollock (1978); Brzycki/Epley; Sayers (1999)
   Tutte le tracce audio sono GENERATE dall'app (Web Audio) a partire dai dati
   di velocità dei protocolli: nessun file audio protetto da copyright viene usato.
============================================================================= */

/* --- Run-Length Encoding delle velocità (km/h) per navetta ------------------
   Ogni voce [velocita, numeroNavette]. Una navetta Yo-Yo = 2x20 m = 40 m.     */
const YOYO_IR1_RLE = [
  [10.0,1],[11.5,1],[13.0,2],[13.5,3],[14.0,4],
  [14.5,8],[15.0,8],[15.5,8],[16.0,8],[16.5,8],
  [17.0,8],[17.5,8],[18.0,8],[18.5,8],[19.0,8]
];
const YOYO_IR2_RLE = [
  [13.0,1],[15.0,1],[16.0,2],[16.5,3],[17.0,4],
  [17.5,8],[18.0,8],[18.5,8],[19.0,8],[19.5,8],
  [20.0,8],[20.5,8],[21.0,8],[21.5,8],[22.0,8]
];

function rleExpand(rle){
  const out=[];
  rle.forEach(([spd,n])=>{ for(let i=0;i<n;i++) out.push(spd); });
  return out; // array velocita per navetta (index 0 = navetta 1)
}

/* --- Catalogo test ----------------------------------------------------------
   type: 'beep'  = test a navette con audio (Yo-Yo, Léger)
         'intermittent' = 30-15 IFT (30s corsa / 15s recupero)
         'timer' = Cooper (conto alla rovescia)
         'repeated' = RSA / RAST (sprint ripetuti con recupero)
         'stopwatch' = sprint lineari / 505 (starter + split manuali)
         'input'  = test con solo inserimento dati + calcolo                    */
const TESTS = [
  {
    id:'yoyo_ir1', nome:'Yo-Yo IR1', gruppo:'Resistenza intermittente',
    icon:'🫀', type:'beep', color:'run',
    sottotitolo:'Recupero livello 1 · 2×20 m · rec 10 s',
    misura:'Capacità aerobica intermittente specifica per il calcio; stima il VO₂max.',
    setup:'Due linee a 20 m. Un cono per il recupero 5 m dietro la linea di partenza. Superficie piana e non scivolosa.',
    esecuzione:[
      'Al beep si parte e si corre verso la linea a 20 m.',
      'Al beep successivo si deve aver toccato la linea: si gira e si torna.',
      'Dopo ogni navetta (40 m) ci sono 10 s di recupero attivo: jog fino al cono a 5 m e ritorno.',
      'La velocità parte da 10 km/h e cresce a gradini (doppio beep = cambio velocità).',
      'Primo mancato arrivo in tempo = avvertimento; al secondo il test finisce.'
    ],
    registra:'Distanza totale (m) = navette completate × 40.',
    note:'Riscaldamento 10-15 min. Eseguire a riposo. Utile anche per monitorare la fatica nel tempo.',
    speeds: rleExpand(YOYO_IR1_RLE), shuttleDist:40, recovery:10,
    vo2:{ formula:'VO₂max = distanza(m) × 0.0084 + 36.4', a:0.0084, b:36.4, needs:['distanza'] }
  },
  {
    id:'yoyo_ir2', nome:'Yo-Yo IR2', gruppo:'Resistenza intermittente',
    icon:'🫀', type:'beep', color:'run',
    sottotitolo:'Recupero livello 2 · 2×20 m · rec 10 s',
    misura:'Come IR1 ma più intenso: stressa di più la componente anaerobica. Per atleti evoluti.',
    setup:'Identico all\u2019IR1 (due linee a 20 m, cono di recupero a 5 m).',
    esecuzione:[
      'Stessa meccanica dell\u2019IR1: navette 2×20 m con 10 s di recupero.',
      'Velocità di partenza più alta (13 km/h) e incrementi più rapidi.',
      'Il test è più breve e più duro dell\u2019IR1.',
      'Al secondo mancato arrivo in tempo il test finisce.'
    ],
    registra:'Distanza totale (m) = navette completate × 40.',
    note:'Solo con atleti già allenati. Per i meno allenati usare l\u2019IR1.',
    speeds: rleExpand(YOYO_IR2_RLE), shuttleDist:40, recovery:10,
    vo2:{ formula:'VO₂max = distanza(m) × 0.0136 + 45.3', a:0.0136, b:45.3, needs:['distanza'] }
  },
  {
    id:'ift3015', nome:'30-15 IFT', gruppo:'Resistenza intermittente',
    icon:'⏱️', type:'intermittent', color:'run',
    sottotitolo:'40 m · 30 s corsa / 15 s recupero · +0,5 km/h',
    misura:'La VIFT (velocità dell\u2019ultimo stadio): dato chiave per individualizzare l\u2019HIIT. Stima il VO₂max.',
    setup:'Tre linee: A(0 m) – B(20 m) – C(40 m). Zone di tolleranza di 3 m attorno ad ogni linea. Coni a 3 m prima di A e C e ai due lati di B.',
    esecuzione:[
      'Al primo beep si parte da A verso B.',
      'Regola il ritmo per essere sulla linea B (20 m) al beep, su C (40 m) al beep successivo, poi gira.',
      'Corri per 30 s: il doppio beep segnala la fine dello stadio.',
      'Segue un recupero PASSIVO di 15 s: cammina in avanti fino alla linea/zona più vicina, da lì riparte lo stadio dopo.',
      'Velocità: 8 km/h al primo stadio, +0,5 km/h ad ogni stadio.',
      'Il test finisce quando non raggiungi la zona di 3 m al beep per 3 volte consecutive, o ti fermi.'
    ],
    registra:'VIFT = velocità (km/h) dell\u2019ultimo stadio completato.',
    note:'È il test migliore per programmare l\u2019HIIT su misura. Serve familiarizzazione: la prima volta molti sbagliano il ritmo.',
    startSpeed:8.0, speedStep:0.5, runSec:30, recSec:15, segMeters:20, maxStages:30,
    vo2:{ formula:'VO₂max = 28.3 − 2.15·G − 0.741·età − 0.0357·peso + 0.0586·età·VIFT + 1.03·VIFT (Buchheit)',
          needs:['vift','eta','peso','sesso'] }
  },
  {
    id:'leger', nome:'Beep Test (Léger)', gruppo:'Resistenza aerobica',
    icon:'🔁', type:'beep', color:'run',
    sottotitolo:'20 m multistadio · senza recupero · +0,5 km/h/min',
    misura:'VO₂max / potenza aerobica massimale.',
    setup:'Due linee a 20 m. Coni A e B. Nessuna zona di recupero.',
    esecuzione:[
      'Corsa navetta continua tra due linee a 20 m, SENZA recupero.',
      'Devi toccare la linea opposta prima/al beep.',
      'Si parte a 8,5 km/h; ogni livello (~1 min) la velocità sale di 0,5 km/h (triplo beep = nuovo livello).',
      'Il test finisce se non raggiungi la linea in tempo per due navette consecutive.'
    ],
    registra:'Ultimo livello raggiunto (e velocità km/h). Distanza = navette × 20.',
    note:'Essendo continuo (senza recupero) è meno calcio-specifico dello Yo-Yo, ma semplice ed economico.',
    startSpeed:8.5, speedStep:0.5, levelSec:60, shuttleDist:20, maxLevels:21,
    vo2:{ formula:'VO₂max = 31.025 + 3.238·V − 3.248·età + 0.1536·età·V (Léger, V=km/h ultimo livello)',
          needs:['velocita','eta'] }
  },
  {
    id:'cooper', nome:'Cooper 12 min', gruppo:'Resistenza aerobica',
    icon:'🏃', type:'timer', color:'run',
    sottotitolo:'Massima distanza in 12 minuti',
    misura:'Capacità aerobica / VO₂max.',
    setup:'Pista da 400 m (ideale) o percorso con distanze segnate ogni 50-100 m.',
    esecuzione:[
      'Percorri la maggiore distanza possibile in 12 minuti.',
      'Ritmo costante e autogestito: non partire troppo forte.',
      'L\u2019app avvisa a metà tempo, all\u2019ultimo minuto, agli ultimi 30 s e allo stop.',
      'Allo stop misura la distanza totale percorsa.'
    ],
    registra:'Distanza (m) percorsa in 12 minuti.',
    note:'Serve esperienza di pacing; molto sensibile alla motivazione.',
    durationSec:720,
    vo2:{ formula:'VO₂max = (distanza(m) − 504.9) / 44.73', needs:['distanza'] }
  },
  {
    id:'sprint', nome:'Sprint 10/20/30 m', gruppo:'Velocità e potenza',
    icon:'⚡', type:'stopwatch', color:'run',
    sottotitolo:'Accelerazione e velocità massima',
    misura:'Accelerazione (10 m) e velocità massima (20-30 m).',
    setup:'Coni a 10, 20 e 30 m. Idealmente fotocellule/Optojump; con l\u2019app usi lo starter audio e i tempi manuali.',
    esecuzione:[
      'Partenza da fermo, piedi sfalsati, senza dondolio iniziale.',
      'Sprint massimale oltre i 30 m.',
      'Con l\u2019app: premi Via (starter audio), poi tocca il pulsante ad ogni cono (10/20/30 m) per registrare i parziali.',
      '2-3 prove con recupero completo (2-3 min): si tiene la migliore.'
    ],
    registra:'Tempi (s) ai parziali 10/20/30 m. Il tratto 10→30 stima la velocità lanciata.',
    note:'Il cronometro manuale è meno preciso delle fotocellule: fai la media di più prove.',
    splits:[10,20,30]
  },
  {
    id:'cod505', nome:'505 Cambio di direzione', gruppo:'Velocità e potenza',
    icon:'🔄', type:'stopwatch', color:'run',
    sottotitolo:'Virata a 180° e ripartenza',
    misura:'Capacità di cambiare direzione a 180° e ripartire.',
    setup:'Rincorsa di 10 m + fotocellula (o start manuale) a 5 m dalla linea di virata.',
    esecuzione:[
      'Parti 10 m prima della fotocellula (15 m dalla linea di virata) e accelera.',
      'Il tempo parte quando superi il punto a 5 m dalla virata.',
      'Tocca la linea con il piede, ruota 180° e torna per 5 m.',
      'Stop al ripasso del punto a 5 m. Esegui su piede destro e sinistro.'
    ],
    registra:'Tempo 505 (s). COD deficit = 505 − tempo 10 m lineare.',
    note:'Misura entrambi i lati per scoprire asimmetrie tra le gambe.',
    splits:[5]
  },
  {
    id:'rsa', nome:'RSA — Sprint ripetuti', gruppo:'Velocità e potenza',
    icon:'🔁', type:'repeated', color:'run',
    sottotitolo:'Es. 6×40 m · recupero 20-25 s',
    misura:'Resistenza alla velocità: ripetere sprint mantenendo la prestazione.',
    setup:'Coni sul tracciato (es. 40 m o 30 m). Fotocellule o cronometro.',
    esecuzione:[
      'Serie di sprint massimali (es. 6×40 m).',
      'Recupero breve e incompleto (20-25 s), spesso tornando camminando.',
      'L\u2019app dà lo start di ogni sprint e il conto alla rovescia del recupero; inserisci il tempo di ogni sprint.'
    ],
    registra:'Tempo migliore, medio e Sprint Decrement % = (medio/migliore − 1) × 100.',
    note:'Serve massima motivazione su ogni ripetizione.',
    reps:6, restSec:22
  },
  {
    id:'rast', nome:'RAST — Potenza anaerobica', gruppo:'Velocità e potenza',
    icon:'💥', type:'repeated', color:'run',
    sottotitolo:'6×35 m · recupero 10 s',
    misura:'Potenza anaerobica e affaticamento (analogo di corsa del Wingate).',
    setup:'Tracciato di 35 m, coni, bilancia per il peso corporeo.',
    esecuzione:[
      '6 sprint massimali da 35 m.',
      '10 s di recupero tra uno sprint e il successivo (rispettali con precisione).',
      'L\u2019app scandisce start e recupero; inserisci i 6 tempi e il peso.'
    ],
    registra:'Potenza di picco / media / minima e indice di fatica. Potenza = (massa × dist²) / tempo³.',
    note:'Riscaldamento completo: è massimale e molto affaticante.',
    reps:6, restSec:10, distance:35
  },
  {
    id:'cmj', nome:'CMJ', gruppo:'Salti e forza',
    icon:'🦵', type:'input', color:'run',
    sottotitolo:'Countermovement Jump',
    misura:'Potenza ed esplosività degli arti inferiori; freschezza neuromuscolare.',
    setup:'Tappetino a contatto, Optojump o app My Jump 2. Mani sui fianchi.',
    esecuzione:[
      'In piedi, mani sui fianchi per tutta l\u2019esecuzione.',
      'Rapido contromovimento (ginocchia ~90°) seguito subito da salto verticale massimale.',
      'Atterraggio sullo stesso punto, gambe quasi estese. 3 salti: si tiene il migliore.'
    ],
    registra:'Altezza (cm). L\u2019app stima la potenza di picco (Sayers) se inserisci il peso.',
    note:'Un calo del CMJ rispetto al valore abituale indica affaticamento neuromuscolare.',
    fields:[{key:'altezza',label:'Altezza salto',unit:'cm'},{key:'peso',label:'Peso corporeo',unit:'kg',optional:true}],
    calc:'cmj'
  },
  {
    id:'eur', nome:'SJ + CMJ → EUR', gruppo:'Salti e forza',
    icon:'🦵', type:'input', color:'run',
    sottotitolo:'Eccentric Utilization Ratio',
    misura:'Sfruttamento del ciclo stiramento-accorciamento (elasticità muscolo-tendinea).',
    setup:'Come per il CMJ. Servono sia lo Squat Jump sia il CMJ.',
    esecuzione:[
      'Squat Jump: da posizione accosciata statica (ginocchia ~90°) tenuta 2-3 s, poi salto SENZA contromovimento.',
      'CMJ: con contromovimento (come sopra).',
      'Più tentativi ciascuno: si tiene il migliore.'
    ],
    registra:'EUR = CMJ / SJ (atteso ≥ 1,0). Valori bassi = poco sfruttamento elastico → lavoro pliometrico.',
    note:'La qualità dello Squat Jump dipende dal mantenere davvero la posizione statica, senza rimbalzo.',
    fields:[{key:'cmj',label:'Altezza CMJ',unit:'cm'},{key:'sj',label:'Altezza Squat Jump',unit:'cm'}],
    calc:'eur'
  },
  {
    id:'broad', nome:'Salto in lungo da fermo', gruppo:'Salti e forza',
    icon:'➡️', type:'input', color:'run',
    sottotitolo:'Standing Broad Jump',
    misura:'Potenza orizzontale degli arti inferiori.',
    setup:'Metro a nastro a terra, superficie con buon grip, linea di partenza.',
    esecuzione:[
      'Piedi paralleli dietro la linea, alla larghezza delle spalle.',
      'Contromovimento con oscillazione delle braccia, poi salto orizzontale massimale a piedi pari.',
      'Atterraggio su entrambi i piedi senza cadere indietro. Misura dal tallone più arretrato. 3 prove: la migliore.'
    ],
    registra:'Distanza (cm).',
    note:'Annulla la prova se l\u2019atleta cade all\u2019indietro o appoggia le mani.',
    fields:[{key:'distanza',label:'Distanza',unit:'cm'}],
    calc:'broad'
  },
  {
    id:'onerm', nome:'1RM stimato', gruppo:'Salti e forza',
    icon:'🏋️', type:'input', color:'run',
    sottotitolo:'Brzycki / Epley',
    misura:'Forza massimale di un esercizio senza eseguire un vero massimale (più sicuro).',
    setup:'Bilanciere o macchina, dischi, eventuale spotter.',
    esecuzione:[
      'Riscaldamento con 1-2 serie leggere.',
      'Scegli un carico che porti al cedimento tecnico entro ~3-10 ripetizioni.',
      'Esegui con tecnica corretta fino al cedimento tecnico. Inserisci carico e ripetizioni.'
    ],
    registra:'1RM stimato (kg) e rapporto forza/peso.',
    note:'Affidabile fino a ~10 ripetizioni; oltre, la stima perde precisione.',
    fields:[{key:'carico',label:'Carico sollevato',unit:'kg'},{key:'reps',label:'Ripetizioni',unit:'rip'},{key:'peso',label:'Peso corporeo',unit:'kg',optional:true}],
    calc:'onerm'
  },
  {
    id:'pliche', nome:'Plicometria 3 pliche', gruppo:'Composizione corporea',
    icon:'📏', type:'input', color:'run',
    sottotitolo:'Jackson-Pollock 3 siti',
    misura:'Percentuale di massa grassa dallo spessore delle pliche cutanee.',
    setup:'Plicometro (caliper). Idealmente sempre lo stesso operatore esperto.',
    esecuzione:[
      'Misura sempre il lato destro del corpo.',
      'Pizzica la plica (pelle + grasso) ~1 cm sopra il punto; caliper perpendicolare; leggi dopo 1-2 s.',
      '2-3 misure per sito, usa la media. Uomo: petto, addome, coscia. Donna: tricipite, sovrailiaca, coscia.'
    ],
    registra:'Somma pliche → densità → % grasso (Jackson-Pollock + Siri).',
    note:'Dipende molto dall\u2019operatore: atleta a riposo, non dopo l\u2019allenamento.',
    fields:[
      {key:'sesso',label:'Sesso',type:'sex'},
      {key:'eta',label:'Età',unit:'anni'},
      {key:'p1',label:'Plica 1 (petto ♂ / tricipite ♀)',unit:'mm'},
      {key:'p2',label:'Plica 2 (addome ♂ / sovrailiaca ♀)',unit:'mm'},
      {key:'p3',label:'Plica 3 (coscia)',unit:'mm'}
    ],
    calc:'pliche'
  }
];

/* fasce normative indicative (calcio adulto d'élite) per orientamento */
const NORME = {
  vo2max:{ uomo:'Élite calcio ~55-65 ml/kg/min', donna:'Élite calcio ~48-56 ml/kg/min' },
  yoyo_ir1:{ uomo:'Élite ~2000-2800 m', donna:'Élite ~1200-1800 m' },
  vift:{ uomo:'Élite ~19-21 km/h', donna:'Élite ~17-19 km/h' }
};

window.APP_DATA = { TESTS, NORME };
