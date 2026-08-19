export interface RemoteInfo {
  name: string;
  url: string;
  transport: string;
  host: string | null;
  owner: string | null;
  nameOnHost: string | null;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
  upstream: string | null;
}

export interface RemoteAuthArgs {
  path: string;
  remote?: string;
  keyPath?: string;
  passphrase?: string;
  rememberKey?: boolean;
  rememberDefault?: boolean;
  rememberPassphrase?: boolean;
}
