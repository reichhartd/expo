import { PermissionResponse, PermissionStatus } from 'expo-modules-core';

const webPermissionsResponse: PermissionResponse = {
  status: PermissionStatus.GRANTED,
  expires: 'never',
  granted: true,
  canAskAgain: true,
};

export default {
  isAvailable(): boolean {
    return false;
  },
  async getPermissionsAsync(): Promise<PermissionResponse> {
    return webPermissionsResponse;
  },
  async requestPermissionsAsync(): Promise<PermissionResponse> {
    return webPermissionsResponse;
  },
  getAdvertisingId(): string {
    return '00000000-0000-0000-0000-000000000000';
  },
};
