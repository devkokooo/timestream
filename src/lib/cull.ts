/** Axis-aligned box in the same space as the items being culled. */
export type CullRect = { x: number; y: number; w: number; h: number };

/** Snap a frustum to a coarse grid so tiny camera moves reuse the last query. */
export function quantizeRect(rect: CullRect, cell: number): CullRect {
  const size = cell > 0 ? cell : 1;
  const x = Math.floor(rect.x / size) * size;
  const y = Math.floor(rect.y / size) * size;
  const right = Math.ceil((rect.x + rect.w) / size) * size;
  const bottom = Math.ceil((rect.y + rect.h) / size) * size;
  return { x, y, w: Math.max(size, right - x), h: Math.max(size, bottom - y) };
}

export function rectsEqual(a: CullRect, b: CullRect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function rectKey(rect: CullRect): string {
  return `${rect.x}:${rect.y}:${rect.w}:${rect.h}`;
}

/**
 * Uniform grid spatial hash. Short AABBs land in the cells they overlap;
 * items that span many cells go on a separate long list (game-engine "large object" bucket).
 */
export interface SpatialGrid<T> {
  cell: number;
  originX: number;
  originY: number;
  buckets: Map<string, T[]>;
  longs: T[];
}

const LONG_CELL_SPAN = 24;

function cellKey(ix: number, iy: number): string {
  return `${ix}:${iy}`;
}

export function createSpatialGrid<T>(originX: number, originY: number, cell: number): SpatialGrid<T> {
  return {
    cell: cell > 0 ? cell : 1,
    originX,
    originY,
    buckets: new Map(),
    longs: [],
  };
}

export function insertAabb<T>(grid: SpatialGrid<T>, item: T, aabb: CullRect): void {
  const cell = grid.cell;
  const x0 = Math.floor((aabb.x - grid.originX) / cell);
  const y0 = Math.floor((aabb.y - grid.originY) / cell);
  const x1 = Math.floor((aabb.x + Math.max(aabb.w, 1) - grid.originX) / cell);
  const y1 = Math.floor((aabb.y + Math.max(aabb.h, 1) - grid.originY) / cell);
  const span = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (span > LONG_CELL_SPAN) {
    grid.longs.push(item);
    return;
  }
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const key = cellKey(ix, iy);
      const bucket = grid.buckets.get(key);
      if (bucket) bucket.push(item);
      else grid.buckets.set(key, [item]);
    }
  }
}

/** Unique items from overlapping cells plus every long-span object. */
export function queryGrid<T>(grid: SpatialGrid<T>, rect: CullRect): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  const add = (item: T) => {
    if (seen.has(item)) return;
    seen.add(item);
    out.push(item);
  };
  for (const item of grid.longs) add(item);

  const cell = grid.cell;
  const x0 = Math.floor((rect.x - grid.originX) / cell);
  const y0 = Math.floor((rect.y - grid.originY) / cell);
  const x1 = Math.floor((rect.x + rect.w - grid.originX) / cell);
  const y1 = Math.floor((rect.y + rect.h - grid.originY) / cell);
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const bucket = grid.buckets.get(cellKey(ix, iy));
      if (!bucket) continue;
      for (const item of bucket) add(item);
    }
  }
  return out;
}

export interface ListWindow {
  start: number;
  end: number;
  offset: number;
}

/** Frustum cull a fixed-height list. `end` is exclusive. */
export function cullListWindow(opts: {
  count: number;
  itemSize: number;
  scroll: number;
  viewport: number;
  overscan?: number;
}): ListWindow {
  const count = Math.max(0, opts.count);
  const size = opts.itemSize > 0 ? opts.itemSize : 1;
  const overscan = opts.overscan ?? 8;
  const start = Math.min(count, Math.max(0, Math.floor(Math.max(0, opts.scroll) / size) - overscan));
  const visible = Math.ceil(Math.max(0, opts.viewport) / size);
  const end = Math.min(count, start + visible + overscan * 2);
  return { start, end, offset: start * size };
}

/** Exclusive prefix sums: `offsets[i]` is the top of item `i`, `offsets[count]` is total height. */
export function prefixSums(sizes: ArrayLike<number>): number[] {
  const offsets = new Array(sizes.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < sizes.length; i++) {
    offsets[i + 1] = offsets[i] + Math.max(0, sizes[i]);
  }
  return offsets;
}

/** First index whose offset is >= `value`, clamped to `0..length-1`. */
export function lowerBoundOffset(offsets: ArrayLike<number>, value: number): number {
  const last = offsets.length - 1;
  if (last <= 0) return 0;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, last);
}

/** Frustum cull a variable-height list from prefix sums. `end` is exclusive. */
export function cullListWindowVariable(opts: {
  offsets: ArrayLike<number>;
  scroll: number;
  viewport: number;
  overscan?: number;
}): ListWindow {
  const offsets = opts.offsets;
  const count = Math.max(0, offsets.length - 1);
  if (count === 0) return { start: 0, end: 0, offset: 0 };
  const overscan = opts.overscan ?? 8;
  const scroll = Math.max(0, opts.scroll);
  const viewH = Math.max(0, opts.viewport);
  const first = lowerBoundOffset(offsets, scroll);
  const start = Math.min(count, Math.max(0, first - 1 - overscan));
  const last = lowerBoundOffset(offsets, scroll + viewH);
  const end = Math.min(count, Math.max(start, last + overscan));
  return { start, end, offset: offsets[start] ?? 0 };
}
