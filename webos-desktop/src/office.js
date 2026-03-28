/* eslint-disable no-unused-vars */
import { desktop } from "./desktop.js";
import { speak } from "./clippy.js";
import { FileKind } from "./fs.js";
class OfficeModuleLoader {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
  }

  loadScript(url) {
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url);
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  loadStylesheet(url) {
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url);
    }

    const promise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(link);
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  async mammoth() {
    if (this.cache.has("mammoth")) return this.cache.get("mammoth");

    await this.loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.12.0/mammoth.browser.min.js");
    const mod = window.mammoth;
    this.cache.set("mammoth", mod);
    return mod;
  }

  async xlsx() {
    if (this.cache.has("xlsx")) return this.cache.get("xlsx");

    await this.loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
    const mod = window.XLSX;
    this.cache.set("xlsx", mod);
    return mod;
  }

  async handsontable() {
    if (this.cache.has("handsontable")) return this.cache.get("handsontable");

    await Promise.all([
      this.loadScript("https://cdn.jsdelivr.net/npm/handsontable@12.4.0/dist/handsontable.full.min.js"),
      this.loadStylesheet("https://cdn.jsdelivr.net/npm/handsontable@12.4.0/dist/handsontable.full.min.css")
    ]);

    const mod = window.Handsontable;
    this.cache.set("handsontable", mod);
    return mod;
  }

  async pdfjs() {
    if (this.cache.has("pdfjs")) return this.cache.get("pdfjs");

    await Promise.all([
      this.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"),
      this.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/web/pdf_viewer.min.js"),
      this.loadStylesheet("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/web/pdf_viewer.min.css")
    ]);

    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

    this.cache.set("pdfjs", pdfjs);
    this.cache.set("pdfjsViewer", window.pdfjsViewer);
    return pdfjs;
  }

  async pdfjsViewer() {
    if (!this.cache.has("pdfjsViewer")) {
      await this.pdfjs();
    }
    return this.cache.get("pdfjsViewer");
  }

  async jszip() {
    if (this.cache.has("jszip")) return this.cache.get("jszip");

    await this.loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
    const mod = window.JSZip;
    this.cache.set("jszip", mod);
    return mod;
  }

  async docx() {
    if (this.cache.has("docx")) return this.cache.get("docx");

    await this.loadScript("https://cdn.jsdelivr.net/npm/docx@9.6.1/build/index.js");
    const mod = window.docx;
    this.cache.set("docx", mod);
    return mod;
  }
}
const modules = new OfficeModuleLoader();

const FileUtils = {
  getExtension(fileName) {
    if (!fileName) return "";
    const parts = fileName.split(".");
    return parts.length < 2 ? "" : "." + parts.pop().toLowerCase();
  },

  escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  },

  escapeXml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  },

  mimeForExtension(ext) {
    const mimeMap = {
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".odt": "application/vnd.oasis.opendocument.text",
      ".pdf": "application/pdf",
      ".odp": "application/vnd.oasis.opendocument.presentation",
      ".csv": "text/csv",
      ".txt": "text/plain",
      ".html": "text/html"
    };
    return mimeMap[ext] || "application/octet-stream";
  },

  isBinaryExtension(ext) {
    const binaryExts = [".docx", ".xlsx", ".xls", ".odt", ".pdf", ".odp"];
    return binaryExts.includes(ext);
  },

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  },

  arrayBufferToDataUrl(buffer, mimeType) {
    const base64 = this.arrayBufferToBase64(buffer);
    return `data:${mimeType};base64,${base64}`;
  },

  isBase64(str) {
    if (!str || typeof str !== "string") return false;

    const base64Regex = /^[A-Za-z0-9+/]+=*$/;

    return str.length > 100 && base64Regex.test(str.replace(/\s/g, ""));
  },

  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  },
  async toArrayBuffer(content) {
    if (content instanceof ArrayBuffer) return content;
    if (content instanceof Uint8Array) return content.buffer;
    if (content instanceof Blob) return content.arrayBuffer();
    if (typeof content === "string") {
      if (content.startsWith("data:")) {
        const resp = await fetch(content);
        return resp.arrayBuffer();
      }
      return new TextEncoder().encode(content).buffer;
    }
    return null;
  },

  colLabel(i) {
    let l = "",
      n = i;
    while (n >= 0) {
      l = String.fromCharCode((n % 26) + 65) + l;
      n = Math.floor(n / 26) - 1;
    }
    return l;
  },

  odpUnitToPx(val) {
    if (!val) return 0;
    const num = parseFloat(val);
    if (val.endsWith("cm")) return num * 37.795;
    if (val.endsWith("mm")) return num * 3.7795;
    if (val.endsWith("in")) return num * 96;
    if (val.endsWith("pt")) return num * 1.333;
    return num;
  }
};

class FileIO {
  static triggerUpload(multiple = false) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = multiple;
      input.accept = ".docx,.xlsx,.xls,.csv,.odt,.pdf,.odp,.txt,.html";
      input.style.display = "none";

      input.addEventListener("change", async () => {
        const files = Array.from(input.files);
        if (files.length === 0) {
          resolve([]);
          input.remove();
          return;
        }

        const results = [];
        for (const file of files) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            results.push({ name: file.name, arrayBuffer });
          } catch (error) {
            console.error(`Error reading file ${file.name}:`, error);
          }
        }

        resolve(results);
        input.remove();
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  static triggerDownload(fileName, data) {
    let blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      const ext = FileUtils.getExtension(fileName);
      blob = new Blob([data], { type: FileUtils.mimeForExtension(ext) });
    } else if (typeof data === "string") {
      blob = new Blob([data], { type: "text/plain" });
    } else {
      blob = new Blob([data]);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }
}

class OdfStyleParser {
  static collectStyles(xmlStrings, extraGraphicProps = false) {
    const map = {};
    const allowedProps = [
      "font-weight",
      "font-style",
      "font-size",
      "color",
      "text-align",
      "margin-left",
      "margin-bottom",
      "margin-top",
      "background-color"
    ];
    for (const xml of xmlStrings) {
      if (!xml) continue;
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const styles = doc.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:style:1.0", "style");
      for (let i = 0; i < styles.length; i++) {
        const s = styles[i];
        const name = s.getAttribute("style:name");
        if (!name) continue;
        const css = {};
        const props = s.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0", "*");
        for (let j = 0; j < props.length; j++) {
          for (let a = 0; a < props[j].attributes.length; a++) {
            const attr = props[j].attributes[a];
            if (allowedProps.includes(attr.localName)) css[attr.localName] = attr.value;
          }
        }
        const tp = s.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:style:1.0", "text-properties");
        for (let j = 0; j < tp.length; j++) {
          if (tp[j].getAttribute("style:text-underline-style") === "solid") css["text-decoration"] = "underline";
          if (tp[j].getAttribute("style:font-name")) css["font-family"] = tp[j].getAttribute("style:font-name");
        }
        if (extraGraphicProps) {
          const gp = s.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:style:1.0", "graphic-properties");
          for (let j = 0; j < gp.length; j++) {
            if (gp[j].getAttribute("draw:fill-color")) css["background-color"] = gp[j].getAttribute("draw:fill-color");
          }
        }
        map[name] = css;
      }
    }
    return map;
  }

  static styleStringFor(name, map) {
    if (!name || !map[name]) return "";
    return Object.entries(map[name])
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  }
}

class OdfMediaLoader {
  static async loadPictures(zip) {
    const images = {};
    const folder = zip.folder("Pictures");
    if (!folder) return images;
    const entries = [];
    folder.forEach((rp, file) => entries.push({ rp, file }));
    for (const e of entries) {
      const blob = await e.file.async("blob");
      images["Pictures/" + e.rp] = URL.createObjectURL(blob);
    }
    return images;
  }
}

class HtmlConverter {
  static async toOdtBlob(html) {
    const JSZip = await modules.jszip();
    const zip = new JSZip();
    zip.file("mimetype", "application/vnd.oasis.opendocument.text", {
      compression: "STORE"
    });
    zip.file(
      "META-INF/manifest.xml",
      `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`
    );
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    let odtText = "";
    const walkOdt = (node) => {
      if (node.nodeType === 3) return FileUtils.escapeXml(node.textContent);
      if (node.nodeType !== 1) return "";
      const tag = node.tagName.toLowerCase();
      let inner = "";
      for (const c of node.childNodes) inner += walkOdt(c);
      if (tag === "p" || tag === "div") return `<text:p>${inner}</text:p>`;
      if (tag.match(/^h[1-6]$/)) return `<text:h text:outline-level="${tag[1]}">${inner}</text:h>`;
      if (tag === "ul" || tag === "ol") return `<text:list>${inner}</text:list>`;
      if (tag === "li") return `<text:list-item><text:p>${inner}</text:p></text:list-item>`;
      if (tag === "br") return `<text:line-break/>`;
      if (["b", "strong", "i", "em", "span", "u"].includes(tag)) return `<text:span>${inner}</text:span>`;
      return inner;
    };
    for (const c of tempDiv.childNodes) odtText += walkOdt(c);
    if (!odtText) odtText = `<text:p>${FileUtils.escapeXml(tempDiv.textContent || "")}</text:p>`;
    zip.file(
      "content.xml",
      `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${odtText}</office:text></office:body></office:document-content>`
    );
    const blob = await zip.generateAsync({ type: "blob" });
    return new Uint8Array(await blob.arrayBuffer());
  }

