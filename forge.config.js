import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

export const packagerConfig = {
  asar: true,
  icon: "./src/images/icon",
  appBundleId: "com.copybara",
  appVersion: "1.0.1",
  buildVersion: "1.0.1",
  // Ad-hoc signature ("-" identity): required for the app to launch on Apple Silicon,
  // and keeps the fuses plugin from ad-hoc signing only the arm64 slice, which would
  // make the universal merge fail on mismatched _CodeSignature files.
  osxSign: {
    identity: "-",
    identityValidation: false,
    // hardened runtime enforces library validation, which an ad-hoc (team-less)
    // process fails when loading the ad-hoc-signed Electron Framework
    optionsForFile: () => ({ hardenedRuntime: false }),
  },
};
export const rebuildConfig = {};
export const makers = [
  {
    name: "@electron-forge/maker-dmg",
    config: {
      background: "./src/images/background.png",
      icon: "./src/images/icon.icns",
      format: "ULFO",
      additionalDMGOptions: {
        window: {
          size: { width: 658, height: 530 },
        },
      },
    },
  },
];
export const plugins = [
  {
    name: "@electron-forge/plugin-auto-unpack-natives",
    config: {},
  },
  // Fuses are used to enable/disable various Electron functionality
  // at package time, before code signing the application
  new FusesPlugin({
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  }),
];
