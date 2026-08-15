let seq = 0;

export function nextArchiveWindowLabel(now = Date.now()): string {
  seq += 1;
  return `archive-${now}-${seq}`;
}

export async function openNewArchiveWindow(): Promise<void> {
  const [{ WebviewWindow }, { getCurrentWindow }] = await Promise.all([
    import("@tauri-apps/api/webviewWindow"),
    import("@tauri-apps/api/window"),
  ]);
  const label = nextArchiveWindowLabel();
  const offset = await cascadeOffset(getCurrentWindow);
  const webview = new WebviewWindow(label, {
    title: "TIMESTREAM — Chronomonitoring",
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    decorations: false,
    shadow: true,
    focus: true,
    ...offset,
  });

  await new Promise<void>((resolve, reject) => {
    void webview.once("tauri://created", () => resolve());
    void webview.once("tauri://error", (event) => {
      const payload = event.payload;
      reject(new Error(typeof payload === "string" ? payload : "Failed to open a new window"));
    });
  });
}

async function cascadeOffset(
  currentWindow: typeof import("@tauri-apps/api/window").getCurrentWindow,
): Promise<{ x: number; y: number } | Record<string, never>> {
  try {
    const current = currentWindow();
    const [pos, scale] = await Promise.all([current.outerPosition(), current.scaleFactor()]);
    return {
      x: Math.round(pos.x / scale) + 36,
      y: Math.round(pos.y / scale) + 36,
    };
  } catch {
    return {};
  }
}
