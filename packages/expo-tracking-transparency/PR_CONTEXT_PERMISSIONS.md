# PR Context: Android Permission Implementation

## Summary

This PR implements `getPermissionsAsync()` and `requestPermissionsAsync()` for Android in the `expo-tracking-transparency` package. The implementation maps `isLimitAdTrackingEnabled()` to Permission Response structure following Expo's standard patterns.

## Implementation Details

### Files Changed

1. **`android/src/main/java/expo/modules/trackingtransparency/TrackingTransparencyModule.kt`**
   - Added `getPermissionsAsync()` AsyncFunction
   - Added `requestPermissionsAsync()` AsyncFunction
   - Added `getTrackingPermissions()` helper method
   - Added `expo.modules.kotlin.Promise` import

2. **`android/build.gradle`**
   - Updated dependency: `play-services-ads-identifier` from `18.0.1` → `18.2.0`

### Core Logic

```kotlin
private fun getTrackingPermissions(): Map<String, Any> {
  return try {
    val isLimited = AdvertisingIdClient.getAdvertisingIdInfo(context).isLimitAdTrackingEnabled
    val status = if (isLimited) "denied" else "granted"

    mapOf(
      "status" to status,
      "granted" to !isLimited,
      "canAskAgain" to (status != "denied"),
      "expires" to "never"
    )
  } catch (e: Exception) {
    // Fallback: granted (Android default)
    mapOf(
      "status" to "granted",
      "granted" to true,
      "canAskAgain" to true,
      "expires" to "never"
    )
  }
}
```

## Design Decisions

### 1. AsyncFunction with Promise Pattern (NOT Coroutine)

**Chosen Pattern:**
```kotlin
AsyncFunction("getPermissionsAsync") { promise: Promise ->
  promise.resolve(getTrackingPermissions())
}
```

**Alternative Considered:**
```kotlin
AsyncFunction("getPermissionsAsync") Coroutine {
  withContext(Dispatchers.IO) {
    // ...
  }
}
```

**Why Promise Pattern:**
- ✅ Consistent with existing `getAdvertisingId()` implementation
- ✅ Simple and straightforward for this use case
- ✅ Matches pattern used in `expo-screen-capture` for similar non-Manifest permissions
- ✅ Threading issue acknowledged (same as existing `getAdvertisingId()`) - will be fixed in separate PR
- ✅ Statistics from codebase: 212 Promise-based vs 104 Coroutine-based AsyncFunctions

**Known Issue:** `AdvertisingIdClient.getAdvertisingIdInfo()` is a blocking I/O call (can take up to 10 seconds). This is a pre-existing issue also present in `getAdvertisingId()` and will be addressed in a future PR that refactors all functions to use Coroutines.

### 2. mapOf vs Record Data Class

**Chosen Pattern:**
```kotlin
mapOf(
  "status" to status,
  "granted" to !isLimited,
  "canAskAgain" to (status != "denied"),
  "expires" to "never"
)
```

**Alternative Considered:**
```kotlin
data class PermissionRequestResponse(
  @Field var status: String,
  @Field var granted: Boolean,
  @Field var canAskAgain: Boolean,
  @Field var expires: String
) : Record
```

**Why mapOf:**
- ✅ Standard pattern for custom permissions without Manifest entries
- ✅ Same approach used in `expo-screen-capture` (line 18-23)
- ✅ Simple response structure with only standard fields
- ✅ No need for Bundle conversion
- ✅ Record is only used when:
  - Converting from Bundle (from `Permissions.getPermissionsWithPermissionsManager()`)
  - Additional platform-specific fields needed (e.g., `expo-location` has `android.accuracy`)

### 3. canAskAgain Logic

**Chosen Pattern:**
```kotlin
"canAskAgain" to (status != "denied")
```

**Result:**
- `status = "granted"` → `canAskAgain = true`
- `status = "denied"` → `canAskAgain = false`

**Rationale:**

#### iOS Expo Core Convention
From `/packages/expo-modules-core/ios/Legacy/Services/Permissions/EXPermissionsService.m:142`:
```objective-c
BOOL canAskAgain = status != EXPermissionStatusDenied;
```

