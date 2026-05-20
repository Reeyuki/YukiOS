import { WindowHelper } from "./WindowHelper.js";
import "../styles/converter.css";

const conversionHistory = [];

function getFileExtension(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getFileNameWithoutExtension(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : name;
}

function detectCategory(ext) {
  const images = ["png", "jpg", "jpeg", "webp", "bmp", "svg", "gif"];
  const texts = ["txt", "md", "html", "json", "log"];
  const structured = ["json", "csv", "xml", "yaml", "yml", "tsv"];

  if (images.includes(ext)) return "image";
  if (structured.includes(ext)) return "structured";
  if (texts.includes(ext)) return "text";
  return null;
}

async function readAsText(fs, path, name) {
  const content = await fs.getFileContent(path, name);
  if (content instanceof Blob) {
    return await content.text();
  }
  if (typeof content === "string") {
    if (content.startsWith("http") || content.startsWith("/") || content.startsWith("data:")) {
      try {
        const res = await fetch(content);
        return await res.text();
      } catch (e) {}
    }
    return content;
  }
  return "";
}

async function readAsBlob(fs, path, name) {
  try {
    const blob = await fs.readBinaryFile(path, name);
    if (blob) return blob;
  } catch (err) {}

  const content = await fs.getFileContent(path, name);
  if (content instanceof Blob) return content;
  if (typeof content === "string") {
    if (content.startsWith("http") || content.startsWith("/") || content.startsWith("data:")) {
      try {
        const res = await fetch(content);
        return await res.blob();
      } catch (e) {}
    }
    return new Blob([content]);
  }
  return new Blob([]);
}

function mdToHtml(md) {
  let html = md
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*)\*/gim, "<em>$1</em>")
    .replace(/`([^`]+)`/gim, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>')
    .replace(/^\s*\n/gm, "<br />")
    .replace(/^ - (.*$)/gim, "<ul><li>$1</li></ul>")
    .replace(/^ \* (.*$)/gim, "<ul><li>$1</li></ul>")
    .replace(/<\/ul>\s*<ul>/gim, "")
    .replace(/^\s*([0-9]+)\. (.*$)/gim, "<ol><li>$2</li></ol>")
    .replace(/<\/ol>\s*<ol>/gim, "");
  return html;
}

function htmlToMd(html) {
  let md = html
    .replace(/<h1>(.*?)<\/h1>/gim, "# $1\n")
    .replace(/<h2>(.*?)<\/h2>/gim, "## $1\n")
    .replace(/<h3>(.*?)<\/h3>/gim, "### $1\n")
    .replace(/<strong>(.*?)<\/strong>/gim, "**$1**")
    .replace(/<b>(.*?)<\/b>/gim, "**$1**")
    .replace(/<em>(.*?)<\/em>/gim, "*$1*")
    .replace(/<i>(.*?)<\/i>/gim, "*$1*")
    .replace(/<code>(.*?)<\/code>/gim, "`$1`")
    .replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/gim, "[$2]($1)")
    .replace(/<li>(.*?)<\/li>/gim, "- $1\n")
    .replace(/<ul[^>]*>/gim, "")
    .replace(/<\/ul>/gim, "\n")
    .replace(/<ol[^>]*>/gim, "")
    .replace(/<\/ol>/gim, "\n")
    .replace(/<br\s*\/?>/gim, "\n")
    .replace(/<p[^>]*>/gim, "")
    .replace(/<\/p>/gim, "\n\n");

  const temp = document.createElement("div");
  temp.innerHTML = md;
  return temp.textContent || temp.innerText || "";
}

function stripMd(md) {
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "");
}

function flattenJson(obj, prefix = "") {
  let result = {};
  for (let [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenJson(v, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

function jsonToCsv(json, delimiter = ",") {
  let arr = Array.isArray(json) ? json : [json];
  arr = arr.map((item) => (typeof item === "object" && item !== null ? flattenJson(item) : { value: item }));
  const allKeys = [...new Set(arr.flatMap((item) => Object.keys(item)))];
  const header = allKeys.map((k) => `"${String(k).replace(/"/g, '""')}"`).join(delimiter);
  const rows = arr.map((item) => {
    return allKeys
      .map((k) => {
        const val = item[k] === undefined || item[k] === null ? "" : item[k];
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(delimiter);
  });
  return [header, ...rows].join("\n");
}

function csvToJson(csv, delimiter = ",") {
  const lines = csv
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const parseRow = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      let val = values[idx] === undefined ? "" : values[idx];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      if (!isNaN(Number(val)) && val !== "") {
        val = Number(val);
      } else if (val.toLowerCase() === "true") {
        val = true;
      } else if (val.toLowerCase() === "false") {
        val = false;
      }
      obj[h] = val;
    });
    rows.push(obj);
  }
  return rows;
}

