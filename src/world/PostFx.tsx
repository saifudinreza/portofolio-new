import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BrightnessContrast, Bloom, EffectComposer, HueSaturation, N8AO, SMAA, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, Effect, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

/**
 * Split-tone grade: shadows lean teal like the sea, highlights lean warm like the sand, midtones barely move.
 * Pushes colour, not brightness, so it sits after tone mapping without clipping.
 */
class SplitToneEffect extends Effect {
  constructor(shadow: string, highlight: string, amount: number) {
    super(
      'SplitToneEffect',
      /* glsl */ `
      uniform vec3 uShadow;
      uniform vec3 uHighlight;
      uniform float uAmount;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 tint = mix(uShadow, uHighlight, smoothstep(0.12, 0.8, l)) - 0.5;
        // strongest in the shadows and highlights, fading out through the midtones
        float w = 0.35 + 0.65 * abs(l - 0.5) * 2.0;
        outputColor = vec4(c + tint * uAmount * w, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map<string, THREE.Uniform>([
          ['uShadow', new THREE.Uniform(new THREE.Color(shadow))],
          ['uHighlight', new THREE.Uniform(new THREE.Color(highlight))],
          ['uAmount', new THREE.Uniform(amount)],
        ]),
      },
    );
  }
}

// Ambient occlusion is by far the most expensive pass (about half the frame on an integrated GPU), so it
// starts on and switches itself off for good if the first few seconds average under this frame rate.
const AO_MIN_FPS = 50;
const AO_TRIAL_SECONDS = 3;

/**
 * High-quality post-processing: soft ambient occlusion (when the GPU can afford it), a gentle bloom that only
 * catches bright emissives (lights, lanterns, LED bar, boost flame), ACES tone mapping (the composer turns the
 * renderer's off), a teal-and-warm split-tone grade, a light tilt-shift depth of field, a thin vignette and SMAA.
 * Rendered only on the "high" quality setting.
 */
export function PostFx() {
  const [ao, setAo] = useState(true);
  const splitTone = useMemo(() => new SplitToneEffect('#3F9098', '#F4B577', 0.16), []);
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
      {/* a light tilt-shift: the band around the car stays sharp, the top and bottom of the view soften like a
          miniature. It blurs before tone mapping and grading so every colour step sees the same image. */}
      <TiltShift2 blur={0.1} taper={0.6} samples={8} start={[0, 0.5]} end={[1, 0.5]} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={splitTone} />
      <HueSaturation saturation={0.08} />
      <BrightnessContrast brightness={0.01} contrast={0.06} />
      <Vignette offset={0.32} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  );
}