  static async toDocxParagraphs(html) {
    const { Paragraph, TextRun, HeadingLevel, UnderlineType } = await modules.docx();

    const div = document.createElement("div");
    div.innerHTML = html;
    const paras = [];
    const headingMap = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6
    };
    const extractRuns = (node) => {
      const runs = [];
      const walk = (el, st) => {
        if (el.nodeType === 3) {
          if (el.textContent) {
            const o = { text: el.textContent };
            if (st.b) o.bold = true;
            if (st.i) o.italics = true;
            if (st.u) o.underline = { type: UnderlineType.SINGLE };
            if (st.s) o.strike = true;
            runs.push(new TextRun(o));
          }
          return;
        }
        if (el.nodeType !== 1) return;
        const t = el.tagName.toLowerCase();
        const ns = { ...st };
        if (t === "b" || t === "strong") ns.b = true;
        if (t === "i" || t === "em") ns.i = true;
        if (t === "u") ns.u = true;
        if (t === "s" || t === "strike" || t === "del") ns.s = true;
        for (const c of el.childNodes) walk(c, ns);
      };
      walk(node, { b: false, i: false, u: false, s: false });
      return runs;
    };
    const process = (node) => {
      if (node.nodeType === 3) {
        if (node.textContent.trim()) paras.push(new Paragraph({ children: [new TextRun(node.textContent)] }));
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "p" || tag === "div") paras.push(new Paragraph({ children: extractRuns(node) }));
      else if (tag.match(/^h[1-6]$/))
        paras.push(
          new Paragraph({
            children: extractRuns(node),
            heading: headingMap[parseInt(tag[1])]
          })
        );
      else if (tag === "ul" || tag === "ol") {
        for (const li of node.children)
          if (li.tagName.toLowerCase() === "li")
            paras.push(
              new Paragraph({
                children: extractRuns(li),
                bullet: tag === "ul" ? { level: 0 } : undefined
              })
            );
      } else for (const c of node.childNodes) process(c);
    };
    for (const c of div.childNodes) process(c);
    if (!paras.length) paras.push(new Paragraph({ children: [new TextRun(div.textContent || "")] }));
    return paras;
  }
}

class RichTextEditor {
  static init(container, htmlContent, state) {
    const toolbar = document.createElement("div");
    toolbar.className = "office-toolbar";
    const btns = [
      { label: "B", cmd: "bold", cls: "office-toolbar__btn--bold" },
      { label: "I", cmd: "italic", cls: "office-toolbar__btn--italic" },
      { label: "U", cmd: "underline", cls: "office-toolbar__btn--underline" },
      { label: "S", cmd: "strikeThrough", cls: "office-toolbar__btn--strike" },
      { label: "UL", cmd: "insertUnorderedList", cls: "" },
      { label: "OL", cmd: "insertOrderedList", cls: "" },
      { label: "←", cmd: "justifyLeft", cls: "" },
      { label: "↔", cmd: "justifyCenter", cls: "" },
      { label: "→", cmd: "justifyRight", cls: "" }
    ];
    const editorDiv = document.createElement("div");
    editorDiv.className = "office-richtext-editor";
    editorDiv.contentEditable = "true";
    editorDiv.innerHTML = htmlContent || "";
    btns.forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      btn.title = b.cmd;
      btn.className = `office-toolbar__btn ${b.cls}`;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.execCommand(b.cmd, false, null);
        editorDiv.focus();
      });
      toolbar.appendChild(btn);
    });
    const fontSelect = document.createElement("select");
    fontSelect.className = "office-toolbar__select";
    ["Serif", "Sans-Serif", "Monospace", "Arial", "Georgia", "Times New Roman", "Courier New"].forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      fontSelect.appendChild(opt);
    });
    fontSelect.addEventListener("change", () => {
      document.execCommand("fontName", false, fontSelect.value);
      editorDiv.focus();
    });
    toolbar.appendChild(fontSelect);
    const sizeSelect = document.createElement("select");
    sizeSelect.className = "office-toolbar__select";
    [1, 2, 3, 4, 5, 6, 7].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s * 4 + 8 + "px";
      if (s === 3) opt.selected = true;
      sizeSelect.appendChild(opt);
    });
    sizeSelect.addEventListener("change", () => {
      document.execCommand("fontSize", false, sizeSelect.value);
      editorDiv.focus();
    });
    toolbar.appendChild(sizeSelect);
    container.appendChild(toolbar);
    container.appendChild(editorDiv);
    state.editor = editorDiv;
    state.editorType = "contenteditable";
  }
}

class EditorStrategy {
  canHandle() {
    return false;
  }
  async init() {}
}

class SpreadsheetEditor extends EditorStrategy {
  canHandle(ext) {
    return [".xlsx", ".xls", ".csv"].includes(ext);
  }

  async init(container, arrayBuffer, state) {
    const XLSX = await modules.xlsx();

    let buffer = arrayBuffer;
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      console.warn("SpreadsheetEditor: Invalid buffer, creating empty workbook");
      buffer = null;
    }

    let workbook;
    if (buffer && buffer.byteLength > 0) {
      try {
        const uint8 = new Uint8Array(buffer);
        console.log("Reading XLSX, buffer size:", uint8.byteLength);
        workbook = XLSX.read(uint8, { type: "array" });
      } catch (e) {
        console.error("XLSX read error:", e);
        workbook = this.createEmptyWorkbook(XLSX);
      }
    } else {
      workbook = this.createEmptyWorkbook(XLSX);
    }

    state.workbook = workbook;
    state.activeSheet = workbook.SheetNames[0];

    if (await this.tryHandsontable(container, workbook, state, XLSX)) {
      return;
    }

    this.renderSheet(container, workbook, state, XLSX);
  }

  createEmptyWorkbook(XLSX) {
    const wb = XLSX.utils.book_new();
    const emptyData = Array.from({ length: 50 }, () => Array(26).fill(""));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(emptyData), "Sheet1");
    return wb;
  }

  async tryHandsontable(container, workbook, state, XLSX) {
    try {
      const Handsontable = await modules.handsontable();

      const ws = workbook.Sheets[state.activeSheet];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      while (data.length < 50) data.push([]);
      data.forEach((row) => {
        while (row.length < 26) row.push("");
      });

      container.innerHTML = `
        <div class="office-sheet-wrapper">
          ${this.renderSheetTabs(workbook, state)}
          <div class="office-handsontable-container"></div>
        </div>
      `;

      const hotContainer = container.querySelector(".office-handsontable-container");

      state.hot = new Handsontable(hotContainer, {
        data: data,
        rowHeaders: true,
        colHeaders: true,
        contextMenu: true,
        manualColumnResize: true,
        manualRowResize: true,
        width: "100%",
        height: container.clientHeight - 40,
        stretchH: "all",
        licenseKey: "non-commercial-and-evaluation",
        afterChange: (changes) => {
          if (changes) {
            this.syncHotToWorkbook(state, XLSX);
          }
        }
      });

      container.querySelectorAll(".office-sheet-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          state.activeSheet = tab.dataset.sheet;
          this.tryHandsontable(container, workbook, state, XLSX);
        });
      });

      state.editor = state.hot;
      state.editorType = "spreadsheet";
      return true;
    } catch (e) {
      console.log("Handsontable not available, using fallback:", e.message);
      return false;
    }
  }

  renderSheetTabs(workbook, state) {
    if (workbook.SheetNames.length <= 1) return "";
    return `<div class="office-sheet-tabs">
      ${workbook.SheetNames.map(
        (name) => `
        <button class="office-sheet-tab ${name === state.activeSheet ? "office-sheet-tab--active" : ""}"
                data-sheet="${name}">${name}</button>
      `
      ).join("")}
    </div>`;
  }

  syncHotToWorkbook(state, XLSX) {
    if (!state.hot || !state.workbook) return;
    const data = state.hot.getData();
    state.workbook.Sheets[state.activeSheet] = XLSX.utils.aoa_to_sheet(data);
  }

  renderSheet() {}

  static async syncTable(state) {
    const XLSX = await modules.xlsx();

    if (state.hot) {
      const data = state.hot.getData();
      state.workbook.Sheets[state.activeSheet] = XLSX.utils.aoa_to_sheet(data);
      return;
    }

    if (state.editorType !== "spreadsheet" || !state.editor) return;
    state.editor.querySelectorAll("td[data-row][data-col]").forEach((td) => {
      const row = parseInt(td.dataset.row);
      const col = parseInt(td.dataset.col);
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      const ws = state.workbook.Sheets[state.activeSheet];
      const value = td.textContent;
      const num = Number(value);
      ws[ref] = value !== "" && !isNaN(num) ? { t: "n", v: num } : { t: "s", v: value };
    });
  }
}

class DocxEditor extends EditorStrategy {
  canHandle(ext) {
    return ext === ".docx";
  }

  async init(container, arrayBuffer, state) {
    let html = "";
    if (arrayBuffer && arrayBuffer.byteLength > 0) {
      try {
        const mammoth = await modules.mammoth();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        html = result.value;
      } catch (e) {
        console.error("mammoth error:", e);
        html = "<p>Error loading DOCX file.</p>";
      }
    }
    RichTextEditor.init(container, html, state);
  }
}

class OdtViewer extends EditorStrategy {
  canHandle(ext) {
    return ext === ".odt";
  }

