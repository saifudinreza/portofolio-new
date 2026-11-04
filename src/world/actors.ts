/** Things that push grass aside (car, later NPCs). Owners add themselves and mutate x/z/radius per frame; radius 0 = inactive. */
export type Actor = { x: number; z: number; radius: number; /** 1 while playing in the water: splashing the surface */ splashing?: number };

export const actors = new Set<Actor>();
