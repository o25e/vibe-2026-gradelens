'use client'
import React from 'react'

// ── Badge ──────────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'purple'
const badgeStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger:  'bg-red-50 text-red-700 border-red-200',
  info:    'bg-indigo-50 text-indigo-700 border-indigo-200',
  gray:    'bg-slate-100 text-slate-600 border-slate-200',
  purple:  'bg-violet-50 text-violet-700 border-violet-200',
}
export function Badge({ children, variant = 'gray', className = '' }: {
  children: React.ReactNode; variant?: BadgeVariant; className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-600 border ${badgeStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}

// ── Button ─────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'success' | 'danger'
const btnStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border-transparent shadow-sm',
  outline: 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50',
  ghost:   'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent shadow-sm',
  danger:  'bg-red-600 text-white hover:bg-red-700 border-transparent shadow-sm',
}
export function Button({ children, variant = 'primary', size = 'md', className = '', onClick, disabled }: {
  children: React.ReactNode; variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'
  className?: string; onClick?: () => void; disabled?: boolean
}) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-lg border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${btnStyles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────
export function Card({ children, className = '', padding = true }: {
  children: React.ReactNode; className?: string; padding?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ── CardHeader ─────────────────────────────────────────────────────────────
export function CardHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-700 text-slate-800 tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color = 'default' }: {
  label: string; value: string | number; sub?: string; color?: 'default' | 'blue' | 'green' | 'amber' | 'red'
}) {
  const colors = {
    default: 'text-slate-800', blue: 'text-indigo-600', green: 'text-emerald-600',
    amber: 'text-amber-600', red: 'text-red-600'
  }
  return (
    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="text-xs font-600 text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-800 ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── ProgressBar ────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = '#6366f1' }: {
  value: number; max?: number; color?: string
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────
const avatarColors = ['bg-indigo-100 text-indigo-700','bg-violet-100 text-violet-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700','bg-cyan-100 text-cyan-700']
export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colorIdx = name.charCodeAt(0) % avatarColors.length
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }
  return (
    <div className={`rounded-full flex items-center justify-center font-700 flex-shrink-0 ${sizes[size]} ${avatarColors[colorIdx]}`}>
      {name[0]}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string
  children: React.ReactNode; footer?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-base font-700 text-slate-800">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 pb-5 flex justify-end gap-2 flex-shrink-0 border-t border-slate-100 pt-4">{footer}</div>}
      </div>
    </div>
  )
}

// ── SectionLabel ───────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-700 text-slate-400 uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}
