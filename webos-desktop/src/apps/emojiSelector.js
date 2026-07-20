import "../styles/emojiSelector.css";
import { getLibraryUrl } from "../shared/cdnConfig.js";

import { BaseApp, os } from "../framework.js";
export class EmojiSelectorApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  async loadEmojiMart() {
    if (typeof window.EmojiMart !== "undefined") {
      return;
    }

    if (__SINGLE_FILE__) {
      return import("emoji-mart");
    }

    const scriptUrl = getLibraryUrl("emojiMart");
    if (!scriptUrl) {
      console.error("[EmojiSelector] Failed to resolve Emoji Mart CDN URL");
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async copyEmoji(emoji) {
    const value = emoji?.native;
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        this.updateClipboardHistory(value);
        return true;
      } catch (error) {
        console.warn("[EmojiSelector] Clipboard API failed:", error);
      }
    }

    const copied = this.copyEmojiWithSelection(value);
    this.updateClipboardHistory(value);
    return copied;
  }

  copyEmojiWithSelection(value) {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.readOnly = true;
    textArea.className = "emoji-selector-copy-buffer";
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, value.length);

    try {
      return document.execCommand("copy");
    } catch (error) {
      console.warn("[EmojiSelector] Selection copy failed:", error);
      return false;
    } finally {
      textArea.remove();
    }
  }

  updateClipboardHistory(value) {
    this.os.app.setClipboardContent(value);
  }

  showPreview(win, message) {
    const preview = win.querySelector('[ref="emoji-preview"]');
    if (!preview) return;

    clearTimeout(this.previewTimer);
    preview.textContent = message;
    preview.classList.add("visible");
    this.previewTimer = setTimeout(() => {
      preview.classList.remove("visible");
    }, 1500);
  }

  async initEmojiSelector(win) {
    await this.loadEmojiMart();

    if (typeof window.EmojiMart !== "undefined") {
      const picker = new window.EmojiMart.Picker({
        onEmojiSelect: async (emoji) => {
          const copied = await this.copyEmoji(emoji);
          const label = copied ? "Copied" : "Saved";
          this.showPreview(win, `${label}: ${emoji.native}`);
        },
        theme: "dark",
        set: "native",
        skinTonePosition: "search",
        previewPosition: "none",
        className: "emoji-mart-picker"
      });

      const container = win.querySelector("#emoji-mart-container");
      if (container) {
        container.appendChild(picker);
      }
    }
  }

  open() {
    const win = os.window.create("emoji-selector-window", "Emoji Selector", "355px", "500px", {
      icon: "fas fa-face-smile",
      appId: "emojiSelectorApp"
    });
    win.innerHTML = `
      <div class="emoji-selector-container">
        <div id="emoji-mart-container" class="emoji-mart-container"></div>
        <div class="emoji-preview"></div>
      </div>
    `;
    this.initEmojiSelector(win);
    return win;
  }

  onClose(winId) {}
}
