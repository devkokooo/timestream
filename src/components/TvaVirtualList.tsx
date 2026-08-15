import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { TvaScrollArea } from "./TvaScrollArea";

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  items: VirtualItem[];
}

interface Props {
  count: number;
  estimateSize: (index: number) => number;
  getItemKey?: (index: number) => string | number;
  overscan?: number;
  className?: string;
  axis?: "x" | "y" | "both";
  rails?: "x" | "y" | "both";
  fill?: boolean;
  viewportClassName?: string;
  /** Inner content min-width (long diff lines). */
  minWidth?: number | string;
  children: (index: number) => ReactNode;
  overlay?: (range: VirtualRange) => ReactNode;
  onRangeChange?: (startIndex: number, endIndex: number) => void;
  viewportRef?: Ref<HTMLDivElement | null>;
  onScroll?: () => void;
}

const EMPTY_RANGE: VirtualRange = { startIndex: 0, endIndex: 0, items: [] };

export function TvaVirtualList({
  count,
  estimateSize,
  getItemKey,
  overscan = 10,
  className = "",
  axis = "y",
  rails,
  fill = false,
  viewportClassName = "",
  minWidth,
  children,
  overlay,
  onRangeChange,
  viewportRef,
  onScroll,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const setViewport = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    if (!viewportRef) return;
    if (typeof viewportRef === "function") viewportRef(node);
    else viewportRef.current = node;
  };
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => innerRef.current,
    estimateSize,
    overscan,
    getItemKey,
  });

  const items = virtualizer.getVirtualItems();
  const range: VirtualRange =
    items.length === 0
      ? EMPTY_RANGE
      : {
          startIndex: items[0].index,
          endIndex: items[items.length - 1].index + 1,
          items,
        };

  useEffect(() => {
    onRangeChange?.(range.startIndex, range.endIndex);
  }, [onRangeChange, range.startIndex, range.endIndex]);

  const list = (
    <TvaScrollArea
      className={overlay ? `${className} h-full`.trim() : className}
      axis={axis}
      rails={rails}
      fill={fill}
      viewportClassName={viewportClassName}
      viewportRef={setViewport}
      onScroll={onScroll}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          minWidth,
          position: "relative",
        }}
      >
        {items.map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${item.start}px)`,
            }}
          >
            {children(item.index)}
          </div>
        ))}
      </div>
    </TvaScrollArea>
  );

  if (!overlay) return list;

  return (
    <div className={fill ? "relative flex min-h-0 flex-1 flex-col" : "relative"}>
      {list}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[6]">{overlay(range)}</div>
    </div>
  );
}
