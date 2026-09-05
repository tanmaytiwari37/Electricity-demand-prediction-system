import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconArrow } from './Icons.tsx'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const BASE = 'pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] font-semibold select-none disabled:cursor-not-allowed disabled:opacity-50'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-series-blue text-white border border-series-blue hover:bg-[#4a90e8] hover:border-[#4a90e8] hover:-translate-y-px hover:shadow-[0_12px_24px_-10px_rgba(57,135,229,0.75)]',
  secondary: 'bg-surface-2 text-ink border border-line-strong hover:border-ink-3 hover:bg-surface-3 hover:-translate-y-px hover:shadow-[0_8px_18px_-10px_rgba(0,0,0,0.7)]',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-surface-2',
}
const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[11px] tracking-wide',
  md: 'h-8 px-3 text-xs tracking-wide',
  lg: 'h-10 px-4 text-[13px] tracking-[0.06em] uppercase',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  arrow?: boolean
  children: ReactNode
}

/** The only element class that animates: subtle lift on hover, press
 *  feedback on active, and the arrow slides when the button is hovered. */
export default function Button({ variant = 'secondary', size = 'md', arrow, className = '', children, ...rest }: Props) {
  return (
    <button className={`group ${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {children}
      {arrow && <IconArrow size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />}
    </button>
  )
}

export function LinkButton({ to, variant = 'secondary', size = 'md', arrow = true, className = '', children }: {
  to: string; variant?: Variant; size?: Size; arrow?: boolean; className?: string; children: ReactNode
}) {
  return (
    <Link to={to} className={`group ${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {children}
      {arrow && <IconArrow size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />}
    </Link>
  )
}
