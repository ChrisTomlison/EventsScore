// Placeholder UMD bundle for Relayer SDK
// This file enables local fallback loading when CDN is unavailable.
// It should be replaced with the actual UMD bundle if needed.
;(function () {
  if (typeof window !== "undefined") {
    window.relayerSDK = window.relayerSDK || {};
    window.relayerSDK.__initialized__ = window.relayerSDK.__initialized__ ?? false;
    window.relayerSDK.initSDK = window.relayerSDK.initSDK || function () {};
    window.relayerSDK.createInstance = window.relayerSDK.createInstance || function () {};
    window.relayerSDK.SepoliaConfig = window.relayerSDK.SepoliaConfig || {};
  }
})();


