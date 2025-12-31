

/**
 * Premium Skeleton Components
 * Replace loading spinners with content-shaped placeholders that shimmer
 */

// Base skeleton with shimmer effect
function SkeletonBase({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-studio-800 via-studio-700 to-studio-800 bg-[length:200%_100%] rounded ${className}`}
    />
  )
}

// Skeleton for game cards in the grid
export function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      {/* Image placeholder */}
      <div className="aspect-[460/215] relative">
        <SkeletonBase className="absolute inset-0 rounded-none" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <SkeletonBase className="h-5 w-3/4" />

        {/* Subtitle / Platform */}
        <SkeletonBase className="h-3 w-1/2" />

        {/* Status row */}
        <div className="flex items-center justify-between pt-2">
          <SkeletonBase className="h-6 w-20" />
          <SkeletonBase className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

// Skeleton for engine list items
export function SkeletonListItem() {
  return (
    <div className="glass-card p-4 flex items-center justify-between animate-fade-in">
      <div className="flex items-center gap-4">
        {/* Icon placeholder */}
        <SkeletonBase className="w-10 h-10 rounded-lg" />

        {/* Text content */}
        <div className="space-y-2">
          <SkeletonBase className="h-4 w-24" />
          <SkeletonBase className="h-3 w-16" />
        </div>
      </div>

      {/* Action button placeholder */}
      <SkeletonBase className="h-8 w-20 rounded-lg" />
    </div>
  )
}

// Skeleton for settings sections
export function SkeletonSettingsBlock() {
  return (
    <div className="glass-card p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SkeletonBase className="w-5 h-5 rounded" />
        <SkeletonBase className="h-5 w-32" />
      </div>

      {/* Content rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBase className="h-4 w-40" />
          <SkeletonBase className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex items-center justify-between">
          <SkeletonBase className="h-4 w-32" />
          <SkeletonBase className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// Grid of skeleton cards
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  )
}

// List of skeleton items
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  )
}

export default {
  Card: SkeletonCard,
  ListItem: SkeletonListItem,
  SettingsBlock: SkeletonSettingsBlock,
  Grid: SkeletonGrid,
  List: SkeletonList
}
