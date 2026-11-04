import { useStore } from '../store';

/** What the loader says while each group of the world is being built, in the order they are mounted. */
export const STAGE_LABELS = [
  'Shaping the island',
  'Planting grass and trees',
  'Scattering the little details',
  'Filling the river and the pond',
  'Raising the monuments',
  'Waking up the villagers',
  'Warming up the engine',
];
/** Share of the bar (0 to 100) each phase fills: 0-35 downloading (the loader paces it), 35-88 building, 88-100 compiling. */
const BUILD_FROM = 35;
const BUILD_TO = 88;
const WARM_AT = 94;

const state = { built: 0, total: STAGE_LABELS.length, warmed: false, assetsBusy: false, finished: false };
/** Number of groups the world is built in (see StagedWorld). */
export const STAGE_TOTAL = STAGE_LABELS.length;

/** Turn the three things the world waits for (stages mounted, shaders compiled, loaded assets) into one number and a label. */
function publish() {
  const { built, total, warmed, assetsBusy } = state;
  // once the world has been ready it stays ready: a texture arriving later must not close the Start button again
  const done = state.finished || (built >= total && warmed && !assetsBusy);
  state.finished = done;
  let progress: number;
  let label: string;
  if (done) {
    progress = 100;
    label = 'Ready';
  } else if (built < total) {
    progress = BUILD_FROM + ((BUILD_TO - BUILD_FROM) * built) / total;
    label = STAGE_LABELS[Math.min(built, total - 1)];
  } else {
    progress = warmed ? 99 : WARM_AT;
    label = warmed ? 'Almost there' : 'Compiling the shaders';
  }
  useStore.getState().setLoad(progress, done, label);
}

export const loading = {
  /** `built` of `total` groups of the world are mounted. */
  stage(built: number, total = STAGE_LABELS.length) {
    state.built = built;
    state.total = total;
    publish();
  },
  /** Every shader has been compiled. */
  warmed() {
    state.warmed = true;
    publish();
  },
  /** Textures or fonts are still arriving (three's loading manager). */
  assets(busy: boolean) {
    state.assetsBusy = busy;
    publish();
  },
};
