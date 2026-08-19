export interface SshKeyInfo {
  path: string;
  publicPath: string;
  comment: string;
  fingerprint: string;
}

export interface SshAgentStatus {
  running: boolean;
  serviceDisabled: boolean;
  hint: string | null;
  loadedFingerprints: string[];
}
