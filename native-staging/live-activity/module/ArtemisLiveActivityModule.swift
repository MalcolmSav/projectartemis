import ActivityKit
import ExpoModulesCore

// The JS-facing shape of TripActivityState (src/lib/liveActivity.ts).
struct TripStateRecord: Record {
  @Field var etaText: String = "—"
  @Field var endEpochSec: Double? = nil
  @Field var distanceText: String = ""
  @Field var progress: Double = 0
  @Field var buddyName: String = ""
  @Field var isFollowing: Bool = false
  @Field var status: String = "on_the_way"
}

public class ArtemisLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArtemisLiveActivity")

    // iOS 16.2+ and the user hasn't disabled Live Activities for the app.
    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    Function("start") { (destination: String, transport: String, state: TripStateRecord) -> String? in
      if #available(iOS 16.2, *) {
        // End any stale trip activity first so we never stack two cards.
        for activity in Activity<TripActivityAttributes>.activities {
          Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        let attributes = TripActivityAttributes(destination: destination, transport: transport)
        let content = ActivityContent(state: contentState(from: state), staleDate: nil)
        do {
          let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
          return activity.id
        } catch {
          return nil
        }
      }
      return nil
    }

    Function("update") { (id: String, state: TripStateRecord) in
      if #available(iOS 16.2, *) {
        let content = ActivityContent(state: contentState(from: state), staleDate: nil)
        Task {
          for activity in Activity<TripActivityAttributes>.activities where activity.id == id {
            await activity.update(content)
          }
        }
      }
    }

    Function("end") { (id: String) in
      if #available(iOS 16.2, *) {
        Task {
          for activity in Activity<TripActivityAttributes>.activities where activity.id == id {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
        }
      }
    }
  }

  @available(iOS 16.2, *)
  private func contentState(from s: TripStateRecord) -> TripActivityAttributes.ContentState {
    TripActivityAttributes.ContentState(
      etaText: s.etaText,
      endEpochSec: s.endEpochSec,
      distanceText: s.distanceText,
      progress: s.progress,
      buddyName: s.buddyName,
      isFollowing: s.isFollowing,
      status: s.status
    )
  }
}
