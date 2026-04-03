/**
 * Shared animation presets for Meridian UI.
 *
 * Used with framer-motion across all page components.
 * Import instead of duplicating the definition in every file.
 */

/**
 * Fade-in with subtle upward slide. The standard page-enter animation.
 */
export const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
} as const;

/**
 * Variant with exit animation for use with AnimatePresence.
 */
export const fadeInUpWithExit = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
} as const;
