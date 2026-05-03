import { useEffect, useState } from "react";

/** Viewport width at/above this: keep sprite scale unchanged (1). */
const WIDE_PX = 900;
/** Narrow phones: gentle floor so layout still fits. */
const NARROW_PX = 360;
const MUL_MIN = 0.78;

/** Below this, slightly trim cello sprites so they don’t read huge vs violins on phones. */
const CELLO_BALANCE_ABOVE = 780;
/** Extra multiplier applied only to cello `scale`; 1 on wide viewports (unchanged desktop). */
const CELLO_BALANCE_MIN = 0.86;

function shrinkMulForWidth(w) {
  if (!Number.isFinite(w) || w >= WIDE_PX) return 1;
  if (w <= NARROW_PX) return MUL_MIN;
  return MUL_MIN + ((1 - MUL_MIN) * (w - NARROW_PX)) / (WIDE_PX - NARROW_PX);
}

function celloBalanceMul(w) {
  if (!Number.isFinite(w) || w >= CELLO_BALANCE_ABOVE) return 1;
  if (w <= NARROW_PX) return CELLO_BALANCE_MIN;
  return (
    CELLO_BALANCE_MIN +
    ((1 - CELLO_BALANCE_MIN) * (w - NARROW_PX)) / (CELLO_BALANCE_ABOVE - NARROW_PX)
  );
}

function computeSizing(w) {
  const ww = typeof w === "number" ? w : 960;
  return {
    shrinkMul: shrinkMulForWidth(ww),
    celloBalanceMul: celloBalanceMul(ww),
  };
}

/**
 * Narrow-viewport sizing for orchestra sprites: shared shrink (+ slightly smaller cellos vs violins).
 * Desktop / tablets: celloBalanceMul stays 1; positions unchanged.
 */
export function useOrchestraSpriteShrinkMul() {
  const [{ shrinkMul, celloBalanceMul }, setSizing] = useState(() =>
    typeof window !== "undefined"
      ? computeSizing(window.innerWidth)
      : { shrinkMul: 1, celloBalanceMul: 1 }
  );

  useEffect(() => {
    const onResize = () => setSizing(computeSizing(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { shrinkMul, celloBalanceMul };
}