  async init(container, arrayBuffer, state) {
    state.editorType = "odt-iframe";
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      RichTextEditor.init(container, "", state);
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "office-odt-wrapper";
    try {
      const JSZip = await modules.jszip();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const contentXml = await zip.file("content.xml")?.async("string");
      const stylesXml = (await zip.file("styles.xml")?.async("string")) || "";
      if (!contentXml) {
        wrapper.innerHTML = `<div class="office-info-msg">No content found in ODT file.</div>`;
        container.appendChild(wrapper);
        state.editor = wrapper;
        return;
      }
      const images = await OdfMediaLoader.loadPictures(zip);
      const htmlContent = OdtViewer.renderContent(contentXml, stylesXml, images);
      const iframe = document.createElement("iframe");
      iframe.className = "office-odt-iframe";
      iframe.sandbox = "allow-same-origin";
      wrapper.appendChild(iframe);
      container.appendChild(wrapper);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html><html><head><style>
        body{font-family:serif;font-size:14px;line-height:1.6;padding:20px 40px;margin:0;background:#1e1e2e;color:#cdd6f4;}
        h1,h2,h3,h4,h5,h6{color:#cba6f7;}p{margin:.3em 0;}
        table{border-collapse:collapse;margin:8px 0;}td,th{border:1px solid #45475a;padding:4px 8px;}
        img{max-width:100%;}ul,ol{margin:.3em 0;padding-left:2em;}a{color:#89b4fa;}
      </style></head><body>${htmlContent}</body></html>`);
      iframeDoc.close();
      state.editor = iframe;
      state.odtHtml = htmlContent;
    } catch (e) {
      wrapper.innerHTML = `<div class="office-error-msg">Error loading ODT: ${e.message}</div>`;
      container.appendChild(wrapper);
      state.editor = wrapper;
    }
  }

  static renderContent(contentXml, stylesXml, images) {
    const doc = new DOMParser().parseFromString(contentXml, "application/xml");
    const styleMap = OdfStyleParser.collectStyles([contentXml, stylesXml]);
    const getStyle = (n) => OdfStyleParser.styleStringFor(n, styleMap);

    const walk = (node) => {
      if (!node) return "";
      let html = "";
      for (let i = 0; i < node.childNodes.length; i++) {
        const c = node.childNodes[i];
        if (c.nodeType === 3) {
          html += FileUtils.escapeHtml(c.textContent);
          continue;
        }
        if (c.nodeType !== 1) continue;
        const ln = c.localName;
        const sn = c.getAttribute("text:style-name") || c.getAttribute("table:style-name") || "";
        const st = getStyle(sn);
        const sa = st ? ` style="${st}"` : "";
        switch (ln) {
          case "h": {
            const lvl = Math.min(parseInt(c.getAttribute("text:outline-level") || "1"), 6);
            html += `<h${lvl}${sa}>${walk(c)}</h${lvl}>`;
            break;
          }
          case "p":
            html += `<p${sa}>${walk(c) || "&nbsp;"}</p>`;
            break;
          case "span":
            html += `<span${sa}>${walk(c)}</span>`;
            break;
          case "a":
            html += `<a href="${FileUtils.escapeHtml(c.getAttribute("xlink:href") || "#")}"${sa}>${walk(c)}</a>`;
            break;
          case "list":
            html += `<ul${sa}>${walk(c)}</ul>`;
            break;
          case "list-item":
            html += `<li>${walk(c)}</li>`;
            break;
          case "tab":
            html += "&emsp;";
            break;
          case "line-break":
            html += "<br>";
            break;
          case "s":
            html += "&nbsp;".repeat(parseInt(c.getAttribute("text:c") || "1"));
            break;
          case "table":
            html += `<table${sa}>${walk(c)}</table>`;
            break;
          case "table-row":
            html += `<tr>${walk(c)}</tr>`;
            break;
          case "table-cell": {
            let attrs = sa;
            const cs = c.getAttribute("table:number-columns-spanned");
            const rs = c.getAttribute("table:number-rows-spanned");
            if (cs) attrs += ` colspan="${cs}"`;
            if (rs) attrs += ` rowspan="${rs}"`;
            html += `<td${attrs}>${walk(c)}</td>`;
            break;
          }
          case "frame": {
            const img =
              c.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:drawing:1.0", "image")[0] ||
              c.querySelector("image");
            if (img) {
              const href = img.getAttribute("xlink:href");
              const src = href && images[href] ? images[href] : "";
              const iw = c.getAttribute("svg:width") || "";
              const ih = c.getAttribute("svg:height") || "";
              let is = "max-width:100%;";
              if (iw) is += `width:${iw};`;
              if (ih) is += `height:${ih};`;
              html += src ? `<img src="${src}" style="${is}">` : `<span style="color:#6c7086;">[image]</span>`;
            } else html += walk(c);
            break;
          }
          default:
            html += walk(c);
            break;
        }
      }
      return html;
    };
    const body = doc.getElementsByTagName("office:body")[0];
    return body ? walk(body) : walk(doc.documentElement);
  }
}

class PdfViewer extends EditorStrategy {
  canHandle(ext) {
    return ext === ".pdf";
  }

  async init(container, arrayBuffer, state) {
    state.editorType = "pdf";
    try {
      const pdfjsLib = await modules.pdfjs();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      state.pdfDoc = pdf;
      const viewer = document.createElement("div");
      viewer.className = "office-pdf-viewer";
      const info = document.createElement("div");
      info.className = "office-pdf-info";
      info.textContent = `PDF — ${pdf.numPages} page(s)`;
      viewer.appendChild(info);
      container.innerHTML = "";
      container.appendChild(viewer);
      const scale = 1.5;
      for (let num = 1; num <= pdf.numPages; num++) {
        const page = await pdf.getPage(num);
        const viewport = page.getViewport({ scale });
        const pageDiv = document.createElement("div");
        pageDiv.className = "office-pdf-page";
        pageDiv.style.width = `${viewport.width}px`;
        pageDiv.style.height = `${viewport.height}px`;
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        pageDiv.appendChild(canvas);
        const textContent = await page.getTextContent();
        const textLayer = document.createElement("div");
        textLayer.className = "office-pdf-text-layer";
        for (const item of textContent.items) {
          if (!item.str) continue;
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const span = document.createElement("span");
          span.textContent = item.str;
          span.style.cssText = `position:absolute;left:${tx[4]}px;top:${tx[5]}px;font-size:${Math.abs(tx[0])}px;font-family:sans-serif;white-space:pre;color:transparent;user-select:text;`;
          textLayer.appendChild(span);
        }
        pageDiv.appendChild(textLayer);
        const label = document.createElement("div");
        label.className = "office-pdf-page-label";
        label.textContent = `Page ${num} of ${pdf.numPages}`;
        viewer.appendChild(pageDiv);
        viewer.appendChild(label);
      }
      state.editor = viewer;
    } catch (e) {
      container.innerHTML = `<div class="office-error-msg">Error rendering PDF: ${e.message}</div>`;
    }
  }
}

class OdpViewer extends EditorStrategy {
  canHandle(ext) {
    return ext === ".odp";
  }

  async init(container, arrayBuffer, state) {
    state.editorType = "presentation";
    try {
      const JSZip = await modules.jszip();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const contentXml = await zip.file("content.xml")?.async("string");
      if (!contentXml) {
        container.innerHTML = `<div class="office-info-msg">No content found in ODP file.</div>`;
        return;
      }
      const stylesXml = (await zip.file("styles.xml")?.async("string")) || "";
      const mediaMap = await OdfMediaLoader.loadPictures(zip);
      const doc = new DOMParser().parseFromString(contentXml, "application/xml");
      const odpStyles = OdfStyleParser.collectStyles([contentXml, stylesXml], true);
      const body = doc.getElementsByTagName("office:body")[0];
      const pres = body?.getElementsByTagName("office:presentation")[0];
      if (!pres) {
        container.innerHTML = `<div class="office-info-msg">No presentation content in ODP.</div>`;
        return;
      }
      const pages = pres.getElementsByTagName("draw:page");
      const viewer = document.createElement("div");
      viewer.className = "office-presentation-viewer";
      const info = document.createElement("div");
      info.className = "office-presentation-info";
      info.textContent = `Presentation — ${pages.length} slide(s)`;
      viewer.appendChild(info);
      for (let i = 0; i < pages.length; i++) {
        const slideHtml = OdpViewer.renderSlide(pages[i], odpStyles, mediaMap);
        const slideWrapper = document.createElement("div");
        slideWrapper.className = "office-slide-wrapper";
        const slideContent = document.createElement("div");
        slideContent.className = "office-slide-content";
        slideContent.innerHTML = slideHtml;
        slideWrapper.appendChild(slideContent);
        const label = document.createElement("div");
        label.className = "office-slide-label";
        label.textContent = `Slide ${i + 1} of ${pages.length}`;
        viewer.appendChild(slideWrapper);
        viewer.appendChild(label);
      }
      container.innerHTML = "";
      container.appendChild(viewer);
      state.editor = viewer;
    } catch (e) {
      container.innerHTML = `<div class="office-error-msg">Error loading ODP: ${e.message}</div>`;
    }
  }

  static renderSlide(page, styleMap, mediaMap) {
    let html = "";
    const cmToPx = 37.795;
    const SX = 960 / (25.4 * cmToPx);
    const SY = 540 / (19.05 * cmToPx);
    for (let i = 0; i < page.childNodes.length; i++) {
      const child = page.childNodes[i];
      if (child.nodeType !== 1) continue;
      const ln = child.localName;
      if (ln !== "frame" && ln !== "custom-shape") continue;
      const x = FileUtils.odpUnitToPx(child.getAttribute("svg:x") || "0cm") * SX;
      const y = FileUtils.odpUnitToPx(child.getAttribute("svg:y") || "0cm") * SY;
      const w = FileUtils.odpUnitToPx(child.getAttribute("svg:width") || "10cm") * SX;
      const h = FileUtils.odpUnitToPx(child.getAttribute("svg:height") || "5cm") * SY;
      const sn = child.getAttribute("draw:style-name") || "";
      const bg = styleMap[sn]?.["background-color"] ? `background-color:${styleMap[sn]["background-color"]};` : "";
      const img = child.getElementsByTagName("draw:image")[0];
      if (img) {
        const href = img.getAttribute("xlink:href");
        const src = href && mediaMap[href] ? mediaMap[href] : null;
        if (src)
          html += `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;"><img src="${src}" style="width:100%;height:100%;object-fit:contain;"></div>`;
        continue;
      }
      const textBox = child.getElementsByTagName("draw:text-box")[0];
      const directPs = child.getElementsByTagName("text:p");
      const source = textBox || (directPs.length > 0 ? child : null);
      if (source) {
        const textHtml = OdpViewer.renderText(source, styleMap);
        html += `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;padding:4px;box-sizing:border-box;${bg}">${textHtml}</div>`;
      }
    }
    return html;
  }

  static renderText(node, styleMap) {
    let html = "";
    for (let i = 0; i < node.childNodes.length; i++) {
      const c = node.childNodes[i];
      if (c.nodeType === 3) {
        html += FileUtils.escapeHtml(c.textContent);
        continue;
      }
      if (c.nodeType !== 1) continue;
      const ln = c.localName;
      const sn = c.getAttribute("text:style-name") || "";
      const st = OdfStyleParser.styleStringFor(sn, styleMap);
      if (ln === "p") html += `<div style="margin:1px 0;${st}">${OdpViewer.renderText(c, styleMap) || "&nbsp;"}</div>`;
      else if (ln === "span") html += `<span style="${st}">${OdpViewer.renderText(c, styleMap)}</span>`;
      else if (ln === "list")
        html += `<ul style="margin:0;padding-left:1.5em;">${OdpViewer.renderText(c, styleMap)}</ul>`;
      else if (ln === "list-item") html += `<li>${OdpViewer.renderText(c, styleMap)}</li>`;
      else if (ln === "tab") html += "&emsp;";
      else if (ln === "line-break") html += "<br>";
      else if (ln === "s") html += "&nbsp;".repeat(parseInt(c.getAttribute("text:c") || "1"));
      else if (ln === "a")
        html += `<a href="${FileUtils.escapeHtml(c.getAttribute("xlink:href") || "#")}">${OdpViewer.renderText(c, styleMap)}</a>`;
      else html += OdpViewer.renderText(c, styleMap);
    }
    return html;
  }
}

class PlainTextEditor extends EditorStrategy {
  canHandle() {
    return true;
  }

  async init(container, arrayBuffer, state) {
    const text = arrayBuffer ? new TextDecoder().decode(arrayBuffer) : "";
    RichTextEditor.init(container, text, state);
  }
}

class EditorRegistry {
  constructor() {
    this.strategies = [];
  }
  register(strategy) {
    this.strategies.push(strategy);
  }
  getStrategy(ext) {
    return this.strategies.find((s) => s.canHandle(ext)) || null;
  }
}

export class OfficeApp {
  constructor(fileSystemManager, windowManager, explorerApp) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this.idleTimer = null;
    this.idleDelay = 15000;
    this.editors = {};
    this.explorerApp = explorerApp;
    this.registry = new EditorRegistry();
    this.registry.register(new SpreadsheetEditor());
    this.registry.register(new DocxEditor());
    this.registry.register(new OdtViewer());
    this.registry.register(new PdfViewer());
    this.registry.register(new OdpViewer());
    this.registry.register(new PlainTextEditor());
  }

  open(title = "Untitled", content = null, filePath = null) {
    const safeTitle = title.replace(/[^a-zA-Z0-9.-]/g, "_");
    const existingWindows = document.querySelectorAll('[id^="office-"]');
    for (const w of existingWindows) {
      const header = w.querySelector(".window-header span");
      if (header && header.textContent === `${title} - Office`) {
        this.wm.bringToFront(w);
        return;
      }
    }

    const winId = `office-${safeTitle}-${Date.now()}`;
    const ext = FileUtils.getExtension(title);
    const win = this.wm.createWindow(winId, `${title} - Office`, "800px", "600px");
    Object.assign(win.style, { left: "200px", top: "100px" });

    win.innerHTML = `
      <div class="window-header">
        <span>${title} - Office</span>
        ${this.wm.getWindowControls()}
      </div>
<div class="office-menu-bar">
  <div class="office-menu-dropdown">
    <button class="office-menu-dropdown__trigger">File</button>
    <div class="office-menu-dropdown__content">
      <button class="office-menu-item" data-action="new">
        <span class="office-menu-item__icon"><i class="fas fa-file"></i></span>
        <span class="office-menu-item__label">New</span>
        <span class="office-menu-item__shortcut">Ctrl+N</span>
      </button>
      <button class="office-menu-item" data-action="open">
        <span class="office-menu-item__icon"><i class="fas fa-folder-open"></i></span>
        <span class="office-menu-item__label">Open</span>
        <span class="office-menu-item__shortcut">Ctrl+O</span>
      </button>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="save">
        <span class="office-menu-item__icon"><i class="fas fa-save"></i></span>
        <span class="office-menu-item__label">Save</span>
        <span class="office-menu-item__shortcut">Ctrl+S</span>
      </button>
      <button class="office-menu-item" data-action="saveAs">
        <span class="office-menu-item__icon"><i class="fas fa-save"></i></span>
        <span class="office-menu-item__label">Save As...</span>
        <span class="office-menu-item__shortcut">Ctrl+Shift+S</span>
      </button>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="download">
        <span class="office-menu-item__icon"><i class="fas fa-download"></i></span>
        <span class="office-menu-item__label">Download</span>
        <span class="office-menu-item__shortcut"></span>
      </button>
      <div class="office-menu-submenu">
        <button class="office-menu-item office-menu-item--has-submenu">
          <span class="office-menu-item__icon"><i class="fas fa-file-export"></i></span>
          <span class="office-menu-item__label">Export As</span>
          <span class="office-menu-item__arrow"><i class="fas fa-caret-right"></i></span>
        </button>
        <div class="office-menu-submenu__content">
          <button class="office-menu-item" data-action="exportPDF">
            <span class="office-menu-item__icon"><i class="fas fa-file-pdf"></i></span>
            <span class="office-menu-item__label">PDF Document</span>
          </button>
          <button class="office-menu-item" data-action="exportHTML">
            <span class="office-menu-item__icon"><i class="fas fa-file-code"></i></span>
            <span class="office-menu-item__label">HTML Page</span>
          </button>
          <button class="office-menu-item" data-action="exportTXT">
            <span class="office-menu-item__icon"><i class="fas fa-file-alt"></i></span>
            <span class="office-menu-item__label">Plain Text</span>
          </button>
        </div>
      </div>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="print">
        <span class="office-menu-item__icon"><i class="fas fa-print"></i></span>
        <span class="office-menu-item__label">Print</span>
        <span class="office-menu-item__shortcut">Ctrl+P</span>
      </button>
    </div>
  </div>

  <div class="office-menu-dropdown">
    <button class="office-menu-dropdown__trigger">Edit</button>
    <div class="office-menu-dropdown__content">
      <button class="office-menu-item" data-action="undo">
        <span class="office-menu-item__icon"><i class="fas fa-undo"></i></span>
        <span class="office-menu-item__label">Undo</span>
        <span class="office-menu-item__shortcut">Ctrl+Z</span>
      </button>
      <button class="office-menu-item" data-action="redo">
        <span class="office-menu-item__icon"><i class="fas fa-redo"></i></span>
        <span class="office-menu-item__label">Redo</span>
        <span class="office-menu-item__shortcut">Ctrl+Y</span>
      </button>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="cut">
        <span class="office-menu-item__icon"><i class="fas fa-cut"></i></span>
        <span class="office-menu-item__label">Cut</span>
        <span class="office-menu-item__shortcut">Ctrl+X</span>
      </button>
      <button class="office-menu-item" data-action="copy">
        <span class="office-menu-item__icon"><i class="fas fa-copy"></i></span>
        <span class="office-menu-item__label">Copy</span>
        <span class="office-menu-item__shortcut">Ctrl+C</span>
      </button>
      <button class="office-menu-item" data-action="paste">
        <span class="office-menu-item__icon"><i class="fas fa-paste"></i></span>
        <span class="office-menu-item__label">Paste</span>
        <span class="office-menu-item__shortcut">Ctrl+V</span>
      </button>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="selectAll">
        <span class="office-menu-item__icon"><i class="fas fa-border-all"></i></span>
        <span class="office-menu-item__label">Select All</span>
        <span class="office-menu-item__shortcut">Ctrl+A</span>
      </button>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="find">
        <span class="office-menu-item__icon"><i class="fas fa-search"></i></span>
        <span class="office-menu-item__label">Find</span>
        <span class="office-menu-item__shortcut">Ctrl+F</span>
      </button>
      <button class="office-menu-item" data-action="replace">
        <span class="office-menu-item__icon"><i class="fas fa-exchange-alt"></i></span>
        <span class="office-menu-item__label">Find & Replace</span>
        <span class="office-menu-item__shortcut">Ctrl+H</span>
      </button>
    </div>
  </div>

  <div class="office-menu-dropdown">
    <button class="office-menu-dropdown__trigger">View</button>
    <div class="office-menu-dropdown__content">
      <button class="office-menu-item" data-action="zoomIn">
        <span class="office-menu-item__icon"><i class="fas fa-search-plus"></i></span>
        <span class="office-menu-item__label">Zoom In</span>
        <span class="office-menu-item__shortcut">Ctrl++</span>
      </button>
      <button class="office-menu-item" data-action="zoomOut">
        <span class="office-menu-item__icon"><i class="fas fa-search-minus"></i></span>
        <span class="office-menu-item__label">Zoom Out</span>
        <span class="office-menu-item__shortcut">Ctrl+-</span>
      </button>
      <button class="office-menu-item" data-action="zoomReset">
        <span class="office-menu-item__icon"><i class="fas fa-search"></i></span>
        <span class="office-menu-item__label">Reset Zoom</span>
        <span class="office-menu-item__shortcut">Ctrl+0</span>
      </button>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="fullscreen">
        <span class="office-menu-item__icon"><i class="fas fa-expand"></i></span>
        <span class="office-menu-item__label">Fullscreen</span>
        <span class="office-menu-item__shortcut">F11</span>
      </button>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="toggleGrid">
        <span class="office-menu-item__icon"><i class="fas fa-border-all"></i></span>
        <span class="office-menu-item__label">Show Gridlines</span>
        <span class="office-menu-item__check"><i class="fas fa-check"></i></span>
      </button>
    </div>
  </div>

  <div class="office-menu-dropdown">
    <button class="office-menu-dropdown__trigger">Insert</button>
    <div class="office-menu-dropdown__content">
      <button class="office-menu-item office-menu-item--document" data-action="insertImage">
        <span class="office-menu-item__icon"><i class="fas fa-image"></i></span>
        <span class="office-menu-item__label">Image</span>
      </button>
      <button class="office-menu-item office-menu-item--document" data-action="insertTable">
        <span class="office-menu-item__icon"><i class="fas fa-table"></i></span>
        <span class="office-menu-item__label">Table</span>
      </button>
      <button class="office-menu-item office-menu-item--document" data-action="insertLink">
        <span class="office-menu-item__icon"><i class="fas fa-link"></i></span>
        <span class="office-menu-item__label">Link</span>
        <span class="office-menu-item__shortcut">Ctrl+K</span>
      </button>
      <button class="office-menu-item office-menu-item--document" data-action="insertHR">
        <span class="office-menu-item__icon"><i class="fas fa-minus"></i></span>
        <span class="office-menu-item__label">Horizontal Line</span>
      </button>
      <div class="office-menu-divider office-menu-item--spreadsheet"></div>
      <button class="office-menu-item office-menu-item--spreadsheet" data-action="addRow">
        <span class="office-menu-item__icon"><i class="fas fa-plus"></i></span>
        <span class="office-menu-item__label">Row</span>
      </button>
      <button class="office-menu-item office-menu-item--spreadsheet" data-action="addColumn">
        <span class="office-menu-item__icon"><i class="fas fa-plus"></i></span>
        <span class="office-menu-item__label">Column</span>
      </button>
      <button class="office-menu-item office-menu-item--spreadsheet" data-action="addSheet">
        <span class="office-menu-item__icon"><i class="fas fa-file-alt"></i></span>
        <span class="office-menu-item__label">New Sheet</span>
      </button>
    </div>
  </div>

  <div class="office-menu-dropdown">
    <button class="office-menu-dropdown__trigger">Format</button>
    <div class="office-menu-dropdown__content">
      <button class="office-menu-item" data-action="formatBold">
        <span class="office-menu-item__icon"><i class="fas fa-bold"></i></span>
        <span class="office-menu-item__label">Bold</span>
        <span class="office-menu-item__shortcut">Ctrl+B</span>
      </button>
      <button class="office-menu-item" data-action="formatItalic">
        <span class="office-menu-item__icon"><i class="fas fa-italic"></i></span>
        <span class="office-menu-item__label">Italic</span>
        <span class="office-menu-item__shortcut">Ctrl+I</span>
      </button>
      <button class="office-menu-item" data-action="formatUnderline">
        <span class="office-menu-item__icon"><i class="fas fa-underline"></i></span>
        <span class="office-menu-item__label">Underline</span>
        <span class="office-menu-item__shortcut">Ctrl+U</span>
      </button>
      <button class="office-menu-item" data-action="formatStrike">
        <span class="office-menu-item__icon"><i class="fas fa-strikethrough"></i></span>
        <span class="office-menu-item__label">Strikethrough</span>
      </button>
      <div class="office-menu-divider"></div>
      <div class="office-menu-submenu">
        <button class="office-menu-item office-menu-item--has-submenu">
          <span class="office-menu-item__icon"><i class="fas fa-paragraph"></i></span>
          <span class="office-menu-item__label">Paragraph</span>
          <span class="office-menu-item__arrow"><i class="fas fa-caret-right"></i></span>
        </button>
        <div class="office-menu-submenu__content">
          <button class="office-menu-item" data-action="alignLeft">
            <span class="office-menu-item__icon"><i class="fas fa-align-left"></i></span>
            <span class="office-menu-item__label">Align Left</span>
          </button>
          <button class="office-menu-item" data-action="alignCenter">
            <span class="office-menu-item__icon"><i class="fas fa-align-center"></i></span>
            <span class="office-menu-item__label">Align Center</span>
          </button>
          <button class="office-menu-item" data-action="alignRight">
            <span class="office-menu-item__icon"><i class="fas fa-align-right"></i></span>
            <span class="office-menu-item__label">Align Right</span>
          </button>
          <button class="office-menu-item" data-action="alignJustify">
            <span class="office-menu-item__icon"><i class="fas fa-align-justify"></i></span>
            <span class="office-menu-item__label">Justify</span>
          </button>
        </div>
      </div>
      <div class="office-menu-submenu">
        <button class="office-menu-item office-menu-item--has-submenu">
          <span class="office-menu-item__icon"><i class="fas fa-heading"></i></span>
          <span class="office-menu-item__label">Heading</span>
          <span class="office-menu-item__arrow"><i class="fas fa-caret-right"></i></span>
        </button>
        <div class="office-menu-submenu__content">
          <button class="office-menu-item" data-action="heading1">
            <span class="office-menu-item__label" style="font-size:18px;font-weight:bold">Heading 1</span>
          </button>
          <button class="office-menu-item" data-action="heading2">
            <span class="office-menu-item__label" style="font-size:16px;font-weight:bold">Heading 2</span>
          </button>
          <button class="office-menu-item" data-action="heading3">
            <span class="office-menu-item__label" style="font-size:14px;font-weight:bold">Heading 3</span>
          </button>
          <button class="office-menu-item" data-action="paragraph">
            <span class="office-menu-item__label">Normal Text</span>
          </button>
        </div>
      </div>
      <div class="office-menu-divider"></div>
      <button class="office-menu-item" data-action="clearFormat">
        <span class="office-menu-item__icon"><i class="fas fa-eraser"></i></span>
        <span class="office-menu-item__label">Clear Formatting</span>
      </button>
    </div>
  </div>

  <div class="office-menu-dropdown">
    <button class="office-menu-dropdown__trigger">Tools</button>
    <div class="office-menu-dropdown__content">
      <button class="office-menu-item" data-action="spellCheck">
        <span class="office-menu-item__icon"><i class="fas fa-check"></i></span>
        <span class="office-menu-item__label">Spell Check</span>
      </button>
      <button class="office-menu-item" data-action="wordCount">
        <span class="office-menu-item__icon"><i class="fas fa-list-ol"></i></span>
        <span class="office-menu-item__label">Word Count</span>
      </button>
      <div class="office-menu-divider office-menu-item--spreadsheet"></div>
      <button class="office-menu-item office-menu-item--spreadsheet" data-action="sortAsc">
        <span class="office-menu-item__icon"><i class="fas fa-sort-alpha-down"></i></span>
        <span class="office-menu-item__label">Sort A → Z</span>
      </button>
      <button class="office-menu-item office-menu-item--spreadsheet" data-action="sortDesc">
        <span class="office-menu-item__icon"><i class="fas fa-sort-alpha-up"></i></span>
        <span class="office-menu-item__label">Sort Z → A</span>
      </button>
    </div>
  </div>

  <div class="office-menu-dropdown">
    <button class="office-menu-dropdown__trigger">Help</button>
    <div class="office-menu-dropdown__content">
      <button class="office-menu-item" data-action="shortcuts">
        <span class="office-menu-item__icon"><i class="fas fa-keyboard"></i></span>
        <span class="office-menu-item__label">Keyboard Shortcuts</span>
      </button>
      <button class="office-menu-item" data-action="about">
        <span class="office-menu-item__icon"><i class="fas fa-info-circle"></i></span>
        <span class="office-menu-item__label">About</span>
      </button>
    </div>
  </div>
</div>
      <div class="office-window-content">
        <div class="office-editor-area">
          <div class="office-loading-indicator">Loading...</div>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, `${title} - Office`, "/static/icons/office.webp");
    const editorArea = win.querySelector(".office-editor-area");
    const state = {
      winId,
      title,
      filePath,
      ext,
      editor: null,
      workbook: null,
      activeSheet: null,
      editorType: null,
      rawArrayBuffer: null
    };
    this.setupMenuBar(win, state);

    this.editors[winId] = state;
    this.setupMenuActions(win, state);

    if (content !== null) {
      this.initEditor(editorArea, content, state, win).catch((e) => {
        console.error("Editor init error:", e);
        editorArea.innerHTML = `<div class="office-error-msg">Error loading file: ${e.message}</div>`;
      });
    } else {
      editorArea.querySelector(".office-loading-indicator")?.remove();
      this.showDropZone(editorArea, state, win);
    }
  }

  async saveFilesToDocuments(files) {
    if (!this.fs || !files || files.length === 0) return [];

    const documentsPath = ["Documents"];
    await this.fs.ensureFolder(documentsPath);

    const savedFiles = [];
    for (const fileData of files) {
      try {
        const ext = FileUtils.getExtension(fileData.name);
        const mime = FileUtils.mimeForExtension(ext);

        let content;
        if (FileUtils.isBinaryExtension(ext)) {
          content = FileUtils.arrayBufferToDataUrl(fileData.arrayBuffer, mime);
        } else {
          content = new TextDecoder().decode(fileData.arrayBuffer);
        }

        const savedName = await this.fs.createFile(documentsPath, fileData.name, content);
        savedFiles.push({
          name: savedName,
          path: documentsPath,
          arrayBuffer: fileData.arrayBuffer
        });
      } catch (e) {
        console.error(`Error saving ${fileData.name}:`, e);
      }
    }

    if (savedFiles.length > 0) {
      const fileList = savedFiles.map((f) => f.name).join(", ");
      this.wm.sendNotify(`Saved to Documents: ${fileList}`);
      speak(
        savedFiles.length === 1
          ? "I've saved that to your Documents folder!"
          : `I've saved ${savedFiles.length} files to your Documents folder!`,
        "Save"
      );
    }

