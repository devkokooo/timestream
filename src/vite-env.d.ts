/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set by `bundle-release.ts --nightly` (e.g. `0.2.0+a1b2c3d-nightly`). */
  readonly VITE_TIMESTREAM_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
