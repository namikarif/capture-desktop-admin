export interface DeviceState {
  id: string;
  isEnable: boolean;
  isLock: boolean;
  status: boolean;
}

export interface StreamData {
  buffer: Buffer;
  deviceId: string;
}
