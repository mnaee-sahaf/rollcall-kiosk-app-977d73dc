export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight">
        Roll<span className="text-primary">Call</span>
      </span>
    </div>
  );
}
