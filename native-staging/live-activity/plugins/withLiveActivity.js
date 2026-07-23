const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins');

/**
 * Config plugin for the Artemis trip Live Activity.
 *
 * 1. Sets NSSupportsLiveActivities in the app Info.plist (required for ActivityKit).
 * 2. Adds the SHARED TripActivityAttributes.swift to the MAIN APP target's compile
 *    sources, so the app and the ArtemisWidget extension use the exact same type
 *    (ActivityKit matches activities by concrete type — a duplicated struct in two
 *    targets would NOT match).
 *
 * NOTE: `@bacons/expo-apple-targets` already compiles the shared file into the
 * widget target (it lives inside the target folder). This plugin covers the app
 * side. Verify the `sharedAttributesPath` below matches where you place the file
 * relative to the iOS project root after prebuild.
 */
const SHARED_ATTRIBUTES_PATH = 'ArtemisWidget/TripActivityAttributes.swift';

const withLiveActivityInfoPlist = (config) =>
  withInfoPlist(config, (c) => {
    c.modResults.NSSupportsLiveActivities = true;
    return c;
  });

const withSharedAttributesInAppTarget = (config) =>
  withXcodeProject(config, (c) => {
    const project = c.modResults;
    try {
      const appTarget = project.getFirstTarget();
      if (!appTarget) return c;
      // Add the shared attributes file to the app target's Sources build phase.
      // If it's already present (e.g. re-run), addSourceFile is a no-op-ish; guard anyway.
      const already = Object.values(project.pbxBuildFileSection?.() ?? {}).some(
        (bf) => typeof bf === 'object' && bf.fileRef_comment === 'TripActivityAttributes.swift',
      );
      if (!already) {
        project.addSourceFile(
          SHARED_ATTRIBUTES_PATH,
          { target: appTarget.uuid },
          project.findPBXGroupKey({ name: 'Artemis' }) || project.getFirstProject().firstProject.mainGroup,
        );
      }
    } catch (e) {
      // Surface but don't hard-fail prebuild — the README documents the manual step.
      console.warn('[withLiveActivity] could not add shared attributes to app target:', e.message);
    }
    return c;
  });

module.exports = (config) => withSharedAttributesInAppTarget(withLiveActivityInfoPlist(config));
