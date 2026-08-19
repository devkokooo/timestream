export interface DeviceLoginBegin {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
  clientIdConfigured: boolean;
}
