import { describe, it, expect } from "vitest";
import {
  camelize,
  isImageFile,
  formatSize,
  pluralize,
  isArchiveFile,
  archiveBaseName,
  isTextFile,
  mimeFromExt,
  sanitizeTitle
} from "../utils.js";

describe("utils", () => {
  describe("camelize", () => {
    it("converts space-separated words to camelCase", () => {
      expect(camelize("hello world")).toBe("helloWorld");
    });

    it("preserves existing capital letters", () => {
      expect(camelize("HelloWorld")).toBe("helloWorld");
    });

    it("handles single word", () => {
      expect(camelize("hello")).toBe("hello");
    });

    it("handles empty string", () => {
      expect(camelize("")).toBe("");
    });
  });

  describe("isImageFile", () => {
    it("returns true for common image extensions", () => {
      expect(isImageFile("photo.png")).toBe(true);
      expect(isImageFile("photo.jpg")).toBe(true);
      expect(isImageFile("photo.jpeg")).toBe(true);
      expect(isImageFile("photo.gif")).toBe(true);
      expect(isImageFile("photo.webp")).toBe(true);
      expect(isImageFile("photo.svg")).toBe(true);
      expect(isImageFile("photo.ico")).toBe(true);
    });

    it("returns false for non-image files", () => {
      expect(isImageFile("doc.txt")).toBe(false);
      expect(isImageFile("script.js")).toBe(false);
      expect(isImageFile("noext")).toBe(false);
    });

    it("is case insensitive", () => {
      expect(isImageFile("photo.PNG")).toBe(true);
      expect(isImageFile("photo.JPG")).toBe(true);
    });
  });

  describe("formatSize", () => {
    it("formats bytes", () => {
      expect(formatSize(0)).toBe("0 B");
      expect(formatSize(512)).toBe("512 B");
    });

    it("formats kilobytes", () => {
      expect(formatSize(1024)).toBe("1.00 KB");
      expect(formatSize(1536)).toBe("1.50 KB");
    });

    it("formats megabytes", () => {
      expect(formatSize(1048576)).toBe("1.00 MB");
      expect(formatSize(1572864)).toBe("1.50 MB");
    });

    it("formats gigabytes", () => {
      expect(formatSize(1073741824)).toBe("1.00 GB");
    });
  });

  describe("pluralize", () => {
    it("returns singular when count is 1", () => {
      expect(pluralize(1, "file")).toBe("file");
    });

    it("returns plural when count is not 1", () => {
      expect(pluralize(0, "file")).toBe("files");
      expect(pluralize(2, "file")).toBe("files");
      expect(pluralize(100, "file")).toBe("files");
    });

    it("uses custom plural form", () => {
      expect(pluralize(2, "child", "children")).toBe("children");
      expect(pluralize(1, "child", "children")).toBe("child");
    });
  });

  describe("isArchiveFile", () => {
    it("returns true for archive extensions", () => {
      expect(isArchiveFile("archive.zip")).toBe(true);
      expect(isArchiveFile("archive.tar.gz")).toBe(true);
      expect(isArchiveFile("archive.7z")).toBe(true);
      expect(isArchiveFile("archive.rar")).toBe(true);
    });

    it("returns false for non-archive files", () => {
      expect(isArchiveFile("file.txt")).toBe(false);
      expect(isArchiveFile("file.js")).toBe(false);
    });
  });

  describe("archiveBaseName", () => {
    it("strips archive extension", () => {
      expect(archiveBaseName("project.tar.gz")).toBe("project");
      expect(archiveBaseName("data.zip")).toBe("data");
      expect(archiveBaseName("backup.7z")).toBe("backup");
    });

    it("returns same name if no archive extension", () => {
      expect(archiveBaseName("readme.txt")).toBe("readme.txt");
    });
  });

  describe("isTextFile", () => {
    it("returns true for text file extensions", () => {
      expect(isTextFile("readme.txt")).toBe(true);
      expect(isTextFile("index.html")).toBe(true);
      expect(isTextFile("style.css")).toBe(true);
      expect(isTextFile("app.js")).toBe(true);
      expect(isTextFile("data.json")).toBe(true);
      expect(isTextFile("config.yaml")).toBe(true);
    });

    it("returns false for non-text files", () => {
      expect(isTextFile("image.png")).toBe(false);
      expect(isTextFile("archive.zip")).toBe(false);
    });
  });

  describe("mimeFromExt", () => {
    it("returns correct mime types", () => {
      expect(mimeFromExt("png")).toBe("image/png");
      expect(mimeFromExt("jpg")).toBe("image/jpeg");
      expect(mimeFromExt("gif")).toBe("image/gif");
      expect(mimeFromExt("svg")).toBe("image/svg+xml");
    });

    it("returns default for unknown extensions", () => {
      expect(mimeFromExt("unknown")).toBe("image/png");
    });
  });

  describe("sanitizeTitle", () => {
    it("replaces [object Object] with Window", () => {
      expect(sanitizeTitle("[object Object]")).toBe("Window");
    });

    it("returns other titles unchanged", () => {
      expect(sanitizeTitle("My App")).toBe("My App");
      expect(sanitizeTitle("")).toBe("");
    });
  });
});
