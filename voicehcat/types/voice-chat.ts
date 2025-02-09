export interface Message {
  type: string;
  roomId?: string;
  from?: string;
  to?: string;
  content?: any;
}

export interface DeviceInfo {
  deviceName: string;
  platform?: string;
  browser?: string;
}

export interface RoomUser {
  userId: string;
  username: string;
  device: string;
  isActive: boolean;
  joinedAt?: string;
  lastSeen?: string;
} 