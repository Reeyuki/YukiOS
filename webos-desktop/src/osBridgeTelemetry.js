/**
 * OS Bridge Telemetry Dashboard
 * Provides utilities to view and analyze legacy API usage during migration
 */

export function printTelemetryReport() {
  if (!window.osBridgeTelemetry) {
    console.error("OS Bridge telemetry not available. Make sure OS Bridge is initialized.");
    return;
  }

  const stats = window.osBridgeTelemetry.getStats();

  console.log("\n=== OS Bridge Telemetry Report ===\n");
  console.log(`Total Legacy API Calls: ${stats.totalCalls}`);
  console.log("\nCalls by API:");
  for (const [api, count] of Object.entries(stats.byAPI)) {
    console.log(`  ${api}: ${count}`);
  }
  console.log("\nCalls by Method:");
  for (const [method, count] of Object.entries(stats.byMethod)) {
    console.log(`  ${method}: ${count}`);
  }
  console.log("\nRecent Calls (last 20):");
  stats.recentCalls.forEach((call) => {
    const time = new Date(call.timestamp).toLocaleTimeString();
    console.log(`  [${time}] ${call.api}.${call.method}() from ${call.source || "unknown"}`);
  });
  console.log("\n=== End Report ===\n");
}

export function exportTelemetryData() {
  if (!window.osBridgeTelemetry) {
    console.error("OS Bridge telemetry not available.");
    return null;
  }

  const stats = window.osBridgeTelemetry.getStats();
  const data = {
    exportDate: new Date().toISOString(),
    summary: {
      totalCalls: stats.totalCalls,
      byAPI: stats.byAPI,
      byMethod: stats.byMethod
    },
    recentCalls: stats.recentCalls,
    allCalls: window.osBridgeTelemetry.getLegacyCalls()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `os-bridge-telemetry-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log("Telemetry data exported to JSON file.");
  return data;
}

export function clearTelemetryData() {
  if (!window.osBridgeTelemetry) {
    console.error("OS Bridge telemetry not available.");
    return;
  }

  window.osBridgeTelemetry.clearCalls();
  console.log("Telemetry data cleared.");
}

if (typeof window !== "undefined") {
  window.printOSBridgeReport = printTelemetryReport;
  window.exportOSBridgeTelemetry = exportTelemetryData;
  window.clearOSBridgeTelemetry = clearTelemetryData;
}
