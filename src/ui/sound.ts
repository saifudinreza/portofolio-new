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
