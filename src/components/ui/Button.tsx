import type { ReactNode, MouseEventHandler } from 'react';
import { motion } from 'motion/react';
import styles from './Button.module.css';

export interface ButtonProps {
  variant?: 'primary' | 'ghost';
  size?: 'default' | 'small';
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
  title?: string;
}

/**
 * Button — primary (warm crimson CTA) or ghost (transparent, ink-colored).
 * Tactile press feedback via motion scale.
 */
export function Button({
  variant = 'primary',
  size = 'default',
  className,
  children,
  disabled,
  onClick,
  type,
  'aria-label': ariaLabel,
  title,
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'small' ? styles.small : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.button
      className={classes}
      disabled={disabled}
      onClick={onClick}
      type={type}
      aria-label={ariaLabel}
      title={title}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'tween', duration: 0.1 }}
    >
      {children}
    </motion.button>
  );
}
