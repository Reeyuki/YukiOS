(function () {
  "use strict";

  var FILTER_URLS = [
    "https://ublockorigin.github.io/uAssets/filters/filters.txt",
    "https://ublockorigin.github.io/uAssets/filters/privacy.txt",
    "https://ublockorigin.github.io/uAssets/filters/badware.txt",
    "https://ublockorigin.github.io/uAssets/filters/unbreak.txt",
    "https://ublockorigin.github.io/uAssets/filters/quick-fixes.txt",
    "https://ublockorigin.github.io/uAssets/filters/resource-abuse.txt",
    "https://easylist.to/easylist/easylist.txt",
    "https://easylist.to/easylist/easyprivacy.txt",
    "https://easylist-downloads.adblockplus.org/easylist-cookie.txt",
    "https://easylist-downloads.adblockplus.org/easylist-annoyances.txt",
    "https://easylist-downloads.adblockplus.org/fanboy-social.txt"
  ];

  class AdBlockEngine {
    constructor() {
      this.blockFilters = [];
      this.whitelistFilters = [];
      this.blockedCount = 0;
      this.enabled = false;
      this.ready = false;
    }

    async init() {
      this.enabled = true;
      await this.loadFilters();
      this.ready = true;
    }

    async loadFilters() {
      this.blockFilters = [];
      this.whitelistFilters = [];

      var promises = FILTER_URLS.map(url => this.loadFilterList(url));

      if (Promise.allSettled) {
        await Promise.allSettled(promises);
      } else {
        await Promise.all(
          promises.map(p => p.catch(() => {}))
        );
      }
    }

    async loadFilterList(url) {
      try {
        var resp = await fetch(url, { cache: "force-cache" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);

        this.parseFilters(await resp.text());
      } catch {
        try {
          var resp = await fetch(url, { cache: "no-cache" });
          if (!resp.ok) throw new Error("HTTP " + resp.status);

          this.parseFilters(await resp.text());
        } catch {}
      }
    }

    parseFilters(text) {
      var lines = text.split("\n");

      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();

        if (!t) continue;
        if (t.charCodeAt(0) === 33) continue;
        if (t.charCodeAt(0) === 91) continue;
        if (t.includes("##") || t.includes("#@#")) continue;

        var result = this.compileFilter(t);

        if (result) {
          if (result.whitelist) {
            this.whitelistFilters.push(result.regex);
          } else {
            this.blockFilters.push(result.regex);
          }
        }
      }
    }

    escapeRegex(s) {
      return s
        .replace(/[.+?${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^ ]*?");
    }

    compileFilter(line) {
      var p = line;
      var whitelist = false;

      if (p.indexOf("@@") === 0) {
        whitelist = true;
        p = p.slice(2);
      }

      var optIdx = -1;

      for (var j = 0; j < p.length; j++) {
        if (p[j] === "$" && (j === 0 || p[j - 1] !== "\\")) {
          optIdx = j;
          break;
        }
      }

      if (optIdx > 0) {
        p = p.slice(0, optIdx);
      }

      if (p.includes("##") || p.includes("#@#")) return null;

      p = p.trim();
      if (!p) return null;

      var regex = "";

      if (p.startsWith("||")) {
        p = p.slice(2);

        var slashIdx = p.indexOf("/");
        var domainPart = slashIdx === -1 ? p : p.slice(0, slashIdx);
        var pathPart = slashIdx === -1 ? "" : p.slice(slashIdx);

        regex =
          "^(?:[a-z]+:)?(?:\\/\\/)?(?:[^\\/]*\\.)*" +
          this.escapeRegex(domainPart);

        if (pathPart) {
          regex += this.escapeRegex(pathPart);
        }

      } else if (p.startsWith("|")) {
        regex = "^" + this.escapeRegex(p.slice(1));

      } else if (p.endsWith("|")) {
        regex = this.escapeRegex(p.slice(0, -1)) + "$";

      } else {
        regex = this.escapeRegex(p);
      }

      try {
        return {
          regex: new RegExp(regex, "i"),
          whitelist
        };
      } catch {
        return null;
      }
    }

    shouldBlock(url) {
      if (!this.enabled || !this.blockFilters.length) {
        return false;
      }

      try {
        new URL(url);
      } catch {
        return false;
      }

      for (var filter of this.whitelistFilters) {
        if (filter.test(url)) {
          return false;
        }
      }

      for (var filter of this.blockFilters) {
        if (filter.test(url)) {
          this.blockedCount++;
          return true;
        }
      }

      return false;
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }
  }

  self.AdBlockEngine = AdBlockEngine;

})();