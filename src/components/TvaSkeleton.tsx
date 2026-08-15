import type { CSSProperties, ReactNode } from "react";

interface BoneProps {
  className?: string;
  style?: CSSProperties;
}

/** Single shimmer bar — TVA concrete with gold sweep */
export function Bone({ className = "", style }: BoneProps) {
  return <span className={`tva-bone ${className}`.trim()} style={style} aria-hidden />;
}

interface SkeletonProps {
  className?: string;
  label?: string;
  children: ReactNode;
}

/** Screen-reader label + optional tactful caption under the shimmer */
export function Skeleton({ className = "", label, children }: SkeletonProps) {
  return (
    <div className={`tva-skeleton ${className}`.trim()} role="status" aria-busy="true" aria-label={label}>
      {children}
      {label ? <p className="tva-skeleton-label">{label}</p> : null}
    </div>
  );
}

export function CaseFileDetailSkeleton() {
  return (
    <Skeleton className="case-skeleton">
      <div className="skeleton-file-list">
        {[78, 62, 88, 54, 70].map((w, i) => (
          <div className="skeleton-file-row" key={i}>
            <Bone className="bone-line" style={{ width: `${w}%` }} />
            <Bone className="bone-badge" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function AnomalyColumnSkeleton() {
  return (
    <Skeleton className="anomaly-skeleton">
      {[70, 55, 82].map((w, i) => (
        <Bone className="bone-line" key={i} style={{ width: `${w}%`, marginBottom: 8 }} />
      ))}
    </Skeleton>
  );
}