#### Cross-Platform Consistency
| Platform | Status | canAskAgain |
|----------|--------|-------------|
| iOS | `GRANTED` | `true` |
| iOS | `DENIED` | `false` |
| iOS | `UNDETERMINED` | `true` |
| **Android (our impl)** | `"granted"` | `true` ✅ |
| **Android (our impl)** | `"denied"` | `false` ✅ |

#### Semantic Correctness
The typical app pattern is:
```typescript
const { status, canAskAgain } = await getPermissionsAsync();

if (status !== 'granted') {
  if (canAskAgain) {
    await requestPermissionsAsync(); // Show dialog
  } else {
    Linking.openSettings(); // Can't ask → open Settings
  }
}
```

For our implementation:
- `denied` + `canAskAgain: false` → App opens Settings ✅
- `granted` + `canAskAgain: true` → No action needed ✅

#### Android shouldShowRequestPermissionRationale() Context

Android's standard `shouldShowRequestPermissionRationale()` returns:
- `false` - First request OR "Don't ask again" selected
- `true` - User denied without "Don't ask again"

**However**, this only applies to Manifest permissions. For custom permissions like Tracking Transparency (which uses Settings flag, not Manifest permission), we follow the iOS convention for consistency.

#### Research Notes

From GitHub Issues:
- [#11481](https://github.com/expo/expo/issues/11481): `canAskAgain` from Notifications.getPermissionsAsync is always true on Android
- [#19047](https://github.com/expo/expo/issues/19047): getForegroundPermissionsAsync returns `canAskAgain: false` even though location permission can be requested

These issues show that `canAskAgain` has platform-specific quirks, reinforcing the need for consistent cross-platform behavior.

### 4. Permission Mapping Logic

**Core Mapping:**
```kotlin
val isLimited = AdvertisingIdClient.getAdvertisingIdInfo(context).isLimitAdTrackingEnabled
val status = if (isLimited) "denied" else "granted"
```

| `isLimitAdTrackingEnabled` | Status | Granted | CanAskAgain |
|----------------------------|--------|---------|-------------|
| `true` (LAT enabled) | `"denied"` | `false` | `false` |
| `false` (LAT disabled) | `"granted"` | `true` | `true` |
| Exception (no GMS) | `"granted"` | `true` | `true` |

**Exception Handling:**
- If `AdvertisingIdClient.getAdvertisingIdInfo()` throws (e.g., no Google Play Services), return `"granted"`
- This is Android's default behavior - no LAT restriction = tracking allowed

**What We DON'T Check (KISS Principle):**
- ❌ No check if Advertising ID is "00000000-0000-0000-0000-000000000000"
- ❌ No `GoogleApiAvailability` check in permission functions
- ❌ No complex fallback logic
- ✅ Simple: LAT enabled = denied, LAT disabled = granted, Exception = granted

## TypeScript Integration

No changes needed in TypeScript! The implementation already works:

**Before (TypeScript):**
```typescript
export async function getTrackingPermissionsAsync(): Promise<PermissionResponse> {
  return ExpoTrackingTransparency.getPermissionsAsync();
}

export async function requestTrackingPermissionsAsync(): Promise<PermissionResponse> {
  return ExpoTrackingTransparency.requestPermissionsAsync();
}
```

These functions now properly call the Android native implementation instead of returning hardcoded values.

## Testing Scenarios

### Expected Behavior

1. **Normal Case (LAT disabled)**
   - Settings → Privacy → Ads → "Opt out of Ads Personalization" = OFF
   - Expected: `{ status: "granted", granted: true, canAskAgain: true }`

2. **LAT Enabled**
   - Settings → Privacy → Ads → "Opt out of Ads Personalization" = ON
   - Expected: `{ status: "denied", granted: false, canAskAgain: false }`

3. **No Google Play Services**
   - Device without GMS (e.g., some Chinese Android devices)
   - Expected: `{ status: "granted", granted: true, canAskAgain: true }` (fallback)

4. **Android 13+ AD_ID Permission**
   - Plugin already adds `com.google.android.gms.permission.AD_ID` automatically
   - No additional changes needed

### requestPermissionsAsync() Behavior

**Important:** On Android, `requestPermissionsAsync()` does NOT show a dialog. It simply returns the current permission state (same as `getPermissionsAsync()`).

This is because:
- Android has no "Tracking Transparency" permission dialog like iOS
- LAT is a user preference in Settings, not a permission
- Consistent with Web implementation (also returns without dialog)

## Cross-Platform Behavior Summary

| Platform | Permission Dialog | Permission Type | Default State |
|----------|------------------|-----------------|---------------|
| **iOS** | ✅ Yes | System Permission | `undetermined` → shows dialog |
| **Android** | ❌ No | Settings Flag | `granted` (no dialog) |
| **Web** | ❌ No | N/A | `granted` (not available) |

## Related Files for Reference

### Similar Implementations
- **expo-screen-capture** (`android/src/main/java/expo/modules/screencapture/ScreenCaptureModule.kt`)
  - Uses same `mapOf` pattern for permissions
  - Same `AsyncFunction { promise: Promise }` pattern
  - Lines 18-23: Permission map definition
  - Lines 63-73: `getPermissionsAsync` implementation

### Expo Core Permission Infrastructure
- **expo-modules-core** (`android/src/main/java/expo/modules/interfaces/permissions/PermissionsResponse.kt`)
  - Standard `PermissionsResponse` data class
  - Used by Manifest permission helpers only

- **expo-modules-core** (`android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt`)
  - Line 215-219: `canAskAgain()` implementation using `shouldShowRequestPermissionRationale()`
  - Only applicable to Manifest permissions

- **expo-modules-core** (`ios/Legacy/Services/Permissions/EXPermissionsService.m`)
  - Line 142: iOS `canAskAgain` convention: `status != EXPermissionStatusDenied`

### iOS Implementation
- **expo-tracking-transparency** (`ios/TrackingTransparencyModule.swift`)
  - Lines 21-28: `getPermissionsAsync` using `EXPermissionsMethodsDelegate`
  - Lines 31-39: `requestPermissionsAsync` using `EXPermissionsMethodsDelegate`
  - Uses iOS ATTrackingManager under the hood

## Known Issues & Future Work

### Threading Issue (Not Fixed in This PR)

**Current State:**
- Both `getAdvertisingId()` and the new permission functions use blocking I/O
- `AdvertisingIdClient.getAdvertisingIdInfo()` can block for up to 10 seconds

**Future Fix:**
```kotlin
AsyncFunction("getPermissionsAsync") Coroutine {
  return@Coroutine withContext(Dispatchers.IO) {
    getTrackingPermissions()
  }
}

AsyncFunction("getAdvertisingId") Coroutine {
  return@Coroutine withContext(Dispatchers.IO) {
    AdvertisingIdClient.getAdvertisingIdInfo(context).id
  }
}
```

**Why Not Fixed Here:**
- Scope: This PR focuses on adding Android permission support
- Consistency: Matches existing `getAdvertisingId()` implementation
- Separate Concern: Threading refactor should be its own PR affecting all blocking calls

## Breaking Changes

None. This PR adds new functionality that was previously stubbed out.

**Before:**
- `getPermissionsAsync()` - returned hardcoded `{ granted: true }` (from TypeScript)
- `requestPermissionsAsync()` - returned hardcoded `{ granted: true }` (from TypeScript)

**After:**
- `getPermissionsAsync()` - returns actual LAT status
- `requestPermissionsAsync()` - returns actual LAT status (no dialog shown)

## Checklist

- [x] Added Android implementation for `getPermissionsAsync()`
- [x] Added Android implementation for `requestPermissionsAsync()`
- [x] Updated dependency to latest stable version
- [x] Followed Expo coding patterns (AsyncFunction with Promise)
- [x] Cross-platform consistency (canAskAgain logic matches iOS)
- [x] Simple implementation (KISS principle)
- [x] No TypeScript changes needed (already compatible)
- [x] Plugin already adds required AD_ID permission

## References

- Android Advertising ID Documentation: https://developer.android.com/training/articles/ad-id
- Google Play Services Ads Identifier: https://developers.google.com/android/reference/com/google/android/gms/ads/identifier/AdvertisingIdClient
- Expo Permissions Guide: https://docs.expo.dev/guides/permissions/
