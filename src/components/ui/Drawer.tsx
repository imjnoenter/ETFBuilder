import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Drawer — right slide-over panel with overlay, focus trap, Esc dismiss,
 * and spring slide animation (ease-out expo, no bounce).
 * On mobile (<=768px) becomes a near-full-screen sheet.
 */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Focus trap + Esc handler
  useEffect(() => {
    if (!open) return;

    // Store previously focused element
    previousFocusRef.current = document.activeElement;

    // Focus the drawer
    const drawer = drawerRef.current;
    if (drawer) {
      const firstFocusable = drawer.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && drawer) {
        const focusable = drawer.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;

      // Restore focus
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.overlay}
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            ref={drawerRef}
            className={styles.drawerMotion}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? 'Detail panel'}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              type: 'tween',
              ease: [0.16, 1, 0.3, 1], // ease-out-expo
              duration: 0.4,
            }}
          >
            <div className={styles.header}>
              {title && <h2 className={styles.title}>{title}</h2>}
              <button
                className={styles.close}
                onClick={onClose}
                aria-label="Close panel"
              >
                &times;
              </button>
            </div>
            <div className={styles.body}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
