export interface SshBinding {
  repo: string;
  remote: string;
  key: string;
}

export interface SshIdentity {
  path: string;
  label: string;
}

export interface AppSettings {
  version: number;
  github: {
    cloneProtocol: string;
  };
  ssh: {
    agentAutostart: boolean;
    defaultKey: string | null;
    bindings: SshBinding[];
    identities: SshIdentity[];
  };
  timeline: {
    enabled: boolean;
    showUpstreamRefs: boolean;
  };
}