    return savedFiles;
  }

  showDropZone(container, state, win) {
    const dropZone = document.createElement("div");
    dropZone.className = "office-dropzone";
    dropZone.innerHTML = `
    <div class="office-dropzone__icon"><i class="fas fa-file-upload fa-3x"></i></div>
    <div class="office-dropzone__title">Drop file(s) here or click to upload</div>
    <div class="office-dropzone__subtitle">Supports: DOCX, XLSX, XLS, CSV, ODT, PDF, ODP, TXT, HTML (Multiple files supported)</div>
  `;

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("office-dropzone--active");
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("office-dropzone--active");
    });

    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("office-dropzone--active");

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await this.handleMultipleFiles(files, container, state, win);
      }
    });

    dropZone.addEventListener("click", async () => {
      const results = await FileIO.triggerUpload(true);
      if (results.length > 0) {
        await this.handleUploadedFiles(results, container, state, win);
      }
    });

    container.appendChild(dropZone);
  }

  async handleMultipleFiles(files, container, state, win) {
    const fileDataArray = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        fileDataArray.push({ name: file.name, arrayBuffer });
      } catch (e) {
        console.error(`Error reading file ${file.name}:`, e);
      }
    }

    await this.handleUploadedFiles(fileDataArray, container, state, win);
  }

  async handleUploadedFiles(fileDataArray, container, state, win) {
    if (fileDataArray.length === 0) return;

    const savedFiles = await this.saveFilesToDocuments(fileDataArray);

    if (savedFiles.length > 0) {
      const firstFile = savedFiles[0];
      this.applyFileToState(firstFile.name, state, win);
      state.filePath = firstFile.path;
      await this.replaceEditorContent(container, firstFile.arrayBuffer, state, win);

      for (let i = 1; i < savedFiles.length; i++) {
        const file = savedFiles[i];
        this.open(file.name, file.arrayBuffer, file.path);
      }
    }
  }

  applyFileToState(fileName, state, win) {
    state.title = fileName;
    state.ext = FileUtils.getExtension(fileName);
    const header = win.querySelector(".window-header span");
    if (header) header.textContent = `${fileName} - Office`;
  }

  async replaceEditorContent(container, content, state, win) {
    container.innerHTML = "";
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "office-loading-indicator";
    loadingDiv.textContent = "Loading...";
    container.appendChild(loadingDiv);
    await this.initEditor(container, content, state, win);
  }

  async initEditor(container, content, state, win) {
    let arrayBuffer = await FileUtils.toArrayBuffer(content);

    if (!arrayBuffer && state.ext && state.filePath) {
      const ext = state.ext.toLowerCase();
      if ([".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt"].includes(ext)) {
        try {
          const blob = await this.fs.readBinaryFile(state.filePath, state.title);
          if (blob) {
            arrayBuffer = await blob.arrayBuffer();
            console.log("Loaded binary office file from blob storage:", state.title, arrayBuffer.byteLength);
          }
        } catch (e) {
          console.error("Error loading from binary storage:", e);
        }
      }
    }

    if (arrayBuffer) state.rawArrayBuffer = arrayBuffer;
    container.querySelector(".office-loading-indicator")?.remove();

    const strategy = this.registry.getStrategy(state.ext);
    if (strategy) await strategy.init(container, arrayBuffer, state);

    this.setupIdleDetection(win, state.ext);
  }
  setupMenuActions(win, state) {
    const actions = {
      new: () => this.createNewFile(win, state),
      open: () => this.openFileViaUpload(win, state),
      save: () => this.saveFile(win, state),
      saveAs: () => this.saveAsFile(state),
      download: () => this.downloadFile(state),
      exportPDF: () => this.exportToPDF(state),
      exportHTML: () => this.exportToHTML(state),
      exportTXT: () => this.exportToTXT(state),
      print: () => this.printDocument(win, state),
      cut: () => this.cutToClipboard(state),
      copy: () => this.copyToClipboard(state),
      paste: () => this.pasteFromClipboard(state),

      undo: () => this.executeCommand("undo", state),
      redo: () => this.executeCommand("redo", state),
      selectAll: () => this.executeCommand("selectAll", state),
      find: () => this.showFindDialog(win, state),
      replace: () => this.showReplaceDialog(win, state),
      zoomIn: () => this.adjustZoom(win, state, 1.1),
      zoomOut: () => this.adjustZoom(win, state, 0.9),
      zoomReset: () => this.resetZoom(win, state),
      fullscreen: () => this.toggleFullscreen(win),
      toggleGrid: () => this.toggleGrid(win, state),
      insertImage: () => this.insertImage(state),
      insertTable: () => this.insertTable(state),
      insertLink: () => this.insertLink(state),
      insertHR: () => this.executeCommand("insertHorizontalRule", state),
      addRow: () => this.addSpreadsheetRow(state),
      addColumn: () => this.addSpreadsheetColumn(state),
      addSheet: () => this.addSpreadsheetSheet(state),
      formatBold: () => this.executeCommand("bold", state),
      formatItalic: () => this.executeCommand("italic", state),
      formatUnderline: () => this.executeCommand("underline", state),
      formatStrike: () => this.executeCommand("strikeThrough", state),
      alignLeft: () => this.executeCommand("justifyLeft", state),
      alignCenter: () => this.executeCommand("justifyCenter", state),
      alignRight: () => this.executeCommand("justifyRight", state),
      alignJustify: () => this.executeCommand("justifyFull", state),
      heading1: () => this.formatBlock("h1", state),
      heading2: () => this.formatBlock("h2", state),
      heading3: () => this.formatBlock("h3", state),
      paragraph: () => this.formatBlock("p", state),
      clearFormat: () => this.executeCommand("removeFormat", state),
      spellCheck: () => this.spellCheck(state),
      wordCount: () => this.showWordCount(win, state),
      sortAsc: () => this.sortSpreadsheet(state, true),
      sortDesc: () => this.sortSpreadsheet(state, false),
      shortcuts: () => this.showShortcuts(win),
      about: () => this.showAbout(win)
    };

    win.querySelectorAll(".office-menu-item[data-action]").forEach((item) => {
      const action = actions[item.dataset.action];
      if (action) {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          win.querySelectorAll(".office-menu-dropdown").forEach((d) => d.classList.remove("active"));
          action();
        });
      }
    });

    this.setupKeyboardShortcuts(win, state, actions);
  }
  async sortSpreadsheet(state, ascending = true) {
    if (state.editorType !== "spreadsheet" || !state.hot) {
      this.wm.sendNotify("Sort is only available for spreadsheets");
      return;
    }

    try {
      const plugin = state.hot.getPlugin("columnSorting");
      if (plugin) {
        plugin.sort({
          column: 0,
          sortOrder: ascending ? "asc" : "desc"
        });
        this.wm.sendNotify(`Sorted ${ascending ? "A → Z" : "Z → A"}`);
      }
    } catch (e) {
      console.error("Sort error:", e);
      this.wm.sendNotify("Sort feature requires Handsontable");
    }
  }
  setupKeyboardShortcuts(win, state, actions) {
    win.addEventListener("keydown", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;

      const shortcuts = {
        n: "new",
        o: "open",
        s: e.shiftKey ? "saveAs" : "save",
        p: "print",
        z: "undo",
        y: "redo",
        x: "cut",
        c: "copy",
        v: "paste",
        a: "selectAll",
        f: "find",
        h: "replace",
        b: "formatBold",
        i: "formatItalic",
        u: "formatUnderline",
        k: "insertLink",
        "=": "zoomIn",
        "-": "zoomOut",
        0: "zoomReset"
      };

      const action = shortcuts[e.key.toLowerCase()];
      if (action && actions[action]) {
        e.preventDefault();
        actions[action]();
      }
    });

    win.addEventListener("keydown", (e) => {
      if (e.key === "F11") {
        e.preventDefault();
        actions.fullscreen();
      }
    });
  }

  executeCommand(cmd, state) {
    if (state.editorType === "contenteditable" && state.editor) {
      state.editor.focus();
      document.execCommand(cmd);
    }
  }

  formatBlock(tag, state) {
    if (state.editorType === "contenteditable" && state.editor) {
      state.editor.focus();
      document.execCommand("formatBlock", false, tag);
    }
  }

  resetZoom(win) {
    const editorArea = win.querySelector(".office-editor-area");
    editorArea.dataset.zoom = "1";
    editorArea.style.zoom = "1";
  }

  insertImage(state) {
    if (state.editorType !== "contenteditable") return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        document.execCommand("insertImage", false, reader.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  insertTable(state) {
    if (state.editorType !== "contenteditable") return;

    const rows = prompt("Number of rows:", "3");
    const cols = prompt("Number of columns:", "3");

    if (!rows || !cols) return;

    let html = '<table style="border-collapse:collapse;width:100%">';
    for (let r = 0; r < parseInt(rows); r++) {
      html += "<tr>";
      for (let c = 0; c < parseInt(cols); c++) {
        html += '<td style="border:1px solid #45475a;padding:8px">&nbsp;</td>';
      }
      html += "</tr>";
    }
    html += "</table>";

    document.execCommand("insertHTML", false, html);
  }

  insertLink(state) {
    if (state.editorType !== "contenteditable") return;

    const url = prompt("Enter URL:", "https://");
    if (url) {
      document.execCommand("createLink", false, url);
    }
  }

  showWordCount(win, state) {
    let text = "";

    if (state.editorType === "contenteditable" && state.editor) {
      text = state.editor.innerText;
    } else if (state.odtHtml) {
      const div = document.createElement("div");
      div.innerHTML = state.odtHtml;
      text = div.innerText;
    }

    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, "").length;
    const lines = text.split("\n").length;

    this.wm.sendNotify(`
    Words: ${words}
    Characters: ${chars}
    Characters (no spaces): ${charsNoSpace}
    Lines: ${lines}
  `);
  }

  showShortcuts() {
    const shortcuts = `
    <div style="text-align:left;font-family:monospace;font-size:12px">
      <div><b>File</b></div>
      <div>Ctrl+N - New</div>
      <div>Ctrl+O - Open</div>
      <div>Ctrl+S - Save</div>
      <div>Ctrl+Shift+S - Save As</div>
      <div>Ctrl+P - Print</div>
      <br>
      <div><b>Edit</b></div>
      <div>Ctrl+Z - Undo</div>
      <div>Ctrl+Y - Redo</div>
      <div>Ctrl+X/C/V - Cut/Copy/Paste</div>
      <div>Ctrl+A - Select All</div>
      <div>Ctrl+F - Find</div>
      <div>Ctrl+H - Replace</div>
      <br>
      <div><b>Format</b></div>
      <div>Ctrl+B - Bold</div>
      <div>Ctrl+I - Italic</div>
      <div>Ctrl+U - Underline</div>
      <br>
      <div><b>View</b></div>
      <div>Ctrl++ - Zoom In</div>
      <div>Ctrl+- - Zoom Out</div>
      <div>Ctrl+0 - Reset Zoom</div>
      <div>F11 - Fullscreen</div>
    </div>
  `;
    this.wm.sendNotify(shortcuts);
  }

  showAbout() {
    this.wm.sendNotify(`
    <div style="text-align:center">
      <div style="font-size:24px;margin-bottom:8px"><i class="fas fa-file-alt"></i> Office App</div>
      <div>Version 1.0.0</div>
      <div style="color:#6c7086;margin-top:8px">
        Supports DOCX, XLSX, CSV, ODT, PDF, ODP
      </div>
    </div>
  `);
  }

  spellCheck(state) {
    if (state.editorType === "contenteditable" && state.editor) {
      state.editor.spellcheck = !state.editor.spellcheck;
      this.wm.sendNotify(`Spell check: ${state.editor.spellcheck ? "ON" : "OFF"}`);
    }
  }

  toggleGrid(win, state) {
    if (state.editorType === "spreadsheet") {
      const table = win.querySelector(".office-spreadsheet");
      if (table) {
        table.classList.toggle("office-spreadsheet--no-grid");
      }
    }
  }

  exportToTXT(state) {
    let text = "";
    if (state.editorType === "contenteditable" && state.editor) {
      text = state.editor.innerText;
    }
    FileIO.triggerDownload(`${state.title}.txt`, text);
    this.wm.sendNotify("Exported as TXT");
  }

  createNewFile(win, state) {
    if (confirm("Create a new file? Unsaved changes will be lost.")) {
      const editorArea = win.querySelector(".office-editor-area");
      state.title = "Untitled";
      state.filePath = null;
      state.rawArrayBuffer = null;
      this.replaceEditorContent(editorArea, "", state, win);
      win.querySelector(".window-header span").textContent = "Untitled - Office";
    }
  }

  showFindDialog(win, state) {
    const searchTerm = prompt("Find:");
    if (!searchTerm) return;

    if (state.editorType === "contenteditable" && state.editor) {
      window.find(searchTerm);
    } else if (state.editorType === "spreadsheet") {
      this.findInSpreadsheet(state, searchTerm);
    }
  }

  showReplaceDialog(win, state) {
    const findText = prompt("Find:");
    if (!findText) return;
    const replaceText = prompt("Replace with:");
    if (replaceText === null) return;

    if (state.editorType === "contenteditable" && state.editor) {
      const html = state.editor.innerHTML;
      state.editor.innerHTML = html.replaceAll(findText, replaceText);
    }
  }
  async copyToClipboard(state) {
    if (state.editorType === "contenteditable" && state.editor) {
      state.editor.focus();
      const selection = window.getSelection();
      const text = selection.toString();

      if (!text) {
        this.wm.sendNotify("Nothing selected to copy");
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        this.wm.sendNotify("Copied to clipboard");
      } catch (err) {
        document.execCommand("copy");
      }
    } else if (state.editorType === "spreadsheet") {
      const focused = document.activeElement;
      if (focused?.classList.contains("office-spreadsheet__cell")) {
        const selection = window.getSelection().toString() || focused.textContent;
        try {
          await navigator.clipboard.writeText(selection);
          this.wm.sendNotify("Copied to clipboard");
        } catch (err) {
          document.execCommand("copy");
        }
      }
    }
  }

  async cutToClipboard(state) {
    if (state.editorType === "contenteditable" && state.editor) {
      state.editor.focus();
      const selection = window.getSelection();
      const text = selection.toString();

      if (!text) {
        this.wm.sendNotify("Nothing selected to cut");
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        document.execCommand("delete");
        this.wm.sendNotify("Cut to clipboard");
      } catch (err) {
        document.execCommand("cut");
      }
    } else if (state.editorType === "spreadsheet") {
      const focused = document.activeElement;
      if (focused?.classList.contains("office-spreadsheet__cell")) {
        try {
          await navigator.clipboard.writeText(focused.textContent);
          focused.textContent = "";
          this.wm.sendNotify("Cut to clipboard");
        } catch (err) {
          document.execCommand("cut");
        }
      }
    }
  }

  async pasteFromClipboard(state) {
    if (state.editorType === "contenteditable" && state.editor) {
      state.editor.focus();
      try {
        const text = await navigator.clipboard.readText();
        document.execCommand("insertText", false, text);
        this.wm.sendNotify("Pasted from clipboard");
      } catch (err) {
        this.wm.sendNotify("Clipboard access denied. Use Ctrl+V instead.");
      }
    } else if (state.editorType === "spreadsheet") {
      const focused = document.activeElement;
      if (focused?.classList.contains("office-spreadsheet__cell")) {
        try {
          const text = await navigator.clipboard.readText();
          focused.textContent = text;
          this.wm.sendNotify("Pasted from clipboard");
        } catch (err) {
          this.wm.sendNotify("Clipboard access denied. Use Ctrl+V instead.");
        }
      }
    }
  }
  printDocument(win, state) {
    const printWindow = window.open("", "", "width=800,height=600");
    let content = "";

    if (state.editorType === "contenteditable") {
      content = state.editor.innerHTML;
    } else if (state.editorType === "odt-iframe") {
      content = state.odtHtml;
    }

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${state.title}</title>
        <style>
          body { font-family: serif; padding: 20px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  adjustZoom(win, state, factor) {
    const editorArea = win.querySelector(".office-editor-area");
    const currentZoom = parseFloat(editorArea.dataset.zoom || "1");
    const newZoom = Math.max(0.5, Math.min(3, currentZoom * factor));
    editorArea.dataset.zoom = newZoom;
    editorArea.style.zoom = newZoom;
  }

  toggleFullscreen(win) {
    if (!win.classList.contains("office-fullscreen")) {
      win.dataset.previousStyle = JSON.stringify({
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height
      });
      win.style.left = "0";
      win.style.top = "0";
      win.style.width = "100vw";
      win.style.height = "100vh";
      win.classList.add("office-fullscreen");
    } else {
      const prev = JSON.parse(win.dataset.previousStyle || "{}");
      Object.assign(win.style, prev);
      win.classList.remove("office-fullscreen");
    }
  }

  async addSpreadsheetRow(state) {
    if (state.editorType !== "spreadsheet") return;
    if (!state.hot) {
      this.wm.sendNotify("Row add works in grid view");
      return;
    }
    const rowCount = state.hot.countRows();
    state.hot.alter("insert_row", rowCount, 1);
    this.wm.sendNotify("Row added");
  }

  async addSpreadsheetColumn(state) {
    if (state.editorType !== "spreadsheet") return;
    if (!state.hot) {
      this.wm.sendNotify("Column add works in grid view");
      return;
    }
    const colCount = state.hot.countCols();
    state.hot.alter("insert_col", colCount, 1);
    this.wm.sendNotify("Column added");
  }

  async addSpreadsheetSheet(state) {
    if (state.editorType !== "spreadsheet" || !state.workbook) return;

    const name = prompt("Sheet name:", `Sheet${state.workbook.SheetNames.length + 1}`);
    if (!name) return;

    const XLSX = await modules.xlsx();
    const emptyData = Array.from({ length: 50 }, () => Array(26).fill(""));
    XLSX.utils.book_append_sheet(state.workbook, XLSX.utils.aoa_to_sheet(emptyData), name);

    state.activeSheet = name;

    const container = document.querySelector(`#${state.winId} .office-editor-area`);
    container.innerHTML = "";
    await new SpreadsheetEditor().tryHandsontable(container, state.workbook, state, XLSX);
  }

  async exportToPDF(state) {
    speak("PDF export requires jsPDF library. Downloading HTML instead.", "GetAttention");
    await this.exportToHTML(state);
  }

  async exportToHTML(state) {
    const html = this.getEditorContent(state);
    const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${state.title}</title>
  <style>
    body { font-family: serif; max-width: 800px; margin: 20px auto; padding: 20px; }
  </style>
</head>
<body>${html}</body>
</html>`;

    FileIO.triggerDownload(`${state.title}.html`, fullHTML);
    this.wm.sendNotify("Exported as HTML");
  }

  findInSpreadsheet(state, searchTerm) {
    const cells = document.querySelectorAll(".office-spreadsheet__cell");
    cells.forEach((cell) => cell.classList.remove("office-cell-highlight"));

    cells.forEach((cell) => {
      if (cell.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
        cell.classList.add("office-cell-highlight");
        cell.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
  setupMenuBar(win, state) {
    const menuBar = win.querySelector(".office-menu-bar");

    const ext = state.ext;
    const isSpreadsheet = [".xlsx", ".xls", ".csv"].includes(ext);
    const isReadOnly = [".pdf", ".odp", ".odt"].includes(ext);
    const isDocEditable = [".docx", ".txt", ".html", ""].includes(ext) || !ext;

    menuBar.dataset.mode = isSpreadsheet ? "spreadsheet" : "document";

    const formatDropdown = win.querySelector(".office-menu-dropdown:nth-child(5)");
    if (formatDropdown) {
      formatDropdown.style.display = isDocEditable ? "" : "none";
    }

    const insertDropdown = win.querySelector(".office-menu-dropdown:nth-child(4)");

    win.querySelectorAll(".office-menu-item--document").forEach((item) => {
      item.style.display = isDocEditable ? "" : "none";
    });

    win.querySelectorAll(".office-menu-item--spreadsheet").forEach((item) => {
      item.style.display = isSpreadsheet ? "" : "none";
    });

    if (insertDropdown) {
      insertDropdown.style.display = isReadOnly ? "none" : "";
    }

    const editDropdown = win.querySelector(".office-menu-dropdown:nth-child(2)");
    if (isReadOnly && editDropdown) {
      editDropdown.querySelectorAll(".office-menu-item").forEach((item) => {
        item.classList.add("office-menu-item--disabled");
        item.style.pointerEvents = "none";
        item.style.opacity = "0.5";
      });
    }

    win.querySelectorAll('[data-action^="sort"]').forEach((item) => {
      item.style.display = isSpreadsheet ? "" : "none";
    });

    win.querySelectorAll(".office-menu-divider.office-menu-item--spreadsheet").forEach((divider) => {
      divider.style.display = isSpreadsheet ? "" : "none";
    });

    win.querySelectorAll('[data-action="toggleGrid"]').forEach((item) => {
      item.style.display = isSpreadsheet ? "" : "none";
    });

    const dropdowns = win.querySelectorAll(".office-menu-dropdown");

    dropdowns.forEach((dropdown) => {
      const trigger = dropdown.querySelector(".office-menu-dropdown__trigger");
      if (!trigger) return;

      const newTrigger = trigger.cloneNode(true);
      trigger.parentNode.replaceChild(newTrigger, trigger);

      newTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isActive = dropdown.classList.contains("active");

        dropdowns.forEach((d) => d.classList.remove("active"));

        if (!isActive) {
          dropdown.classList.add("active");
        }
      });

      newTrigger.addEventListener("mouseenter", () => {
        const anyActive = win.querySelector(".office-menu-dropdown.active");
        if (anyActive && anyActive !== dropdown) {
          dropdowns.forEach((d) => d.classList.remove("active"));
          dropdown.classList.add("active");
        }
      });
    });

    const closeDropdowns = (e) => {
      if (!e.target.closest(".office-menu-dropdown")) {
        dropdowns.forEach((d) => d.classList.remove("active"));
      }
    };

    document.removeEventListener("click", win._closeDropdownsHandler);
    win._closeDropdownsHandler = closeDropdowns;
    document.addEventListener("click", closeDropdowns);
  }
  async openFileViaUpload(win, state) {
    speak("Looking for something?", "Searching");

    const results = await FileIO.triggerUpload(true);
    if (results.length === 0) return;

    const editorArea = win.querySelector(".office-editor-area");
    await this.handleUploadedFiles(results, editorArea, state, win);
  }

  setupIdleDetection(win, ext) {
    const el = win.querySelector(".office-richtext-editor") || win.querySelector(".office-spreadsheet");
    if (!el) return;
    const reset = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        const msg = [".xlsx", ".xls", ".csv"].includes(ext)
          ? "Still there? Need help with your spreadsheet?"
          : "Still there? I can check your formatting.";
        speak(msg, "Thinking");
      }, this.idleDelay);
    };
    el.addEventListener("input", reset);
    el.addEventListener("keydown", reset);
    const obs = new MutationObserver(() => {
      if (!document.contains(win)) {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        obs.disconnect();
      }
    });
    obs.observe(desktop, { childList: true });
  }

  getEditorContent(state) {
    if (state.editorType === "contenteditable" && state.editor) return state.editor.innerHTML;
    if (state.editorType === "spreadsheet" && state.workbook) return state.workbook;
    return "";
  }

  async generateFileContent(state) {
    const ext = state.ext;
    const readOnlyFormats = [".pdf", ".odp"];

    if (ext === ".xlsx" || ext === ".xls") {
      if (state.workbook) {
        const XLSX = await modules.xlsx();
        await SpreadsheetEditor.syncTable(state);
        return new Uint8Array(
          XLSX.write(state.workbook, {
            bookType: ext === ".xls" ? "xls" : "xlsx",
            type: "array"
          })
        );
      }
      return new Uint8Array();
    }
    if (ext === ".csv") {
      if (state.workbook) {
        const XLSX = await modules.xlsx();
        await SpreadsheetEditor.syncTable(state);
        return XLSX.utils.sheet_to_csv(state.workbook.Sheets[state.activeSheet]);
      }
      return "";
    }
    if (ext === ".docx") {
      const html = this.getEditorContent(state);
      try {
        const { Document, Packer } = await modules.docx();
        const paragraphs = await HtmlConverter.toDocxParagraphs(html);
        const doc = new Document({ sections: [{ children: paragraphs }] });
        return new Uint8Array(await Packer.toBuffer(doc));
      } catch {
        return new Blob([html], { type: "text/html" });
      }
    }
    if (ext === ".odt") return HtmlConverter.toOdtBlob(this.getEditorContent(state));
    if (readOnlyFormats.includes(ext)) {
      if (state.rawArrayBuffer) return new Uint8Array(state.rawArrayBuffer);
      speak("This format is read-only.", "GetAttention");
      return null;
    }
    return this.getEditorContent(state);
  }

  async saveFile(win, state) {
    if (!state.filePath && this.explorerApp) {
      this.saveAsFile(state);
      return;
    }
    try {
      const content = await this.generateFileContent(state);
      if (content === null) return;

      if (state.filePath && this.fs) {
        const ext = state.ext;

        if (ext === ".pdf" && content instanceof Uint8Array) {
          const blob = new Blob([content], { type: "application/pdf" });
          await this.fs.writeBinaryFile(state.filePath, state.title, blob, FileKind.OTHER, "/static/icons/pdf.webp");
        } else if (FileUtils.isBinaryExtension(ext) && content instanceof Uint8Array) {
          const mime = FileUtils.mimeForExtension(ext);
          const storageContent = FileUtils.arrayBufferToDataUrl(content.buffer, mime);
          this.fs.updateFile(state.filePath, state.title, storageContent);
        } else {
          this.fs.updateFile(state.filePath, state.title, content);
        }

        this.wm.sendNotify(`File saved: ${state.title}`);
        speak("Great, your file has been saved!", "Save");
      } else {
        this.downloadFile(state);
      }
    } catch (e) {
      console.error("Save error:", e);
      this.wm.sendNotify("Error saving file.");
    }
  }

  async saveAsFile(state) {
    if (this.explorerApp) {
      const def = state.title.includes(".") ? state.title : `${state.title}${state.ext || ".docx"}`;
      this.explorerApp.openSaveDialog(def, async (path, fileName) => {
        try {
          const se = FileUtils.getExtension(fileName);
          if (se && se !== state.ext) state.ext = se;
          const content = await this.generateFileContent(state);
          if (content === null) return;

          let storageContent = content;
          if (FileUtils.isBinaryExtension(state.ext) && content instanceof Uint8Array) {
            const mime = FileUtils.mimeForExtension(state.ext);
            storageContent = FileUtils.arrayBufferToDataUrl(content.buffer, mime);
          }

          await this.fs.createFile(path, fileName, storageContent);
          const ps = path.length ? `/${path.join("/")}/${fileName}` : `/${fileName}`;
          state.title = fileName;
          state.filePath = path;
          this.wm.sendNotify(`File saved: ${ps}`);
          speak("Great, your file has been saved!", "Save");
        } catch {
          this.wm.sendNotify("Error saving file.");
        }
      });
    } else {
      await this.downloadFile(state);
    }
  }

  async downloadFile(state) {
    try {
      const content = await this.generateFileContent(state);
      if (content === null) return;
      const fileName = state.title.includes(".") ? state.title : `${state.title}${state.ext || ".txt"}`;
      FileIO.triggerDownload(fileName, content);
      this.wm.sendNotify(`Downloaded: ${fileName}`);
      speak("Great, your file has been downloaded!", "Save");
    } catch {
      this.wm.sendNotify("Error downloading file.");
    }
  }

  openFileDialog() {
    this.open();
  }

  loadContent(fileName, content, filePath) {
    this.open(fileName, content, filePath);
  }
}
