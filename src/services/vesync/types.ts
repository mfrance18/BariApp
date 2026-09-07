export interface VeSyncCredentials {
  email: string;
  password: string;
}

export interface VeSyncSession {
  token: string;
  accountId: string;
  terminalId: string;
}

export interface VeSyncDevice {
  cid: string;
  uuid?: string;
  deviceName: string;
  deviceType: string;
  configModule: string;
}

export interface WeightReading {
  weightKg: number;
  timestamp: Date;
  bodyFatPct?: number;
  /** A stable id for this reading from VeSync, used to dedupe on sync. */
  externalId: string;
}
