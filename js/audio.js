/* =============================================================================
   audio.js — Motore audio (Web Audio API)
   Genera i beep dei test con timing preciso usando l'orologio audio (currentTime),
   non setTimeout, così il ritmo resta accurato per tutta la durata del test.
============================================================================= */

class AudioEngine {
  constructor(){
    this.ctx = null;
    this.master = null;
    this.keepAlive = null;
    this.voiceOn = true;
    this.wakeLock = null;
  }

  /* Va chiamato DENTRO un gesto utente (tap su "Avvia") per sbloccare l'audio su iOS */
  async unlock(){
    if(!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1.0;
      this.master.connect(this.ctx.destination);
    }
    if(this.ctx.state === 'suspended'){ await this.ctx.resume(); }
    // buffer muto per sbloccare la sessione audio su iOS Safari
    const b = this.ctx.createBuffer(1,1,22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b; s.connect(this.ctx.destination); s.start(0);
    this._startKeepAlive();
    await this.requestWakeLock();
    return this.ctx.currentTime;
  }

  now(){ return this.ctx ? this.ctx.currentTime : 0; }

  /* oscillatore continuo quasi-silenzioso: aiuta a tenere viva la sessione audio */
  _startKeepAlive(){
    if(this.keepAlive || !this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.gain.value = 0.0002;
    o.frequency.value = 40;
    o.connect(g); g.connect(this.ctx.destination);
    o.start();
    this.keepAlive = o;
  }

  /* un beep: rampa d'attacco e rilascio per un suono pulito e forte */
  beep(time, {freq=880, dur=0.12, gain=0.95, type='sine'}={}){
    if(!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(this.master);
    o.start(time); o.stop(time + dur + 0.03);
  }

  /* pattern di segnale in base al tipo di evento */
  cue(time, kind){
    switch(kind){
      case 'go':      this.beep(time,{freq:1046,dur:0.14,gain:0.95}); break;
      case 'turn':    this.beep(time,{freq:784,dur:0.10,gain:0.85}); break;
      case 'line':    this.beep(time,{freq:784,dur:0.10,gain:0.85}); break;
      case 'end':     this.beep(time,{freq:784,dur:0.10,gain:0.85}); break;
      case 'double':  this.beep(time,{freq:1318,dur:0.11}); this.beep(time+0.17,{freq:1318,dur:0.11}); break;
      case 'triple':  this.beep(time,{freq:1318,dur:0.09}); this.beep(time+0.14,{freq:1318,dur:0.09}); this.beep(time+0.28,{freq:1318,dur:0.09}); break;
      case 'rec':     this.beep(time,{freq:523,dur:0.18,gain:0.8}); break;
      case 'start':   this.beep(time,{freq:1046,dur:0.5,gain:0.95}); break;
      case 'countdown': this.beep(time,{freq:660,dur:0.12,gain:0.8}); break;
      case 'finish':  this.beep(time,{freq:392,dur:0.6,gain:0.95,type:'sawtooth'});
                      this.beep(time+0.62,{freq:294,dur:0.7,gain:0.95,type:'sawtooth'}); break;
      case 'warn':    this.beep(time,{freq:220,dur:0.35,gain:0.9,type:'square'}); break;
    }
  }

  /* annuncio vocale (non critico per il timing): usato ai cambi di livello */
  say(text){
    if(!this.voiceOn) return;
    try{
      if(!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT'; u.rate = 1.0; u.volume = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }catch(e){}
  }

  async requestWakeLock(){
    try{
      if('wakeLock' in navigator){
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', ()=>{ this.wakeLock = null; });
      }
    }catch(e){ /* wake lock non disponibile: lo schermo va tenuto acceso manualmente */ }
  }
  async reacquireWakeLock(){
    if(!this.wakeLock && this.ctx){ await this.requestWakeLock(); }
  }
  releaseWakeLock(){
    if(this.wakeLock){ try{ this.wakeLock.release(); }catch(e){} this.wakeLock = null; }
  }

  vibrate(pattern){ try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){} }
}

window.Audio = new AudioEngine();

/* riacquisisce il wake lock quando l'app torna in primo piano */
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible'){ window.Audio.reacquireWakeLock(); }
});
