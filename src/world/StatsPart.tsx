import type { ReactNode } from 'react';

/** Names a part of the world for the `?stats` breakdown. Otherwise just an empty group. */
export function P({ n, children }: { n: string; children: ReactNode }) {
  return <group userData={{ statsPart: n }}>{children}</group>;
}
