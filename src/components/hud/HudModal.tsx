import { X } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CornerBrackets } from '@/components/hud/CornerBrackets';
import { colors } from '@/lib/tokens';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Props for {@link HudModal}.
 */
interface HudModalProps {
  /** Accessible name for the dialog (e.g. `'Reconnaissance feed for Foo'`). */
  ariaLabel: string;
  /** Small amber eyebrow above the heading (e.g. `'// RECONNAISSANCE FEED'`). */
  eyebrow: string;
  /** Heading row content rendered under the eyebrow. */
  heading: ReactNode;
  /** Accessible label for the close button and backdrop. */
  closeLabel: string;
  /** Fired by Esc, the close button, or a click on the backdrop. */
  onClose: () => void;
  /**
   * CSS `max-width` of the frame.
   * @defaultValue `'640px'`
   */
  maxWidth?: CSSProperties['maxWidth'];
  /** Dialog body, rendered below the header. */
  children: ReactNode;
}

/**
 * Full-viewport sci-fi dialog shell: blurred backdrop, amber-bordered frame
 * with corner brackets, eyebrow/heading header, and an `X` close control.
 *
 * @remarks
 * Mount it only while open — it applies its side effects on mount and undoes
 * them on unmount. Layered at `z-[80]`: above the persistent chrome (`z-40`)
 * and overlay FX (`z-[60]`), but below `BootSequence` (`z-[100]`) so the boot
 * intro can never be obscured by a hanging modal.
 *
 * The frame glitches in with the same `hud-rgb-reveal` RGB-split + ripple
 * animation `<main>` uses after boot, so every open replays it. Reduced-motion
 * users get an instant reveal via the existing CSS override.
 *
 * Accessibility: rendered into a `document.body` portal so the rest of the
 * app (`#root`) can be marked `inert` while open — that prevents both
 * keyboard focus and screen readers from reaching the background. Body scroll
 * is locked, Tab is trapped within the dialog (cycling first/last
 * focusables), the close button receives initial focus, and focus is restored
 * to whatever element triggered the open when the modal closes.
 *
 * Shared by {@link VideoFeedModal} and the dossier's service-record modal.
 *
 * @example
 * ```tsx
 * {entry && (
 *   <HudModal
 *     ariaLabel={`Service record: ${entry.role}`}
 *     eyebrow="// SERVICE RECORD"
 *     heading={entry.role}
 *     closeLabel="Close record"
 *     onClose={() => setEntry(null)}
 *   >
 *     …
 *   </HudModal>
 * )}
 * ```
 */
export function HudModal({
  ariaLabel,
  eyebrow,
  heading,
  closeLabel,
  onClose,
  maxWidth = '640px',
  children,
}: HudModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Scroll lock, mark the rest of the app inert, focus the close button.
  // Cleanup undoes them in reverse so focus is restored only after `inert`
  // is gone.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    closeButtonRef.current?.focus();

    return () => {
      root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  // Esc closes; Tab/Shift+Tab cycle within the dialog so focus can't escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop — click to close */}
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(5,8,12,0.85)', backdropFilter: 'blur(8px)' }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="relative w-full hud-rgb-reveal"
        style={{ maxWidth }}
      >
        <CornerBrackets color={colors.amber} size={18} />

        <div
          className="relative"
          style={{
            background: 'linear-gradient(135deg, rgba(11,30,46,0.92) 0%, rgba(19,44,63,0.88) 100%)',
            border: `1px solid ${colors.amber}`,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="flex items-start justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: colors.line }}
          >
            <div className="min-w-0">
              <div
                className="font-body font-semibold uppercase mb-1"
                style={{ color: colors.amber, fontSize: 10, letterSpacing: '0.3em' }}
              >
                {eyebrow}
              </div>
              {heading}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="shrink-0 p-1.5 transition-colors"
              style={{ border: `1px solid ${colors.line}`, color: colors.halo }}
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
