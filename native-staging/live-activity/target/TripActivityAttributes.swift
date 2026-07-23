import ActivityKit
import Foundation

// SHARED TYPE — must be compiled into BOTH the ArtemisWidget target and the main
// app target so ActivityKit sees a single `TripActivityAttributes` type. See the
// README ("Step 4 — share the attributes type") for how both targets get it.
struct TripActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var etaText: String        // "21:30" or "—"
    var endEpochSec: Double?   // unix seconds; drives the self-ticking countdown
    var distanceText: String   // "1.2 km left" or ""
    var progress: Double       // 0.0 – 1.0 along the route
    var buddyName: String       // "Emma"
    var isFollowing: Bool       // 👀 buddy has opened the trip
    var status: String          // "on_the_way" | "arrived" | "escalated"
  }

  var destination: String       // "Södermalm"
  var transport: String         // "walk" | "bike" | "car"
}
