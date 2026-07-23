import ActivityKit
import SwiftUI
import WidgetKit

// Artemis palette
private let kForest = Color(red: 0.18, green: 0.29, blue: 0.20)   // #2E4A33
private let kGold = Color(red: 0.79, green: 0.66, blue: 0.30)     // #C9A84C
private let kInk = Color(red: 0.95, green: 0.93, blue: 0.90)      // #F2EFE3
private let kBg = Color(red: 0.055, green: 0.039, blue: 0.075)    // #0E0A13

private func transportEmoji(_ t: String) -> String {
  switch t {
  case "bike": return "🚴"
  case "car": return "🚗"
  default: return "🚶"
  }
}

/// Native self-ticking countdown when we have an end time; otherwise the ETA text.
@ViewBuilder
private func etaView(_ state: TripActivityAttributes.ContentState, font: Font) -> some View {
  if let end = state.endEpochSec, end > Date().timeIntervalSince1970 {
    Text(timerInterval: Date()...Date(timeIntervalSince1970: end), countsDown: true)
      .font(font).monospacedDigit().foregroundColor(kGold)
  } else {
    Text(state.etaText).font(font).foregroundColor(kGold)
  }
}

struct TripLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TripActivityAttributes.self) { context in
      // ── Lock-screen / banner ──
      LockScreenCard(context: context)
        .activityBackgroundTint(kBg)
        .activitySystemActionForegroundColor(kGold)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text("🧭").font(.title2)
        }
        DynamicIslandExpandedRegion(.trailing) {
          etaView(context.state, font: .title3.weight(.semibold))
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.destination)
            .font(.headline).foregroundColor(kInk).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            ProgressView(value: context.state.progress)
              .tint(kGold)
            HStack {
              Text(context.state.distanceText)
                .font(.caption).foregroundColor(kInk.opacity(0.7))
              Spacer()
              if context.state.isFollowing {
                Text("👀 \(context.state.buddyName) is watching")
                  .font(.caption).foregroundColor(kGold)
              } else {
                Text("Sharing live location")
                  .font(.caption).foregroundColor(kInk.opacity(0.5))
              }
            }
          }
        }
      } compactLeading: {
        Text(transportEmoji(context.attributes.transport))
      } compactTrailing: {
        etaView(context.state, font: .caption.weight(.semibold))
      } minimal: {
        Text("🧭")
      }
      .keylineTint(kGold)
    }
  }
}

private struct LockScreenCard: View {
  let context: ActivityViewContext<TripActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 10) {
        Text(transportEmoji(context.attributes.transport)).font(.title2)
        VStack(alignment: .leading, spacing: 1) {
          Text("HEADING TO")
            .font(.system(size: 10, weight: .bold)).tracking(1.5)
            .foregroundColor(kGold.opacity(0.7))
          Text(context.attributes.destination)
            .font(.headline).foregroundColor(kInk).lineLimit(1)
        }
        Spacer()
        VStack(alignment: .trailing, spacing: 1) {
          etaView(context.state, font: .title2.weight(.semibold))
          Text(context.state.distanceText)
            .font(.caption2).foregroundColor(kInk.opacity(0.6))
        }
      }

      ProgressView(value: context.state.progress).tint(kGold)

      HStack(spacing: 6) {
        Circle()
          .fill(context.state.isFollowing ? kGold : kInk.opacity(0.4))
          .frame(width: 7, height: 7)
        Text(context.state.isFollowing
             ? "👀 \(context.state.buddyName) is watching"
             : "Sharing live location")
          .font(.caption).foregroundColor(kInk.opacity(0.8))
        Spacer()
        Text("Artemis").font(.system(size: 11, weight: .semibold)).tracking(1)
          .foregroundColor(kGold.opacity(0.7))
      }
    }
    .padding(16)
  }
}
