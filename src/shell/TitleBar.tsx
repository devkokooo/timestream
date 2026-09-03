import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VscChromeClose, VscChromeMaximize, VscChromeMinimize, VscChromeRestore } from "react-icons/vsc";
import { cn } from "@/ui/cn";

interface Props {
  title: string;
  folderOpen: boolean;
  onNewWindow: () => void;
  onOpenFolder: () => void;
  onCloseFolder: () => void;
  onRescan: () => void;
  onSettings: () => void;
  onAbout: () => void;
}

type MenuId = "file" | "view" | "help";

interface MenuItemDef {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface MenuDef {
  id: MenuId;
  label: string;
  items: Array<MenuItemDef | "separator">;
}

export function TitleBar({
  title,
  folderOpen,
  onNewWindow,
  onOpenFolder,
  onCloseFolder,
  onRescan,
  onSettings,
  onAbout,
}: Props) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [maximized, setMaximized] = useState(false);
  const menusRef = useRef<HTMLDivElement>(null);

  const menus: MenuDef[] = [
    {
      id: "file",
      label: "File",
      items: [
        { label: "New Window", shortcut: "Ctrl+Shift+N", onSelect: onNewWindow },
        { label: "Open Archive…", onSelect: onOpenFolder },
        { label: "Close Folder", disabled: !folderOpen, onSelect: onCloseFolder },
        "separator",
        { label: "Settings", onSelect: onSettings },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [{ label: "Rescan", disabled: !folderOpen, onSelect: onRescan }],
    },
    {
      id: "help",
      label: "Help",
      items: [{ label: "About…", onSelect: onAbout }],
    },
  ];

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setMaximized(await win.isMaximized());
        });
      } catch {
        /* vite / tests — not running inside Tauri */
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event: PointerEvent) => {
      if (menusRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  return (
    <header className="flex h-9 shrink-0 items-center border-b border-tva-gold/18 bg-[#1a1612] text-tva-paper">
      <div ref={menusRef} className="flex h-full shrink-0 items-center">
        <div data-tauri-drag-region className="flex h-full items-center px-2">
          <TimestreamMark />
        </div>
        {menus.map((menu) => (
          <BarMenu
            key={menu.id}
            menu={menu}
            open={openMenu === menu.id}
            onToggle={() => setOpenMenu((current) => (current === menu.id ? null : menu.id))}
            onHover={() => {
              if (openMenu) setOpenMenu(menu.id);
            }}
            onClose={() => setOpenMenu(null)}
          />
        ))}
      </div>

      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center justify-center px-3"
      >
        <span className="pointer-events-none max-w-full truncate text-[12px] tracking-[0.08em] text-tva-muted">
          {title}
        </span>
      </div>

      <div className="flex h-full shrink-0">
        <WindowButton label="Minimize" onClick={() => void windowOp("minimize")}>
          <VscChromeMinimize size={14} aria-hidden />
        </WindowButton>
        <WindowButton
          label={maximized ? "Restore" : "Maximize"}
          onClick={() => void windowOp("toggleMaximize")}
        >
          {maximized ? (
            <VscChromeRestore size={14} aria-hidden />
          ) : (
            <VscChromeMaximize size={14} aria-hidden />
          )}
        </WindowButton>
        <WindowButton label="Close" danger onClick={() => void windowOp("close")}>
          <VscChromeClose size={14} aria-hidden />
        </WindowButton>
      </div>
    </header>
  );
}

function BarMenu({
  menu,
  open,
  onToggle,
  onHover,
  onClose,
}: {
  menu: MenuDef;
  open: boolean;
  onToggle: () => void;
  onHover: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "h-7 border-0 bg-transparent px-2 text-[12px] tracking-[0.04em] text-tva-paper-dim hover:bg-white/6 hover:text-tva-paper",
          open && "bg-white/8 text-tva-paper",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        onMouseEnter={onHover}
      >
        {menu.label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full left-0 z-50 min-w-53 border border-tva-gold/28 bg-[#241e18] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          {menu.items.map((item, index) =>
            item === "separator" ? (
              <div key={`sep-${index}`} className="my-1 h-px bg-tva-gold/16" role="separator" />
            ) : (
              <MenuItem
                key={item.label}
                label={item.label}
                shortcut={item.shortcut}
                disabled={item.disabled}
                onSelect={() => {
                  onClose();
                  item.onSelect();
                }}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function TimestreamMark() {
  return (
    <img
      className="size-4 shrink-0"
      src="/timestream-logo.svg"
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}

function MenuItem({
  label,
  shortcut,
  disabled,
  onSelect,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="flex w-full items-center justify-between gap-6 border-0 bg-transparent px-3 py-1.5 text-left text-[12px] text-tva-paper hover:bg-tva-orange/18 disabled:text-tva-muted disabled:hover:bg-transparent"
      onClick={onSelect}
    >
      <span>{label}</span>
      {shortcut ? <span className="text-[10px] tracking-[0.08em] text-tva-muted">{shortcut}</span> : null}
    </button>
  );
}

function WindowButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid h-full w-11.5 place-items-center border-0 bg-transparent text-tva-paper-dim transition-colors",
        danger ? "hover:bg-tva-orange-hot hover:text-white" : "hover:bg-white/8 hover:text-tva-paper",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

async function windowOp(op: "minimize" | "toggleMaximize" | "close") {
  try {
    const win = getCurrentWindow();
    if (op === "minimize") await win.minimize();
    else if (op === "toggleMaximize") await win.toggleMaximize();
    else await win.close();
  } catch {
    /* vite / tests */
  }
}
