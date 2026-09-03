import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/ui/cn";

const MENU_MIN_W = 180;

export interface TvaContextMenuItem {
  id: string;
  label: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface TvaContextMenuState {
  x: number;
  y: number;
  items: TvaContextMenuItem[];
}

interface Props {
  menu: TvaContextMenuState | null;
  onClose: () => void;
}

export function TvaContextMenu({ menu, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onPointer = (e: MouseEvent | PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const left = Math.max(8, Math.min(menu.x, window.innerWidth - MENU_MIN_W - 8));
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 12 - menu.items.length * 36));

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      className="rounded-md border border-tva-gold/25 bg-[#2d241c] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 10050,
        minWidth: MENU_MIN_W,
      }}
    >
      {menu.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={cn(
            "w-full border border-transparent bg-transparent px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.12em] text-tva-gold enabled:hover:border-tva-orange enabled:hover:text-tva-gold-bright disabled:opacity-40",
            item.danger && "text-[#f3c2b8] enabled:hover:border-tva-stamp enabled:hover:text-[#ff8a6a]",
          )}
          onClick={() => {
            if (item.disabled) return;
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** Build a menu at pointer coords; call from onContextMenu after preventDefault. */
export function menuAtPointer(
  e: { clientX: number; clientY: number },
  items: TvaContextMenuItem[],
): TvaContextMenuState {
  return { x: e.clientX, y: e.clientY, items };
}
