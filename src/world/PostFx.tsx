import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BrightnessContrast, Bloom, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

// Ambient occlusion is by far the most expensive pass (about half the frame on an integrated GPU), so it
// starts on and switches itself off for good if the first few seconds average under this frame rate.
const AO_MIN_FPS = 50;
const AO_TRIAL_SECONDS = 3;

/**
 * High-quality post-processing: soft ambient occlusion (when the GPU can afford it), a gentle bloom that only
 * catches bright emissives (lights, boost flame), ACES tone mapping (the composer turns the renderer's off),
 * a light warm grade, a thin vignette and SMAA. Rendered only on the "high" quality setting.
 */
export function PostFx() {
  const [ao, setAo] = useState(true);
  const trial = useRef({ time: 0, frames: 0, done: false });

  useFrame((_, dt) => {
    const t = trial.current;
    if (t.done) return;
    // skip the first half second: shader compilation makes the opening frames slow on every machine
    t.time += dt;
    if (t.time < 0.5) return;
    t.frames++;
    if (t.time >= 0.5 + AO_TRIAL_SECONDS) {
      t.done = true;
      if (t.frames / AO_TRIAL_SECONDS < AO_MIN_FPS) setAo(false);
    }
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {ao ? <N8AO halfRes quality="performance" aoRadius={1.6} distanceFalloff={0.6} intensity={2.2} color="#3A2A1C" /> : <></>}
      <Bloom mipmapBlur luminanceThreshold={1.2} luminanceSmoothing={0.25} intensity={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.08} />
      <BrightnessContrast brightness={0.01} contrast={0.06} />
      <Vignette offset={0.32} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  );
}
