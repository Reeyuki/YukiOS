import { describe, it, expect } from "vitest";
import {
  SYSTEM_FOLDER,
  isSystemPath,
  toSystemRelPath,
  isLibraryFile,
  getManifestSize,
  mimeForPath,
  mergeListings
} from "../fs/SystemLibrary.js";

describe("SystemLibrary", () => {
  describe("SYSTEM_FOLDER", () => {
    it("names the system folder", () => {
      expect(SYSTEM_FOLDER).toBe("System");
    });
  });

  describe("isSystemPath", () => {
    it("matches the System folder itself", () => {
      expect(isSystemPath("/home/guest/System", "/home/guest")).toBe(true);
    });

    it("matches nested paths inside System", () => {
      expect(isSystemPath("/home/guest/System/apps/x.js", "/home/guest")).toBe(true);
    });

    it("rejects siblings sharing a name prefix", () => {
      expect(isSystemPath("/home/guest/Systematic", "/home/guest")).toBe(false);
    });

    it("rejects unrelated paths", () => {
      expect(isSystemPath("/home/guest/Desktop", "/home/guest")).toBe(false);
    });

    it("tolerates trailing slashes on path and root", () => {
      expect(isSystemPath("/home/guest/System/", "/home/guest/")).toBe(true);
      expect(isSystemPath("/home/guest/System/apps/x.js/", "/home/guest")).toBe(true);
      expect(isSystemPath("/home/guest/Systematic/", "/home/guest")).toBe(false);
    });
  });

  describe("toSystemRelPath", () => {
    it("returns an empty string for the System root itself", () => {
      expect(toSystemRelPath("/home/guest/System", "/home/guest")).toBe("");
    });

    it("returns the relative path for nested entries", () => {
      expect(toSystemRelPath("/home/guest/System/apps/explorer.js", "/home/guest")).toBe("apps/explorer.js");
    });

    it("ignores trailing slashes while resolving", () => {
      expect(toSystemRelPath("/home/guest/System/apps/x.js/", "/home/guest")).toBe("apps/x.js");
    });

    it("returns null for paths outside System", () => {
      expect(toSystemRelPath("/home/guest/Desktop", "/home/guest")).toBeNull();
      expect(toSystemRelPath("/home/guest/Systematic/apps/x.js", "/home/guest")).toBeNull();
    });
  });

  describe("mimeForPath", () => {
    it("maps javascript extensions to text/javascript", () => {
      expect(mimeForPath("main.js")).toBe("text/javascript");
      expect(mimeForPath("widget.mjs")).toBe("text/javascript");
      expect(mimeForPath("apps/explorer.JS")).toBe("text/javascript");
    });

    it("maps css files to text/css", () => {
      expect(mimeForPath("styles/style.css")).toBe("text/css");
    });

    it("falls back to application/octet-stream otherwise", () => {
      expect(mimeForPath("assets/logo.png")).toBe("application/octet-stream");
      expect(mimeForPath("README")).toBe("application/octet-stream");
    });
  });

  describe("mergeListings", () => {
    it("lets real entries win over same-name virtual entries", () => {
      const virtualMap = { "main.js": { type: "file", size: 100 } };
      const realMap = { "main.js": { type: "file", size: 999 } };
      const merged = mergeListings(virtualMap, realMap);
      expect(merged["main.js"].type).toBe("file");
      expect(merged["main.js"].size).toBe(999);
    });

    it("marks real file entries as overridden", () => {
      const virtualMap = { "main.js": { type: "file", size: 100, overridden: false } };
      const realMap = { "main.js": { type: "file", size: 999 } };
      const merged = mergeListings(virtualMap, realMap);
      expect(merged["main.js"].overridden).toBe(true);
    });

    it("leaves untouched virtual names intact", () => {
      const virtualMap = {
        "main.js": { type: "file", size: 100, overridden: false },
        "framework.js": { type: "file", size: 505, overridden: false }
      };
      const realMap = { "main.js": { type: "file", size: 999 } };
      const merged = mergeListings(virtualMap, realMap);
      expect(merged["framework.js"].size).toBe(505);
      expect(merged["framework.js"].overridden).toBe(false);
    });

    it("merges real directory entries without override marks", () => {
      const virtualMap = { apps: {} };
      const realMap = { apps: { type: "dir" } };
      const merged = mergeListings(virtualMap, realMap);
      expect(merged.apps.type).toBe("dir");
      expect(merged.apps.overridden).toBeUndefined();
    });
  });

  describe("manifest lookups", () => {
    it("treats top-level main.js as a library file", () => {
      expect(isLibraryFile("main.js")).toBe(true);
    });

    it("treats nested manifest paths as library files", () => {
      expect(isLibraryFile("apps/explorer.js")).toBe(true);
    });

    it("rejects unknown relative paths", () => {
      expect(isLibraryFile("does/not/exist.js")).toBe(false);
    });

    it("reports positive sizes for known manifest paths", () => {
      expect(getManifestSize("main.js")).toBeGreaterThan(0);
      expect(getManifestSize("apps/explorer.js")).toBeGreaterThan(0);
    });

    it("reports null sizes for unknown paths", () => {
      expect(getManifestSize("does/not/exist.js")).toBeNull();
    });
  });
});
