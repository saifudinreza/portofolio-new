// Tiny WebAudio horn, no audio files needed.
let ctx: AudioContext | null = null;

export function honk() {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    for (const [freq, delay] of [[392, 0], [494, 0.16]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.08, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.16);
    }
  } catch {
    // Audio is a nice-to-have; ignore browsers that block it.
  }
}

/** Dull knock plus a leafy rustle for bumping into a tree; strength 0..1. */
export function thud(strength = 1) {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    const knock = ctx.createOscillator();
    const knockGain = ctx.createGain();
    knock.frequency.setValueAtTime(140, now);
    knock.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    knockGain.gain.setValueAtTime(0.3 * strength + 0.01, now);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    knock.connect(knockGain).connect(ctx.destination);
    knock.start(now);
    knock.stop(now + 0.26);

    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const rustle = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const rustleGain = ctx.createGain();
    rustle.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = 2800;
    rustleGain.gain.value = 0.15 * strength;
    rustle.connect(filter).connect(rustleGain).connect(ctx.destination);
    rustle.start(now + 0.02);
  } catch {
    // Audio is a nice-to-have; ignore browsers that block it.
  }
}
