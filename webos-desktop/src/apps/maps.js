import "../styles/maps.css";

import { BaseApp, os } from "../framework.js";
import { getWispUrl } from "../shared/wispConfig.js";
import { $, $$, bindEvent } from "../shared/domUtils.js";

const SOURCE_OPTIONS = [
  { value: "osm", label: "OpenStreetMap" },
  { value: "google", label: "Google Maps" }
];

const LAYER_OPTIONS = [
  { value: "mapnik", label: "Standard" },
  { value: "cycle", label: "Cycle Map" },
  { value: "transport", label: "Transport" }
];

export class MapsApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open() {
    this.state = {
      source: "osm",
      osmLayer: "mapnik",
      osmZoom: 5,
      osmLat: 20,
      osmLng: 0,
      settingsOpen: false
    };

    const win = os.window.create("maps-window", "Maps", "900px", "650px", { icon: "fas fa-map" });
    win.innerHTML = `
<div class="maps-container">
  <div class="maps-toolbar">
    <span class="maps-title"><i class="fas fa-map"></i> Maps</span>
    <div class="maps-toolbar-right">
      <span class="maps-source-label" id="maps-source-label">OpenStreetMap</span>
      <button class="maps-settings-btn" id="maps-settings-btn" title="Maps Settings">
        <i class="fas fa-cog"></i>
      </button>
    </div>
  </div>
  <iframe id="maps-iframe" class="maps-iframe" allow="geolocation" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
  <div class="maps-settings-overlay" id="maps-settings-overlay"></div>
  <div class="maps-settings-panel" id="maps-settings-panel">
    <div class="maps-settings-header">
      <span>Maps Settings</span>
      <button id="maps-settings-close"><i class="fas fa-times"></i></button>
    </div>
    <div class="maps-settings-body">
      <div class="maps-setting-row">
        <label>Map Source</label>
        <div class="maps-custom-select" id="maps-source-select">
          <div class="maps-custom-select-trigger" id="maps-source-trigger">
            <span class="maps-custom-select-text">OpenStreetMap</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="maps-custom-select-options" id="maps-source-options">
            ${SOURCE_OPTIONS.map((o) => `<div class="maps-custom-select-option" data-value="${o.value}">${o.label}</div>`).join("")}
          </div>
        </div>
      </div>
      <div class="maps-osm-settings" id="maps-osm-settings">
        <div class="maps-setting-row">
          <label>Tile Layer</label>
          <div class="maps-custom-select" id="maps-layer-select">
            <div class="maps-custom-select-trigger" id="maps-layer-trigger">
              <span class="maps-custom-select-text">Standard</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="maps-custom-select-options" id="maps-layer-options">
              ${LAYER_OPTIONS.map((o) => `<div class="maps-custom-select-option" data-value="${o.value}">${o.label}</div>`).join("")}
            </div>
          </div>
        </div>
        <div class="maps-setting-row">
          <label>Latitude</label>
          <input type="number" id="maps-lat-input" step="0.01" min="-90" max="90" />
        </div>
        <div class="maps-setting-row">
          <label>Longitude</label>
          <input type="number" id="maps-lng-input" step="0.01" min="-180" max="180" />
        </div>
        <div class="maps-setting-row">
          <label>Zoom (1-19)</label>
          <input type="number" id="maps-zoom-input" min="1" max="19" />
        </div>
      </div>
      <button class="maps-apply-btn" id="maps-apply-btn">Apply</button>
    </div>
  </div>
</div>`;

    bindEvent($("#maps-settings-btn"), "click", (e) => {
      e.stopPropagation();
      this.state.settingsOpen = true;
      this.syncSettingsPanel(this.state);
    });

    bindEvent($("#maps-settings-close"), "click", (e) => {
      e.stopPropagation();
      this.state.settingsOpen = false;
      this.syncSettingsPanel(this.state);
      this.closeAllDropdowns();
    });

    bindEvent($("#maps-settings-overlay"), "click", (e) => {
      e.stopPropagation();
      this.state.settingsOpen = false;
      this.syncSettingsPanel(this.state);
      this.closeAllDropdowns();
    });

    bindEvent($("#maps-apply-btn"), "click", (e) => {
      e.stopPropagation();
      const sourceText = $("#maps-source-trigger .maps-custom-select-text");
      const source = sourceText ? this.getValueForLabel(sourceText.textContent, SOURCE_OPTIONS) : "osm";
      this.state.source = source;
      if (source === "osm") {
        const layerText = $("#maps-layer-trigger .maps-custom-select-text");
        this.state.osmLayer = layerText ? this.getValueForLabel(layerText.textContent, LAYER_OPTIONS) : "mapnik";
        this.state.osmLat = parseFloat(document.getElementById("maps-lat-input").value) || 20;
        this.state.osmLng = parseFloat(document.getElementById("maps-lng-input").value) || 0;
        this.state.osmZoom = parseInt(document.getElementById("maps-zoom-input").value, 10) || 5;
      }
      this.state.settingsOpen = false;
      this.syncSettingsPanel(this.state);
      this.updateMap(this.state);
    });

