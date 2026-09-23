import { cn } from '@/lib/utils'
import React from 'react'

export interface LoaderProps {
  variant?:
    | 'circular'
    | 'classic'
    | 'pulse'
    | 'pulse-dot'
    | 'dots'
    | 'typing'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function CircularLoader({ size, className }: { size?: LoaderProps['size']; className?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  }
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-muted-foreground/30 border-t-foreground',
        sizeClasses[size || 'md'],
        className,
      )}
    />
  )
}

function PulseDotLoader({ size, className }: { size?: LoaderProps['size']; className?: string }) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  }
  return (
    <span className="relative flex items-center justify-center">
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75',
          sizeClasses[size || 'md'],
        )}
      />
      <span
        className={cn(
          'relative inline-flex rounded-full bg-foreground',
          sizeClasses[size || 'md'],
          className,
        )}
      />
    </span>
  )
}

function DotsLoader({ size, className }: { size?: LoaderProps['size']; className?: string }) {
  const dotClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }
  return (
    <div className={cn('flex items-center space-x-1.5', className)}>
      <span className={cn('rounded-full bg-foreground animate-bounce', dotClasses[size || 'md'])} style={{ animationDelay: '0ms' }} />
      <span className={cn('rounded-full bg-foreground animate-bounce', dotClasses[size || 'md'])} style={{ animationDelay: '150ms' }} />
      <span className={cn('rounded-full bg-foreground animate-bounce', dotClasses[size || 'md'])} style={{ animationDelay: '300ms' }} />
    </div>
  )
}

export function Loader({ variant = 'circular', size = 'md', className }: LoaderProps) {
  switch (variant) {
    case 'pulse-dot':
    case 'pulse':
      return <PulseDotLoader size={size} className={className} />
    case 'dots':
    case 'typing':
      return <DotsLoader size={size} className={className} />
    case 'circular':
    case 'classic':
    default:
      return <CircularLoader size={size} className={className} />
  }
}
