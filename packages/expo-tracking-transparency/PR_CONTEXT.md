# PR Context: Add `isAvailable()` function to TrackingTransparency module

## Summary

This PR adds native `isAvailable()` implementations to the `expo-tracking-transparency` module to properly detect tracking functionality availability on each platform.

## Motivation

The `isAvailable()` function previously only checked if the native module exists (via `Boolean(ExpoTrackingTransparency)`), which was inadequate because:

1. **Module Evolution**: The package has evolved from iOS-only permissions (v1.0) to cross-platform tracking (permissions + advertising ID)
2. **Incorrect Old Logic**: The old implementation returned `true` on all platforms where the module was loaded, regardless of actual platform capabilities
3. **User Expectations**: Users need to know if tracking functionality (permissions and/or advertising ID) is actually available on their device

## Changes Made

### 1. iOS (Swift) - `/ios/TrackingTransparencyModule.swift`

```swift
Function("isAvailable") { () -> Bool in
    return true
}
```

**Rationale:**
- ATTrackingManager API is available on ALL supported iOS versions (15.1+)
- Both permission API and advertising ID functionality work
- Simulator: Permission API works, advertising ID returns `null` (expected behavior, documented)
- Returns `true` because the API is available, even if advertising ID returns `null` in simulator

### 2. Android (Kotlin) - `/android/.../TrackingTransparencyModule.kt`

```kotlin
Function<Boolean>("isAvailable") {
    return@Function true
}
```

**Rationale:**
- Originally tried `AdvertisingIdClient.isAdvertisingIdProviderAvailable(context)`
- Changed to `true` for consistency because:
  - Android has NO Tracking Transparency Permission API (auto-granted)
  - Advertising ID is the primary functionality on Android
  - Known issue: `isAdvertisingIdProviderAvailable()` can return false even when provider IS available
  - Consistent with iOS approach: API is "available" on the platform

**Note:** There's a threading issue with `getAdvertisingId()` that will be addressed in a separate PR (it needs to be `AsyncFunction` with `Coroutine`).

### 3. Web (TypeScript) - `/src/ExpoTrackingTransparency.web.ts`

```typescript
export default {
  isAvailable(): boolean {
    return false;
  },
};
```

**Rationale:**
- No tracking APIs available on Web
- No permission API, no advertising ID

### 4. TypeScript - `/src/TrackingTransparency.ts`

**Old:**
```typescript
export function isAvailable(): boolean {
  return Boolean(ExpoTrackingTransparency); // Just checks if module exists
}
```

**New:**
```typescript
export function isAvailable(): boolean {
  return ExpoTrackingTransparency.isAvailable(); // Delegates to native
}
```

**JSDoc updated** to reflect:
- Tracking functionality (permissions OR advertising ID) availability
- Platform-specific behavior
- iOS 15.1+ requirement
- Android provider availability
- Web always returns false

## Design Decisions

### What does "available" mean?

After thorough analysis of other Expo modules (Pedometer, SMS, StoreReview, AppleAuthentication), we defined `isAvailable()` as:

**"Is the tracking API available on this platform?"** NOT "Will I get a non-null value?"

This means:
- `isAvailable()` returns `true` if the **API exists and can be called**
- It does NOT guarantee non-null results (e.g., advertising ID can still be `null` due to permissions)
- Consistent with other Expo modules that check API availability, not result availability

### Why `true` on iOS simulator?

1. **Permission API works** fully in simulator
2. **Advertising ID returns `null`** in simulator - this is **expected and documented** behavior
3. **Users must handle `null` anyway** (due to permission denial on real devices)
4. **No breaking change** for existing users testing permissions
5. **Consistent with other modules** (AppleAuthentication also returns `true` in simulator)

### Why `true` on Android (final decision)?

1. **Advertising ID is the primary feature** on Android (no permission API)
2. **Consistency with iOS**: Both platforms return `true` when ANY tracking functionality works
3. **`isAdvertisingIdProviderAvailable()` is unreliable**: Known to return false even when provider exists
4. **Module evolution**: Package is becoming `ExpoTracking` (see TODO comments) - not just permissions

