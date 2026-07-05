# Test Atletici — App da campo (PWA)

App per iPhone (e Android) che ti assiste durante i test da campo: **audio dei beep,
cronometri, distanze, cambi di velocità e calcolo automatico del VO₂max** e degli altri
indici. Si installa sulla home dell'iPhone come una vera app e **funziona anche offline**.

È una **PWA (Progressive Web App)**: la costruisci e la pubblichi **interamente dal tablet
via GitHub**, senza Mac, senza Xcode, senza App Store e senza abbonamenti.

---

## Cosa contiene (test inclusi)

| Gruppo | Test | Cosa fa l'app |
|---|---|---|
| Resistenza intermittente | **Yo-Yo IR1**, **Yo-Yo IR2** | genera i beep con i cambi di velocità reali (tabelle Bangsbo 2008), mostra velocità/navette/metri, stima VO₂max |
| Resistenza intermittente | **30-15 IFT** | 30 s corsa / 15 s recupero, velocità +0,5 km/h/stadio, calcola VIFT + VO₂max (Buchheit) + velocità HIIT individualizzate |
| Resistenza aerobica | **Beep test (Léger)** | navette 20 m continue, livelli ~60 s, VO₂max (Léger) |
| Resistenza aerobica | **Cooper 12 min** | timer con avvisi, VO₂max da distanza |
| Velocità e potenza | **Sprint 10/20/30 m** | starter audio 3-2-1 + split manuali, velocità lanciata |
| Velocità e potenza | **505 cambio direzione** | starter + tempo + COD deficit |
| Velocità e potenza | **RSA** | starter + recupero a tempo + decremento % |
| Velocità e potenza | **RAST** | starter + recupero 10 s + potenza/indice di fatica |
| Salti e forza | **CMJ**, **SJ+CMJ (EUR)**, **Salto in lungo**, **1RM** | inserimento dati + formule (Sayers, Brzycki/Epley) |
| Composizione corporea | **Plicometria 3 pliche** | Jackson-Pollock + Siri → % massa grassa |

Tutti i risultati si salvano nello **Storico** (solo sul dispositivo) ed esporti un **CSV**.

---

## Struttura dei file (già pronta)

```
test-atletici-app/
├── index.html                 ← pagina principale
├── manifest.webmanifest       ← configurazione "app installabile"
├── sw.js                      ← service worker (funzionamento offline)
├── README.md                  ← questa guida
├── css/
│   └── styles.css
├── js/
│   ├── data.js                ← protocolli, tabelle velocità, istruzioni
│   ├── audio.js               ← motore audio (beep + voce)
│   ├── engines.js             ← "scalette" dei test + scheduler
│   ├── calc.js                ← calcolatori (VO₂max, potenza, % grasso…)
│   └── app.js                 ← interfaccia, navigazione, salvataggio
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-180.png           ← icona per la home iPhone
    └── icon-512-maskable.png
```

Non serve nessun passaggio di "compilazione": sono file statici, il browser li esegue così.

---

## Pubblicare l'app dal tablet (GitHub Pages) — passo per passo

### 1) Crea il repository
1. Vai su **github.com** → **New repository**.
2. Nome (es. `test-atletici`), **Public**, poi **Create repository**.

### 2) Carica i file (mantenendo le cartelle)
Modo più semplice dal tablet:
1. Nel repo vuoto tocca **“uploading an existing file”**.
2. **Trascina dentro tutti i file e le cartelle** del progetto (`index.html`, `css/`, `js/`, `icons/`, ecc.).
   Se il caricamento a cartelle non funziona bene sul tablet, apri l'editor web:
   nella pagina del repo premi il tasto **`.`** (punto) → si apre **github.dev** →
   trascina lì i file con drag-and-drop (il tuo metodo abituale) e poi **Commit**.
3. Scrivi un messaggio (es. "prima versione") e **Commit changes**.

> Importante: la cartella `css`, `js`, `icons` devono restare cartelle, non file singoli sciolti.

### 3) Attiva GitHub Pages
1. Nel repo: **Settings** → **Pages**.
2. In **Build and deployment → Source** scegli **Deploy from a branch**.
3. Branch: **main**, cartella: **/(root)** → **Save**.
4. Dopo ~1 minuto compare l'indirizzo pubblico, tipo:
   `https://TUONOME.github.io/test-atletici/`

### 4) Installa sull'iPhone
1. Apri quell'indirizzo **con Safari** sull'iPhone.
2. Tocca il pulsante **Condividi** (quadrato con freccia) → **Aggiungi a Home**.
3. Ora hai l'icona sulla home: si apre a schermo intero come un'app.

> **Apri l'app una prima volta con connessione**: così registra i file in cache e da lì
> in poi **funziona offline**, anche in un campo senza rete.

---

## Aggiornare l'app in futuro
1. Modifica i file su GitHub (o github.dev) e fai **Commit**.
2. **Apri `sw.js` e cambia la riga** `const CACHE_VERSION = 'test-atletici-v1';`
   in `...-v2`, `...-v3`, ecc. Questo forza l'iPhone a scaricare la versione nuova.
3. Riapri l'app con connessione: si aggiorna da sola.

---

## Prima di andare in campo (checklist)
- 🔊 **Cassa Bluetooth** collegata e **volume alto** (i beep devono sentirsi a distanza).
- 📱 **Schermo acceso**: l'app prova a tenerlo attivo, ma su iPhone se blocchi lo schermo
  l'audio può fermarsi. Tieni il telefono in mano / sul treppiede, sbloccato.
- 🧊 **Coni e metro**: segna le distanze del test (vedi il diagramma dentro ogni scheda).
- 🔋 Batteria carica: Yo-Yo IR1 completo dura quasi 30 minuti.

---

## Note e limiti (onestà tecnica)
- **Stime, non misure di laboratorio.** VO₂max, potenza e % grasso sono valori *stimati*
  con formule validate: usali soprattutto per il **confronto nel tempo dello stesso atleta**.
- **Sprint / 505 / RSA / RAST**: i tempi sono **manuali** (tocco sullo schermo). Utile e
  ripetibile, ma meno preciso delle fotocellule/Optojump: fai più prove e fai la media.
- **Audio a schermo bloccato (iPhone):** iOS può sospendere l'audio quando lo schermo si
  spegne. Per i test lunghi tieni lo schermo acceso.
- **Non è uno strumento diagnostico** né sostituisce una valutazione medica. Esegui i test
  massimali solo con atleti idonei e ben riscaldati.

---

## Fonti dei protocolli
- Yo-Yo IR1/IR2 — Bangsbo J., Iaia F.M., Krustrup P. (2008), *Sports Med* 38(1):37-51.
- 30-15 IFT — Buchheit M. (2008), *J Strength Cond Res*; VO₂max secondo la formula di Buchheit.
- Beep test 20 m — Léger L.A., Mercier D., Gadoury C., Lambert J. (1988), *J Sports Sci* 6(2):93-101.
- Cooper (1968); Jackson-Pollock (1978) + Siri; Brzycki/Epley; Sayers et al. (1999).

Tutte le tracce audio sono **generate dall'app** dai dati di velocità dei protocolli:
non viene usato nessun file audio protetto da copyright.
