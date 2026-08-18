type Handler = (event: { payload: unknown }) => void;

export class WebviewWindow {
  constructor(_label: string, _options?: Record<string, unknown>) {}

  once(event: string, handler: Handler): Promise<void> {
    if (event === "tauri://created") {
      queueMicrotask(() => handler({ payload: null }));
    }
    return Promise.resolve();
  }
}