    this.initMaps(null, null, null, this.state);
  }

  getValueForLabel(label, options) {
    const found = options.find((o) => o.label === label);
    return found ? found.value : options[0].value;
  }

  getLabelForValue(value, options) {
    const found = options.find((o) => o.value === value);
    return found ? found.label : options[0].label;
  }

  initCustomSelect(triggerId, optionsId, options, initialValue, onSelect) {
    const trigger = $(`#${triggerId}`);
    const optionsEl = $(`#${optionsId}`);
    if (!trigger || !optionsEl) return;

    bindEvent(trigger, "click", (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      trigger.classList.toggle("open");
      optionsEl.classList.toggle("open");
    });

    const optionEls = $$(`#${optionsId} .maps-custom-select-option`);
    optionEls.forEach((opt) => {
      bindEvent(opt, "click", (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        const label = opt.textContent;
        trigger.querySelector(".maps-custom-select-text").textContent = label;
        trigger.classList.remove("open");
        optionsEl.classList.remove("open");
        optionEls.forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        if (onSelect) onSelect(val);
      });
    });

    const initLabel = this.getLabelForValue(initialValue, options);
    trigger.querySelector(".maps-custom-select-text").textContent = initLabel;
    this.selectOptionByValue(optionsId, initialValue);
  }

  selectOptionByValue(optionsId, value) {
    const optionsEl = $(`#${optionsId}`);
    if (!optionsEl) return;
    const optionEls = $$(`#${optionsId} .maps-custom-select-option`);
    optionEls.forEach((o) => {
      o.classList.toggle("selected", o.dataset.value === value);
    });
  }

  closeAllDropdowns() {
    const triggers = $$(".maps-custom-select-trigger.open");
    const options = $$(".maps-custom-select-options.open");
    triggers.forEach((t) => t.classList.remove("open"));
    options.forEach((o) => o.classList.remove("open"));
  }

  initMaps(payload, event, element, state) {
    this.initCustomSelect("maps-source-trigger", "maps-source-options", SOURCE_OPTIONS, state.source, (val) => {
      const label = this.getLabelForValue(val, SOURCE_OPTIONS);
      const sourceLabel = document.getElementById("maps-source-label");
      if (sourceLabel) sourceLabel.textContent = label;
      const osmSettings = document.getElementById("maps-osm-settings");
      if (osmSettings) osmSettings.classList.toggle("hidden", val !== "osm");
    });

    this.initCustomSelect("maps-layer-trigger", "maps-layer-options", LAYER_OPTIONS, state.osmLayer);

    bindEvent(document, "click", () => {
      this.closeAllDropdowns();
    });

    this.syncSettingsPanel(state);
    this.updateMap(state);
  }

  syncSettingsPanel(state) {
    const panel = document.getElementById("maps-settings-panel");
    const overlay = document.getElementById("maps-settings-overlay");
    const sourceLabel = document.getElementById("maps-source-label");
    const latInput = document.getElementById("maps-lat-input");
    const lngInput = document.getElementById("maps-lng-input");
    const zoomInput = document.getElementById("maps-zoom-input");
    const osmSettings = document.getElementById("maps-osm-settings");

    if (panel) panel.classList.toggle("open", state.settingsOpen);
    if (overlay) overlay.classList.toggle("open", state.settingsOpen);

    if (sourceLabel) {
      sourceLabel.textContent = this.getLabelForValue(state.source, SOURCE_OPTIONS);
    }

    const sourceText = $("#maps-source-trigger .maps-custom-select-text");
    if (sourceText) sourceText.textContent = this.getLabelForValue(state.source, SOURCE_OPTIONS);
    this.selectOptionByValue("maps-source-options", state.source);

    const layerText = $("#maps-layer-trigger .maps-custom-select-text");
    if (layerText) layerText.textContent = this.getLabelForValue(state.osmLayer, LAYER_OPTIONS);
    this.selectOptionByValue("maps-layer-options", state.osmLayer);

    if (latInput) latInput.value = state.osmLat;
    if (lngInput) lngInput.value = state.osmLng;
    if (zoomInput) zoomInput.value = state.osmZoom;
    if (osmSettings) {
      osmSettings.classList.toggle("hidden", state.source !== "osm");
    }
  }

  updateMap(state) {
    const iframe = document.getElementById("maps-iframe");
    if (!iframe) return;

    if (state.source === "osm") {
      iframe.src = this.buildOsmUrl(state);
    } else {
      iframe.src = this.buildGoogleUrl(state);
    }
  }

  buildOsmUrl(state) {
    const { osmLat, osmLng, osmZoom, osmLayer } = state;
    const bbox = this.calculateBbox(osmLat, osmLng, osmZoom);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=${osmLayer}&marker=${osmLat},${osmLng}`;
  }

  calculateBbox(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const top = ((2 * Math.atan(Math.exp(mercN - Math.PI / n)) - Math.PI / 2) * 180) / Math.PI;
    const bottom = ((2 * Math.atan(Math.exp(mercN + Math.PI / n)) - Math.PI / 2) * 180) / Math.PI;
    const lngDiff = 360 / n;
    const left = lng - lngDiff / 2;
    const right = lng + lngDiff / 2;
    return `${left.toFixed(6)},${bottom.toFixed(6)},${right.toFixed(6)},${top.toFixed(6)}`;
  }

  buildGoogleUrl(state) {
    const wispUrl = getWispUrl();
    return (
      window.location.origin +
      "/scramapps/scramjet-template.html?wisp=" +
      encodeURIComponent(wispUrl) +
      "&target=" +
      encodeURIComponent("https://www.google.com/maps")
    );
  }

  onClose(winId) {}
}
