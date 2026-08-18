export function getCurrentWindow() {
  return {
    isMaximized: async () => false,
    minimize: async () => {},
    toggleMaximize: async () => {},
    close: async () => {},
    onResized: async () => () => {},
    outerPosition: async () => ({ x: 48, y: 48 }),
    scaleFactor: async () => 1,
  };
}
