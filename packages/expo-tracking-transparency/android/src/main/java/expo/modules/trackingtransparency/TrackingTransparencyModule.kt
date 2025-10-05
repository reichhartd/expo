package expo.modules.trackingtransparency

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.android.gms.ads.identifier.AdvertisingIdClient
import com.google.android.gms.common.GoogleApiAvailabilityLight
import com.google.android.gms.common.ConnectionResult
import android.content.Context
import expo.modules.kotlin.exception.Exceptions

class TrackingTransparencyModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    // TODO: Rename the package to 'ExpoTracking'
    Name("ExpoTrackingTransparency")

    Function<Boolean>("isAvailable") {
      val apiAvailability = GoogleApiAvailabilityLight.getInstance()
      val resultCode = apiAvailability.isGooglePlayServicesAvailable(context)
      return@Function resultCode == ConnectionResult.SUCCESS
    }

    Function<String?>("getAdvertisingId") {
      return@Function AdvertisingIdClient.getAdvertisingIdInfo(context).id
    }

    AsyncFunction("getPermissionsAsync") { promise: Promise ->
      promise.resolve(getTrackingPermissions())
    }

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      promise.resolve(getTrackingPermissions())
    }
  }

  private fun getTrackingPermissions(): Map<String, Any> {
    return try {
      val isLimited = AdvertisingIdClient.getAdvertisingIdInfo(context).isLimitAdTrackingEnabled
      val status = if (isLimited) "denied" else "granted"

      mapOf(
        "status" to status,
        "expires" to "never"
        "granted" to !isLimited,
        "canAskAgain" to (status != "denied"),
      )
    } catch (e: Exception) {
      // Fallback: granted (Android default)
      mapOf(
        "status" to "granted",
        "expires" to "never"
        "granted" to true,
        "canAskAgain" to true,
      )
    }
  }
}
