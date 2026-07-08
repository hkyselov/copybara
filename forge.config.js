import { ForgeUtils } from "@electron-forge/core";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const isRelease = process.env.BUILD_TYPE === "release";
// darwin builds (npm run mac → .dmg) are ad-hoc signed; only mas builds get MAS signing
const isMas = process.env.BUILD_PLATFORM !== "darwin";

// Ad-hoc signature ("-" identity): required for the app to launch on Apple Silicon,
// and keeps the fuses plugin from ad-hoc signing only the arm64 slice, which would
// make the universal merge fail on mismatched _CodeSignature files.
const darwinSigning = {
  osxSign: {
    identity: "-",
    identityValidation: false,
    // hardened runtime enforces library validation, which an ad-hoc (team-less)
    // process fails when loading the ad-hoc-signed Electron Framework
    optionsForFile: () => ({ hardenedRuntime: false }),
  },
};

const masSigning = {
  platform: "mas",
  osxSign: new ForgeUtils().fromBuildIdentifier({
    dev: {
      type: "development",
      platform: "mas",
      identity: "Apple Development: Hennadiy Kyselov (XUVC48L32A)",
      provisioningProfile: "Profile_Dev.provisionprofile",
      optionsForFile: (filePath) => {
        const entitlements = filePath.includes(".app/")
          ? "entitlements.mas.inherit.plist"
          : "entitlements.mas.plist";
        return {
          hardenedRuntime: true,
          entitlements,
        };
      },
    },
    release: {
      type: "distribution",
      platform: "mas",
      identity: "Apple Distribution: Hennadiy Kyselov (R3D94RCJ3N)",
      provisioningProfile: "Profile_Distribution.provisionprofile",
      optionsForFile: (filePath) => {
        const entitlements = filePath.includes(".app/")
          ? "entitlements.mas.inherit.plist"
          : "entitlements.mas.plist";
        return {
          hardenedRuntime: false,
          entitlements,
        };
      },
    },
  }),
};

export const packagerConfig = {
  buildIdentifier: isRelease ? "release" : "dev",
  asar: true,
  icon: "./src/images/iconTestNew",
  appBundleId: "com.copybara",
  appVersion: "1.0.1",
  buildVersion: "1.0.1",
  ...(isMas ? masSigning : darwinSigning),
};
export const rebuildConfig = {};
export const makers = [
  {
    name: "@electron-forge/maker-squirrel",
    config: {},
  },
  {
    name: "@electron-forge/maker-zip",
    platforms: ["mas"],
  },
  {
    name: "@electron-forge/maker-deb",
    config: {},
  },
  {
    name: "@electron-forge/maker-rpm",
    config: {},
  },
  {
    name: "@electron-forge/maker-pkg",
    platforms: ["mas"],
    config: {
      icon: "./src/images/iconTestNew.icns",
    },
  },
  {
    name: "@electron-forge/maker-dmg",
    config: {
      background: "./src/images/background.png",
      icon: "./src/images/iconTestNew.icns",
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
