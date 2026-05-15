import { Component, type ReactNode } from 'react';

/**
 * Props for {@link SceneErrorBoundary}.
 */
interface SceneErrorBoundaryProps {
  /** Subtree to guard — typically the lazy `HudScene` mount. */
  children: ReactNode;
  /** Rendered in place of `children` after an error is caught. */
  fallback?: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

/**
 * Class-component error boundary scoped to the WebGL background.
 *
 * @remarks
 * Older integrated GPUs (Intel UHD 600 / Iris Xe Lite, on cheaper Windows
 * laptops) can fail to allocate a WebGL2 context, lose context under memory
 * pressure, or reject the postprocessing framebuffer setup. Without a
 * boundary those failures unmount the entire React tree, leaving the user
 * stranded on whatever was last painted (typically the static boot
 * placeholder). Wrapping just `HudScene` keeps a WebGL failure local: the
 * background goes dark, the boot animation finishes normally, and the rest
 * of the HUD remains interactive.
 *
 * The boundary intentionally does not attempt recovery — a context that
 * failed once is unlikely to succeed on a re-render. Logs once to the
 * console for debugging.
 *
 * @example
 * ```tsx
 * <SceneErrorBoundary>
 *   <Suspense fallback={null}>
 *     <HudScene reducedMotion={reducedMotion} />
 *   </Suspense>
 * </SceneErrorBoundary>
 * ```
 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[SceneErrorBoundary] WebGL background disabled:', error.message);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
