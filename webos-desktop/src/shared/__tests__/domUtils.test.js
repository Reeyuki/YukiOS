import { describe, it, expect, beforeEach } from "vitest";
import {
  $,
  $$,
  bindEvent,
  bindEvents,
  toggleClass,
  addClass,
  removeClass,
  setClasses,
  setStyle,
  setText,
  setHTML,
  createElement
} from "../domUtils.js";

describe("domUtils", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `<span id="a" class="foo">A</span><span id="b" class="bar">B</span>`;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("$", () => {
    it("queries a single element by selector", () => {
      const el = $("#a", container);
      expect(el).not.toBeNull();
      expect(el.textContent).toBe("A");
    });

    it("returns null for no match", () => {
      expect($("#z", container)).toBeNull();
    });

    it("handles null root gracefully", () => {
      expect($("div", null)).toBeNull();
    });
  });

  describe("$$", () => {
    it("queries all matching elements", () => {
      const items = $$("span", container);
      expect(items).toHaveLength(2);
    });

    it("returns empty array for no match", () => {
      expect($$("div", container)).toEqual([]);
    });

    it("handles null root gracefully", () => {
      expect($$("span", null)).toEqual([]);
    });
  });

  describe("bindEvent", () => {
    it("adds an event listener", () => {
      let called = false;
      const el = container.querySelector("#a");
      bindEvent(el, "click", () => {
        called = true;
      });
      el.click();
      expect(called).toBe(true);
    });

    it("handles null element", () => {
      expect(() => bindEvent(null, "click", () => {})).not.toThrow();
    });
  });

  describe("bindEvents", () => {
    it("adds multiple event listeners", () => {
      let clickCount = 0;
      let focusCount = 0;
      const el = container.querySelector("#a");
      bindEvents(el, {
        click: () => {
          clickCount++;
        },
        focus: () => {
          focusCount++;
        }
      });
      el.click();
      el.dispatchEvent(new Event("focus"));
      expect(clickCount).toBe(1);
      expect(focusCount).toBe(1);
    });

    it("handles null element", () => {
      expect(() => bindEvents(null, { click: () => {} })).not.toThrow();
    });
  });

  describe("toggleClass", () => {
    it("adds class when condition is true", () => {
      const el = container.querySelector("#a");
      toggleClass(el, "active", true);
      expect(el.classList.contains("active")).toBe(true);
    });

    it("removes class when condition is false", () => {
      const el = container.querySelector("#a");
      el.classList.add("active");
      toggleClass(el, "active", false);
      expect(el.classList.contains("active")).toBe(false);
    });

    it("handles null element", () => {
      expect(() => toggleClass(null, "x", true)).not.toThrow();
    });
  });

  describe("addClass / removeClass", () => {
    it("adds a class", () => {
      const el = container.querySelector("#a");
      addClass(el, "new-class");
      expect(el.classList.contains("new-class")).toBe(true);
    });

    it("removes a class", () => {
      const el = container.querySelector("#a");
      removeClass(el, "foo");
      expect(el.classList.contains("foo")).toBe(false);
    });

    it("handles null element", () => {
      addClass(null, "x");
      removeClass(null, "x");
    });
  });

  describe("setClasses", () => {
    it("sets the className", () => {
      const el = container.querySelector("#a");
      setClasses(el, "custom-class");
      expect(el.className).toBe("custom-class");
    });

    it("handles null element", () => {
      expect(() => setClasses(null, "x")).not.toThrow();
    });
  });

  describe("setStyle", () => {
    it("applies style object", () => {
      const el = container.querySelector("#a");
      setStyle(el, { color: "red", fontSize: "20px" });
      expect(el.style.color).toBe("red");
      expect(el.style.fontSize).toBe("20px");
    });

    it("handles null element", () => {
      expect(() => setStyle(null, { color: "red" })).not.toThrow();
    });
  });

  describe("setText", () => {
    it("sets textContent", () => {
      const el = container.querySelector("#a");
      setText(el, "Updated");
      expect(el.textContent).toBe("Updated");
    });

    it("handles null element", () => {
      expect(() => setText(null, "x")).not.toThrow();
    });
  });

  describe("setHTML", () => {
    it("sets innerHTML", () => {
      const el = container.querySelector("#a");
      setHTML(el, "<b>bold</b>");
      expect(el.innerHTML).toBe("<b>bold</b>");
    });

    it("handles null element", () => {
      expect(() => setHTML(null, "<b>x</b>")).not.toThrow();
    });
  });

  describe("createElement", () => {
    it("creates a basic element", () => {
      const el = createElement("div");
      expect(el.tagName).toBe("DIV");
    });

    it("creates with className", () => {
      const el = createElement("div", { className: "my-class" });
      expect(el.className).toBe("my-class");
    });

    it("creates with id", () => {
      const el = createElement("div", { id: "my-id" });
      expect(el.id).toBe("my-id");
    });

    it("creates with text content", () => {
      const el = createElement("span", { text: "Hello" });
      expect(el.textContent).toBe("Hello");
    });

    it("creates with HTML content", () => {
      const el = createElement("div", { html: "<b>bold</b>" });
      expect(el.innerHTML).toBe("<b>bold</b>");
    });

    it("creates with attributes", () => {
      const el = createElement("a", { attributes: { href: "#", "data-test": "val" } });
      expect(el.getAttribute("href")).toBe("#");
      expect(el.getAttribute("data-test")).toBe("val");
    });

    it("creates with styles", () => {
      const el = createElement("div", { styles: { color: "blue", marginTop: "10px" } });
      expect(el.style.color).toBe("blue");
      expect(el.style.marginTop).toBe("10px");
    });
  });
});