function yamlToJson(yaml) {
  const lines = yaml.split("\n");
  const result = {};
  const stack = [result];
  const indents = [-1];

  for (let line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.search(/\S/);
    const cleanLine = line.trim();
    const colonIndex = cleanLine.indexOf(":");
    if (colonIndex === -1) continue;

    const key = cleanLine.slice(0, colonIndex).trim();
    let val = cleanLine.slice(colonIndex + 1).trim();

    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val.toLowerCase() === "true") val = true;
    else if (val.toLowerCase() === "false") val = false;
    else if (!isNaN(Number(val)) && val !== "") val = Number(val);

    while (indent <= indents[indents.length - 1]) {
      stack.pop();
      indents.pop();
    }

    const parent = stack[stack.length - 1];
    if (val === "") {
      const newObj = {};
      if (Array.isArray(parent)) {
        parent.push({ [key]: newObj });
      } else {
        parent[key] = newObj;
      }
      stack.push(newObj);
      indents.push(indent);
    } else {
      if (Array.isArray(parent)) {
        parent.push({ [key]: val });
      } else {
        parent[key] = val;
      }
    }
  }
  return result;
}

function jsonToYaml(obj, depth = 0) {
  let yaml = "";
  const indent = "  ".repeat(depth);
  if (Array.isArray(obj)) {
    for (let item of obj) {
      if (typeof item === "object" && item !== null) {
        yaml += `${indent}-\n${jsonToYaml(item, depth + 1)}`;
      } else {
        yaml += `${indent}- ${item}\n`;
      }
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (let [k, v] of Object.entries(obj)) {
      if (typeof v === "object" && v !== null) {
        yaml += `${indent}${k}:\n${jsonToYaml(v, depth + 1)}`;
      } else {
        yaml += `${indent}${k}: ${v}\n`;
      }
    }
  } else {
    yaml += `${indent}${obj}\n`;
  }
  return yaml;
}

function xmlToJson(xmlStr) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
  const parseNode = (node) => {
    if (node.nodeType === 3) return node.nodeValue.trim();
    if (node.nodeType === 1) {
      if (node.children.length === 0) return node.textContent.trim();
      const obj = {};
      for (let child of node.children) {
        const parsedChild = parseNode(child);
        if (obj[child.nodeName]) {
          if (!Array.isArray(obj[child.nodeName])) {
            obj[child.nodeName] = [obj[child.nodeName]];
          }
          obj[child.nodeName].push(parsedChild);
        } else {
          obj[child.nodeName] = parsedChild;
        }
      }
      return obj;
    }
    return null;
  };
  return parseNode(xmlDoc.documentElement);
}

