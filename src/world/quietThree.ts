import * as THREE from 'three';

// three warns on every toNonIndexed() of a geometry that already is non-indexed (RoundedBoxGeometry, for one, is) and
// then returns the geometry unchanged. The shapes here are merged from many parts, some indexed and some not, so that
// call is everywhere and flooded the console with hundreds of identical warnings that hid real ones. This keeps the
// result (the same geometry back) and drops the warning. Imported first in Scene.tsx, before any geometry is built.
const toNonIndexed = THREE.BufferGeometry.prototype.toNonIndexed;
THREE.BufferGeometry.prototype.toNonIndexed = function (this: THREE.BufferGeometry) {
  return this.index === null ? this : toNonIndexed.call(this);
};
