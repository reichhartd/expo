import { PermissionStatus } from 'expo-modules-core';
const webPermissionsResponse = {
    status: PermissionStatus.GRANTED,
    expires: 'never',
    granted: true,
    canAskAgain: true,
};
export default {
    isAvailable() {
        return false;
    },
    async getPermissionsAsync() {
        return webPermissionsResponse;
    },
    async requestPermissionsAsync() {
        return webPermissionsResponse;
    },
    getAdvertisingId() {
        return '00000000-0000-0000-0000-000000000000';
    },
};
//# sourceMappingURL=ExpoTrackingTransparency.web.js.map