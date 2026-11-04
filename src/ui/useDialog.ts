import { useEffect, useRef } from 'react';

/**
 * Moves focus into a dialog when it opens and hands it back to whatever had it before when it closes, so
 * keyboard users are never left stranded behind the overlay. Attach the returned ref to the dialog (tabIndex -1).
 */
export function useDialogFocus<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus?.();
  }, [open]);
  return ref;
}