function jsonToXml(obj, rootName = "root") {
  const parseObj = (val, key) => {
    if (Array.isArray(val)) {
      return val.map((item) => parseObj(item, key)).join("");
    }
    if (typeof val === "object" && val !== null) {
      let inner = "";
      for (let [k, v] of Object.entries(val)) {
        inner += parseObj(v, k);
      }
      return `<${key}>${inner}</${key}>`;
    }
    return `<${key}>${val}</${key}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${parseObj(obj, rootName)}`;
}

export function openFileConverter(fileName, currentPath, services, onComplete = null) {
  const wm = services.windowManager || services.wm;
  const fs = services.fileSystemManager || services.fs;
  const ext = getFileExtension(fileName);
  const baseName = getFileNameWithoutExtension(fileName);
  const category = detectCategory(ext);

  if (!category) {
    wm.sendNotify(`Unsupported file extension: .${ext}`);
    return;
  }

  const winId = `converter-${Date.now()}`;
  const windowHelper = new WindowHelper(wm);

  const formats = {
    image: ["png", "jpg", "webp", "bmp", "svg"],
    text: ["txt", "md", "html", "json"],
    structured: ["json", "csv", "xml", "yaml", "tsv"]
  };

  const optionsHTML = {
    image: `
      <div class="options-panel">
        <div class="control-row">
          <div class="control-group">
            <span class="control-label">Width (px)</span>
            <input type="number" id="${winId}-img-width" class="control-input" placeholder="Original">
          </div>
          <div class="control-group">
            <span class="control-label">Height (px)</span>
            <input type="number" id="${winId}-img-height" class="control-input" placeholder="Original">
          </div>
        </div>
        <div class="control-group">
          <span class="control-label">Scale (%)</span>
          <input type="number" id="${winId}-img-scale" class="control-input" value="100" min="1" max="1000">
        </div>
        <div class="control-group" id="${winId}-quality-group">
          <span class="control-label">Compression Quality</span>
          <div class="slider-container">
            <input type="range" id="${winId}-img-quality" min="1" max="100" value="90" style="flex:1;">
            <span class="slider-val" id="${winId}-quality-val">90%</span>
          </div>
        </div>
        <label class="checkbox-label">
          <input type="checkbox" id="${winId}-img-alpha"> Flatten Transparency
        </label>
        <div class="control-group" id="${winId}-alpha-color-group" style="display:none;">
          <span class="control-label">Background Color</span>
          <input type="color" id="${winId}-img-bgcolor" class="control-input" value="#ffffff" style="height:38px;padding:2px;cursor:pointer;">
        </div>
        <label class="checkbox-label">
          <input type="checkbox" id="${winId}-img-thumb"> Generate Thumbnail Version
        </label>
      </div>
    `,
    text: `
      <div class="options-panel">
        <label class="checkbox-label">
          <input type="checkbox" id="${winId}-text-cleanup" checked> Normalize Whitespace
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="${winId}-text-sanitize" checked> Sanitize HTML (strip scripts/styles)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="${winId}-text-stats" checked> Show Statistics Panel
        </label>
        <div class="stats-grid" id="${winId}-stats-panel" style="display:none;">
          <div class="stats-card">
            <div class="stats-value" id="${winId}-stat-words">0</div>
            <div class="stats-label">Words</div>
          </div>
          <div class="stats-card">
            <div class="stats-value" id="${winId}-stat-chars">0</div>
            <div class="stats-label">Characters</div>
          </div>
          <div class="stats-card">
            <div class="stats-value" id="${winId}-stat-lines">0</div>
            <div class="stats-label">Lines</div>
          </div>
        </div>
        <span class="control-label">Live Preview</span>
        <div class="preview-container" id="${winId}-text-preview">Loading text preview...</div>
      </div>
    `,
    structured: `
      <div class="options-panel">
        <label class="checkbox-label">
          <input type="checkbox" id="${winId}-struct-pretty" checked> Pretty-Print Normalization
        </label>
        <label class="checkbox-label" id="${winId}-csv-delim-group">
          <input type="checkbox" id="${winId}-struct-autodetect" checked> Auto-Detect CSV Delimiter
        </label>
        <label class="checkbox-label" id="${winId}-flatten-group">
          <input type="checkbox" id="${winId}-struct-flatten"> Flatten Nested JSON Structures
        </label>
        <span class="control-label">Structured Data Preview (First 5 Rows)</span>
        <div class="preview-container" id="${winId}-struct-preview" style="padding:0;">
          <div style="padding:12px;">Parsing structured data...</div>
        </div>
      </div>
    `
  };

  const availableFormats = formats[category].filter((f) => f !== ext);
  const firstFormat = availableFormats[0] || ext;

  const formatOptions = availableFormats
    .map((f) => `<div class="custom-select-option" data-value="${f}">${f.toUpperCase()}</div>`)
    .join("");

  const content = `
    <div class="converter-container">
      <div class="converter-layout">
        <div class="converter-sidebar">
          <div class="converter-section-title">Source File</div>
          <div class="file-info-box">
            <div class="file-info-item">
              <span class="file-info-label">Name:</span>
              <span class="file-info-val" title="${fileName}">${fileName}</span>
            </div>
            <div class="file-info-item">
              <span class="file-info-label">Size:</span>
              <span class="file-info-val" id="${winId}-info-size">Calculating...</span>
            </div>
            <div class="file-info-item">
              <span class="file-info-label">Type:</span>
              <span class="file-info-val">${ext.toUpperCase()} File</span>
            </div>
          </div>

          <div class="converter-section-title">Export Settings</div>
          <div class="control-group">
            <span class="control-label">Convert To</span>
            <div class="custom-select-wrapper" id="${winId}-target-format-wrapper">
              <div class="custom-select-display control-input" id="${winId}-target-format-display">
                <span class="custom-select-text" id="${winId}-target-format-text">${firstFormat.toUpperCase()}</span>
                <i class="fas fa-chevron-down" style="font-size:10px; opacity:0.7;"></i>
              </div>
              <div class="custom-select-dropdown" id="${winId}-target-format-dropdown" style="display:none;">
                ${formatOptions}
              </div>
            </div>
            <input type="hidden" id="${winId}-target-format" value="${firstFormat}">
          </div>

          <div class="control-group">
            <span class="control-label">Filename Strategy</span>
            <input type="text" id="${winId}-output-name" class="control-input" value="${baseName}_converted">
          </div>

          <label class="checkbox-label">
            <input type="checkbox" id="${winId}-overwrite"> Overwrite If Exists
          </label>

          <label class="checkbox-label">
            <input type="checkbox" id="${winId}-auto-open" checked> Auto-Open Result
          </label>

          <div class="converter-section-title" style="margin-top:10px;">Recent History</div>
          <div class="history-list" id="${winId}-history-list">
            <div style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;padding:10px 0;">No conversions yet</div>
          </div>
        </div>

        <div class="converter-content">
          <div class="converter-section-title">Processing & Transformation Options</div>
          ${optionsHTML[category]}
        </div>
      </div>

      <div class="converter-footer">
        <div class="progress-container" id="${winId}-progress-container">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="${winId}-progress-fill"></div>
          </div>
          <span class="progress-text" id="${winId}-progress-text">Ready to transform...</span>
        </div>

        <div class="action-buttons">
          <button class="btn-cancel" id="${winId}-btn-cancel">Cancel</button>
          <button class="btn-convert" id="${winId}-btn-convert">
            <i class="fas fa-magic"></i> Transform File
          </button>
        </div>
      </div>
    </div>
  `;

  const win = windowHelper.createAndMountWindow(
    winId,
    `File Converter & Processor - ${fileName}`,
    content,
    "850px",
    "550px",
    {
      icon: "fa-exchange-alt",
      className: "converter-window"
    }
  );

  const dom = {
    sizeInfo: win.querySelector(`#${winId}-info-size`),
    targetFormat: win.querySelector(`#${winId}-target-format`),
    outputName: win.querySelector(`#${winId}-output-name`),
    overwrite: win.querySelector(`#${winId}-overwrite`),
    autoOpen: win.querySelector(`#${winId}-auto-open`),
    historyList: win.querySelector(`#${winId}-history-list`),
    btnCancel: win.querySelector(`#${winId}-btn-cancel`),
    btnConvert: win.querySelector(`#${winId}-btn-convert`),
    progressContainer: win.querySelector(`#${winId}-progress-container`),
    progressFill: win.querySelector(`#${winId}-progress-fill`),
    progressText: win.querySelector(`#${winId}-progress-text`),

    width: win.querySelector(`#${winId}-img-width`),
    height: win.querySelector(`#${winId}-img-height`),
    scale: win.querySelector(`#${winId}-img-scale`),
    quality: win.querySelector(`#${winId}-img-quality`),
    qualityVal: win.querySelector(`#${winId}-quality-val`),
    qualityGroup: win.querySelector(`#${winId}-quality-group`),
    alpha: win.querySelector(`#${winId}-img-alpha`),
    alphaColorGroup: win.querySelector(`#${winId}-alpha-color-group`),
    bgcolor: win.querySelector(`#${winId}-img-bgcolor`),
    thumb: win.querySelector(`#${winId}-img-thumb`),

    cleanup: win.querySelector(`#${winId}-text-cleanup`),
    sanitize: win.querySelector(`#${winId}-text-sanitize`),
    stats: win.querySelector(`#${winId}-text-stats`),
    statsPanel: win.querySelector(`#${winId}-stats-panel`),
    statWords: win.querySelector(`#${winId}-stat-words`),
    statChars: win.querySelector(`#${winId}-stat-chars`),
    statLines: win.querySelector(`#${winId}-stat-lines`),
    textPreview: win.querySelector(`#${winId}-text-preview`),

    pretty: win.querySelector(`#${winId}-struct-pretty`),
    autodetect: win.querySelector(`#${winId}-struct-autodetect`),
    csvDelimGroup: win.querySelector(`#${winId}-csv-delim-group`),
    flatten: win.querySelector(`#${winId}-struct-flatten`),
    flattenGroup: win.querySelector(`#${winId}-flatten-group`),
    structPreview: win.querySelector(`#${winId}-struct-preview`)
  };

  let fileContentStr = "";
  let fileContentBlob = null;
  let originalImage = null;

  dom.btnCancel.onclick = () => {
    const closeBtn = win.querySelector(".close-btn");
    if (closeBtn) closeBtn.click();
  };

  function updateHistoryUI() {
    if (conversionHistory.length === 0) {
      dom.historyList.innerHTML = `<div style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;padding:10px 0;">No conversions yet</div>`;
      return;
    }
    dom.historyList.innerHTML = conversionHistory
      .slice(-3)
      .reverse()
      .map(
        (h, index) => `
        <div class="history-item">
          <div class="history-name" title="${h.convertedName}">${h.convertedName}</div>
          <span class="history-undo" data-index="${conversionHistory.length - 1 - index}">Undo</span>
        </div>
      `
      )
      .join("");

    dom.historyList.querySelectorAll(".history-undo").forEach((btn) => {
      btn.onclick = async () => {
        const hIdx = parseInt(btn.dataset.index);
        const item = conversionHistory[hIdx];
        if (!item) return;

        try {
          await fs.deleteItem(item.convertedPath, item.convertedName);
          if (item.originalBackup) {
            if (item.originalBackup instanceof Blob) {
              await fs.writeBinaryFile(item.originalPath, item.originalName, item.originalBackup);
            } else {
              await fs.updateFile(item.originalPath, item.originalName, item.originalBackup);
            }
          }
          wm.sendNotify(`Reverted conversion of "${item.originalName}"`);
          conversionHistory.splice(hIdx, 1);
          updateHistoryUI();
          if (onComplete) onComplete();
        } catch (err) {
          wm.sendNotify("Undo operation failed.");
        }
      };
    });
  }

  updateHistoryUI();

  const formatDisplay = win.querySelector(`#${winId}-target-format-display`);
  const formatDropdown = win.querySelector(`#${winId}-target-format-dropdown`);
  const formatText = win.querySelector(`#${winId}-target-format-text`);

  if (formatDisplay && formatDropdown) {
    formatDisplay.onclick = () => {
      const isVisible = formatDropdown.style.display === "block";
      formatDropdown.style.display = isVisible ? "none" : "block";
    };

    const options = formatDropdown.querySelectorAll(".custom-select-option");
    options.forEach((opt) => {
      opt.onclick = () => {
        const val = opt.dataset.value;
        dom.targetFormat.value = val;
        formatText.textContent = val.toUpperCase();
        formatDropdown.style.display = "none";
        if (dom.targetFormat.onchange) dom.targetFormat.onchange();
      };
    });

    win.addEventListener("click", (e) => {
      if (!formatDisplay.contains(e.target) && !formatDropdown.contains(e.target)) {
        formatDropdown.style.display = "none";
      }
    });
  }

  if (category === "image") {
    dom.alpha.onchange = () => {
      dom.alphaColorGroup.style.display = dom.alpha.checked ? "flex" : "none";
    };

    dom.targetFormat.onchange = () => {
      const target = dom.targetFormat.value;
      if (target === "jpg" || target === "jpeg" || target === "webp") {
        dom.qualityGroup.style.display = "flex";
      } else {
        dom.qualityGroup.style.display = "none";
      }
    };

    dom.quality.oninput = () => {
      dom.qualityVal.textContent = `${dom.quality.value}%`;
    };

    readAsBlob(fs, currentPath, fileName)
      .then((blob) => {
        fileContentBlob = blob;
        dom.sizeInfo.textContent = `${(blob.size / 1024).toFixed(1)} KB`;

        const img = new Image();
        img.onload = () => {
          originalImage = img;
          dom.width.placeholder = img.naturalWidth;
          dom.height.placeholder = img.naturalHeight;
        };
        img.src = URL.createObjectURL(blob);
      })
      .catch(() => {
        dom.sizeInfo.textContent = "Error";
      });
  } else if (category === "text") {
    readAsText(fs, currentPath, fileName)
      .then((text) => {
        fileContentStr = text;
        dom.sizeInfo.textContent = `${(new Blob([text]).size / 1024).toFixed(1)} KB`;
        updateTextPreviewAndStats();
      })
      .catch(() => {
        dom.sizeInfo.textContent = "Error";
      });

    dom.cleanup.onchange = updateTextPreviewAndStats;
    dom.sanitize.onchange = updateTextPreviewAndStats;
    dom.stats.onchange = updateTextPreviewAndStats;
  } else if (category === "structured") {
    dom.targetFormat.onchange = () => {
      const target = dom.targetFormat.value;
      if (target === "csv" || target === "tsv") {
        dom.flattenGroup.style.display = "flex";
        dom.csvDelimGroup.style.display = "none";
      } else {
        dom.flattenGroup.style.display = "none";
        dom.csvDelimGroup.style.display = "none";
      }
    };

    readAsText(fs, currentPath, fileName)
      .then((text) => {
        fileContentStr = text;
        dom.sizeInfo.textContent = `${(new Blob([text]).size / 1024).toFixed(1)} KB`;
        updateStructPreview();
      })
      .catch(() => {
        dom.sizeInfo.textContent = "Error";
      });

    dom.pretty.onchange = updateStructPreview;
    dom.autodetect.onchange = updateStructPreview;
    dom.flatten.onchange = updateStructPreview;
  }

  function updateTextPreviewAndStats() {
    let text = fileContentStr;
    if (dom.cleanup.checked) {
      text = text.replace(/\s+/g, " ").trim();
    }

    if (dom.stats.checked) {
      dom.statsPanel.style.display = "grid";
      const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
      const charCount = text.length;
      const lineCount = fileContentStr.split("\n").length;
      dom.statWords.textContent = wordCount;
      dom.statChars.textContent = charCount;
      dom.statLines.textContent = lineCount;
    } else {
      dom.statsPanel.style.display = "none";
    }

    let previewHtml = text.slice(0, 800);
    if (text.length > 800) previewHtml += "\n... [content truncated for preview]";
    dom.textPreview.textContent = previewHtml;
  }

  function updateStructPreview() {
    try {
      let parsed = null;
      if (ext === "json") {
        parsed = JSON.parse(fileContentStr);
      } else if (ext === "csv") {
        parsed = csvToJson(fileContentStr, ",");
      } else if (ext === "tsv") {
        parsed = csvToJson(fileContentStr, "\t");
      } else if (ext === "xml") {
        parsed = xmlToJson(fileContentStr);
      } else if (ext === "yaml" || ext === "yml") {
        parsed = yamlToJson(fileContentStr);
      }

      if (!parsed) {
        dom.structPreview.innerHTML = `<div style="padding:12px;color:#e06c75;">Unable to parse structured data</div>`;
        return;
      }

      let arr = Array.isArray(parsed) ? parsed : [parsed];
      if (dom.flatten.checked) {
        arr = arr.map((item) => (typeof item === "object" ? flattenJson(item) : item));
      }

      const sample = arr.slice(0, 5);
      const keys = [
        ...new Set(
          sample.flatMap((item) => (typeof item === "object" && item !== null ? Object.keys(item) : ["Value"]))
        )
      ];

      let tableHtml = `<table class="preview-table"><thead><tr>`;
      keys.forEach((k) => {
        tableHtml += `<th>${k}</th>`;
      });
      tableHtml += `</tr></thead><tbody>`;

      sample.forEach((item) => {
        tableHtml += `<tr>`;
        keys.forEach((k) => {
          const val = typeof item === "object" && item !== null ? item[k] : item;
          tableHtml += `<td title="${val === undefined ? "" : val}">${val === undefined ? "" : val}</td>`;
        });
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table>`;

      dom.structPreview.innerHTML = tableHtml;
    } catch (err) {
      dom.structPreview.innerHTML = `<div style="padding:12px;color:#e06c75;">Error parsing preview: ${err.message}</div>`;
    }
  }

  dom.btnConvert.onclick = async () => {
    const targetFormat = dom.targetFormat.value;
    const finalName = `${dom.outputName.value}.${targetFormat}`;

    dom.btnConvert.disabled = true;
    dom.progressContainer.style.display = "flex";
    dom.progressFill.style.width = "20%";
    dom.progressText.textContent = "Loading original file...";

    setTimeout(async () => {
      try {
        let outputBlob = null;
        let outputText = null;

        if (category === "image") {
          if (!originalImage) throw new Error("Image not fully loaded.");

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          let w = parseInt(dom.width.value) || originalImage.naturalWidth;
          let h = parseInt(dom.height.value) || originalImage.naturalHeight;
          const scaleVal = parseFloat(dom.scale.value) || 100;

          if (scaleVal !== 100) {
            w = Math.round(w * (scaleVal / 100));
            h = Math.round(h * (scaleVal / 100));
          }

          canvas.width = w;
          canvas.height = h;

          dom.progressFill.style.width = "50%";
          dom.progressText.textContent = "Rendering onto Canvas...";

          if (dom.alpha.checked) {
            ctx.fillStyle = dom.bgcolor.value;
            ctx.fillRect(0, 0, w, h);
          }

          ctx.drawImage(originalImage, 0, 0, w, h);

          dom.progressFill.style.width = "75%";
          dom.progressText.textContent = "Compressing & encoding...";

          let mime = `image/${targetFormat}`;
          if (targetFormat === "jpg") mime = "image/jpeg";
          if (targetFormat === "svg") mime = "image/svg+xml";

          const q = (parseInt(dom.quality.value) || 90) / 100;

          outputBlob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), mime, q);
          });

          if (!outputBlob) throw new Error("Canvas encoding failed.");
        } else if (category === "text") {
          let text = fileContentStr;
          if (dom.cleanup.checked) {
            text = text.replace(/\s+/g, " ").trim();
          }

          const target = targetFormat;
          if (ext === "txt") {
            if (target === "md") outputText = text;
            else if (target === "html")
              outputText = `<pre style="font-family:monospace;color:#fff;background:#1e1e24;padding:12px;border-radius:6px;overflow:auto;">${text}</pre>`;
            else if (target === "json") outputText = JSON.stringify({ content: text }, null, 2);
          } else if (ext === "md") {
            if (target === "txt") outputText = stripMd(text);
            else if (target === "html") outputText = mdToHtml(text);
            else if (target === "json") outputText = JSON.stringify({ markdown: text, html: mdToHtml(text) }, null, 2);
          } else if (ext === "html") {
            if (target === "txt") {
              const div = document.createElement("div");
              div.innerHTML = text;
              outputText = div.textContent || div.innerText || "";
            } else if (target === "md") {
              outputText = htmlToMd(text);
            } else if (target === "json") {
              outputText = JSON.stringify({ html: text }, null, 2);
            }
          } else if (ext === "json") {
            if (target === "txt") {
              outputText = text;
            } else if (target === "html") {
              outputText = `<pre>${text}</pre>`;
            } else if (target === "md") {
              try {
                const parsed = JSON.parse(text);
                outputText = `## JSON Data Export\n\n` + jsonToYaml(parsed);
              } catch {
                outputText = text;
              }
            }
          }
        } else if (category === "structured") {
          let parsed = null;
          if (ext === "json") {
            parsed = JSON.parse(fileContentStr);
          } else if (ext === "csv") {
            parsed = csvToJson(fileContentStr, ",");
          } else if (ext === "tsv") {
            parsed = csvToJson(fileContentStr, "\t");
          } else if (ext === "xml") {
            parsed = xmlToJson(fileContentStr);
          } else if (ext === "yaml" || ext === "yml") {
            parsed = yamlToJson(fileContentStr);
          }

          if (!parsed) throw new Error("Failed to parse source file.");

          let arr = Array.isArray(parsed) ? parsed : [parsed];
          if (dom.flatten.checked) {
            arr = arr.map((item) => (typeof item === "object" ? flattenJson(item) : item));
          }

          const target = targetFormat;
          if (target === "json") {
            outputText = JSON.stringify(arr, null, dom.pretty.checked ? 2 : 0);
          } else if (target === "csv") {
            outputText = jsonToCsv(arr, ",");
          } else if (target === "tsv") {
            outputText = jsonToCsv(arr, "\t");
          } else if (target === "xml") {
            outputText = jsonToXml(parsed, "root");
          } else if (target === "yaml") {
            outputText = jsonToYaml(parsed);
          }
        }

        dom.progressFill.style.width = "90%";
        dom.progressText.textContent = "Exporting to virtual filesystem...";

        const exists = await fs.exists(fs.join(fs.resolveUserPath(currentPath), finalName));
        if (exists && !dom.overwrite.checked) {
          throw new Error(`File "${finalName}" already exists. Check Overwrite to replace.`);
        }

        if (exists) {
          await fs.deleteItem(currentPath, finalName);
        }

        if (outputBlob) {
          await fs.writeBinaryFile(currentPath, finalName, outputBlob);
        } else if (outputText !== null) {
          await fs.createFile(currentPath, finalName, outputText);
        } else {
          throw new Error("Transformed content is empty.");
        }

        conversionHistory.push({
          originalPath: [...currentPath],
          originalName: fileName,
          originalBackup: fileContentBlob || fileContentStr,
          convertedPath: [...currentPath],
          convertedName: finalName,
          timestamp: Date.now()
        });

        dom.progressFill.style.width = "100%";
        dom.progressText.textContent = "Conversion Completed successfully!";
        wm.sendNotify(`Successfully converted to "${finalName}"`);

        updateHistoryUI();

        if (onComplete) onComplete();

        if (dom.autoOpen.checked) {
          setTimeout(async () => {
            const { openFileWith } = await import("../fileDisplay.js");
            if (openFileWith) {
              openFileWith({
                name: finalName,
                path: [...currentPath],
                fs: fs,
                notepadApp: services.notepadApp,
                browserApp: services.browserApp,
                windowManager: wm,
                officeApp: services.officeApp,
                markdownApp: services.markdownApp,
                jsDosApp: services.jsDosApp,
                appLauncher: services.appLauncher
              });
            }
          }, 300);
        }
      } catch (err) {
        wm.sendNotify(`Conversion Error: ${err.message}`);
        dom.progressText.textContent = `Error: ${err.message}`;
        dom.progressFill.style.width = "0%";
      } finally {
        dom.btnConvert.disabled = false;
      }
    }, 400);
  };
}
