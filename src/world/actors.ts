/** Things that push grass aside (car, later NPCs). Owners add themselves and mutate x/z/radius per frame; radius 0 = inactive. */
export type Actor = { x: number; z: number; radius: number };

export const actors = new Set<Actor>();