## Breaking Changes

**YES - Minor Breaking Change:**

**Before:**
```typescript
// Android
TrackingTransparency.isAvailable() // → depends on module loading
```

**After:**
```typescript
// Android
TrackingTransparency.isAvailable() // → true (if tracking works)
```

**Impact:**
- Users checking `isAvailable()` on Android will now get `true` instead of checking module existence
- Permission methods already return `granted` automatically on Android, so no crashes
- This is a "safe" breaking change that makes the API more accurate

## Related Context

### Module History

1. **v1.0 (2021)**: iOS-only, permission-focused (`expo-tracking-transparency`)
2. **v5.2+ (PR #24777)**: Added `getAdvertisingId()` for Android and iOS
3. **v6.0+ (PR #39652)**: Docs updated from "iOS 14.5 permissions" to "tracking functionality"
4. **Future**: Planned rename to `ExpoTracking` (see TODO comments in code)

### Key PRs

- **#12962**: Original `isAvailable()` implementation (checked module existence + iOS version)
- **#24777**: Added `getAdvertisingId()` - expanded scope beyond permissions
- **#39652**: Updated docs to reflect "tracking functionality" focus

### Platform Behavior Table

| Platform | `isAvailable()` | Permission API | Advertising ID | Notes |
|----------|----------------|----------------|----------------|-------|
| **iOS Real Device** | `true` | ✅ Works | ✅ Works (with permission) | Full functionality |
| **iOS Simulator** | `true` | ✅ Works | ❌ Returns `null` | Expected, documented |
| **Android** | `true` | ❌ Auto-granted | ✅ Works | No permission dialog |
| **Web** | `false` | ❌ N/A | ❌ N/A | No tracking APIs |

## Known Issues (Future PRs)

### Android Threading Issue (NOT fixed in this PR)

**Problem:**
```kotlin
Function("getAdvertisingId") {  // ❌ Synchronous!
  return@Function AdvertisingIdClient.getAdvertisingIdInfo(context).id  // BLOCKS 10 seconds!
}
```

**Fix needed:**
```kotlin
AsyncFunction("getAdvertisingId") Coroutine {
  return@Coroutine AdvertisingIdClient.getAdvertisingIdInfo(context).id
}
```

**Why not fixed here:** This PR focuses only on `isAvailable()` logic. The threading fix requires API changes and should be a separate PR.

## Testing Notes

### iOS
- ✅ Real device: Both permissions and advertising ID work
- ✅ Simulator: Permissions work, advertising ID returns `null` (expected)

### Android
- ⚠️ Test on device with Google Play Services
- ⚠️ Test that `isAvailable()` returns `true`
- ⚠️ Note: `getAdvertisingId()` has threading issue (separate PR needed)

### Web
- ✅ Returns `false`

## Files Changed

- `ios/TrackingTransparencyModule.swift` - Added `isAvailable()` function
- `android/src/main/java/expo/modules/trackingtransparency/TrackingTransparencyModule.kt` - Added `isAvailable()` function
- `src/ExpoTrackingTransparency.web.ts` - Added `isAvailable()` function
- `src/TrackingTransparency.ts` - Updated to delegate to native, updated JSDoc
- `CHANGELOG.md` - (needs update with breaking change note)

## Changelog Entry (to add)

```markdown
### 🛠 Breaking changes

- `isAvailable()` now returns platform-specific availability instead of just checking if the native module exists. On Android, it now returns `true` when tracking functionality is available. On iOS, it returns `true` on all supported versions (iOS 15.1+). ([#XXXXX](link) by [@reichhartd](link))
```

## Documentation Considerations

The JSDoc has been updated following Expo Documentation Style Guide:
- Third-person declarative tense
- Platform-specific behavior clearly documented
- Platform order: Android, iOS, Web
- Clear explanation of what "available" means
- Notes about permission API auto-granting on non-iOS platforms
