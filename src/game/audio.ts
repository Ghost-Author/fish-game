type SfxType = 'eat' | 'hit' | 'power' | 'level';

export class AudioManager {
  private context?: AudioContext;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private musicOn = true;
  private sfxOn = true;
  private musicVolume = 0.6;
  private sfxVolume = 0.8;
  private musicOsc?: OscillatorNode;
  private lfo?: OscillatorNode;

  init() {
    if (this.context) return;
    this.context = new AudioContext();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.sfxGain.gain.value = this.sfxVolume;
    this.musicGain.connect(this.context.destination);
    this.sfxGain.connect(this.context.destination);
    this.startMusic();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? this.musicVolume : 0;
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? this.sfxVolume : 0;
  }

  setMusicVolume(v: number) {
    this.musicVolume = v;
    if (this.musicGain && this.musicOn) this.musicGain.gain.value = v;
  }

  setSfxVolume(v: number) {
    this.sfxVolume = v;
    if (this.sfxGain && this.sfxOn) this.sfxGain.gain.value = v;
  }

  playSfx(type: SfxType) {
    if (!this.context || !this.sfxGain || !this.sfxOn) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    const freq = type === 'eat' ? 520 : type === 'power' ? 320 : type === 'level' ? 640 : 140;
    osc.frequency.setValueAtTime(freq, now);
    osc.type = type === 'hit' ? 'sawtooth' : 'triangle';
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(this.sfxVolume * 0.6, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  private startMusic() {
    if (!this.context || !this.musicGain) return;
    if (this.musicOsc) return;
    const osc = this.context.createOscillator();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.value = 90;
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(this.musicGain);
    osc.start();
    lfo.start();
    this.musicOsc = osc;
    this.lfo = lfo;
  }
}
