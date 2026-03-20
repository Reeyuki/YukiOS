import { desktop } from "./desktop.js";
import { getWeatherInfo } from "./shared/weatherCodes.js";

const WEATHER_CACHE_TTL = 10 * 60 * 1000;
const LOCATION_CACHE_TTL = 60 * 60 * 1000;

function getCached(key, ttl = WEATHER_CACHE_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export async function detectUserLocation() {
  const cacheKey = "wx_user_location";
  const cached = getCached(cacheKey, LOCATION_CACHE_TTL);
  if (cached) return cached;
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("Location API failed");
  const data = await res.json();
  if (!data.city) throw new Error("Could not detect location");
  const loc = {
    city: data.city,
    country: data.country_name,
    latitude: data.latitude,
    longitude: data.longitude
  };
  setCache(cacheKey, loc);
  return loc;
}
export class WeatherApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.unit = "metric";
    this.currentCity = null;
    this.currentCoords = null;
  }

  async fetchWeatherByCoords(latitude, longitude, cityName, country) {
    const tempUnit = this.unit === "imperial" ? "fahrenheit" : "celsius";
    const windUnit = this.unit === "imperial" ? "mph" : "kmh";
    const cacheKey = `wx_${latitude.toFixed(2)}_${longitude.toFixed(2)}_${this.unit}`;
    const cached = getCached(cacheKey);
    if (cached) return { ...cached, cityName, country };
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=5`;
    const res = await fetch(url);
    const data = await res.json();
    setCache(cacheKey, data);
    return { ...data, cityName, country };
  }

  async fetchWeatherByCity(city) {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error("City not found");
    }
    const { latitude, longitude, name, country } = geoData.results[0];
    this.currentCoords = { latitude, longitude };
    this.currentCity = name;
    return this.fetchWeatherByCoords(latitude, longitude, name, country);
  }

  getWeatherInfo(code) {
    return getWeatherInfo(code);
  }

  getDayName(dateStr, index) {
    if (index === 0) return "Today";
    if (index === 1) return "Tomorrow";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" });
  }

  renderWeather(container, data) {
    const cur = data.current;
    const daily = data.daily;
    const unitSymbol = this.unit === "imperial" ? "°F" : "°C";
    const windUnitLabel = this.unit === "imperial" ? "mph" : "km/h";
    const wInfo = this.getWeatherInfo(cur.weather_code);

    const forecastHTML = daily.time
      .slice(0, 5)
      .map((date, i) => {
        const info = this.getWeatherInfo(daily.weather_code[i]);
        return `
        <div class="wx-forecast-day">
          <span class="wx-fday">${this.getDayName(date, i)}</span>
          <span class="wx-ficon">${info.icon}</span>
          <span class="wx-ftemp">
            <span class="wx-fmax">${Math.round(daily.temperature_2m_max[i])}°</span>
            <span class="wx-fmin">${Math.round(daily.temperature_2m_min[i])}°</span>
          </span>
        </div>
      `;
      })
      .join("");

    container.innerHTML = `
      <div class="wx-main">
        <div class="wx-hero">
          <div class="wx-location">${data.cityName}, ${data.country}</div>
          <div class="wx-icon-big">${wInfo.icon}</div>
          <div class="wx-temp-big">${Math.round(cur.temperature_2m)}${unitSymbol}</div>
          <div class="wx-condition">${wInfo.label}</div>
          <div class="wx-feels">Feels like ${Math.round(cur.apparent_temperature)}${unitSymbol}</div>
        </div>
        <div class="wx-stats">
          <div class="wx-stat">
            <span class="wx-stat-icon">💧</span>
            <span class="wx-stat-val">${cur.relative_humidity_2m}%</span>
            <span class="wx-stat-label">Humidity</span>
          </div>
          <div class="wx-stat">
            <span class="wx-stat-icon">💨</span>
            <span class="wx-stat-val">${Math.round(cur.wind_speed_10m)} ${windUnitLabel}</span>
            <span class="wx-stat-label">Wind</span>
          </div>
          <div class="wx-stat">
            <span class="wx-stat-icon">🌧️</span>
            <span class="wx-stat-val">${cur.precipitation} mm</span>
            <span class="wx-stat-label">Precip</span>
          </div>
        </div>
        <div class="wx-forecast">${forecastHTML}</div>
      </div>
    `;
  }

  renderError(container, message) {
    container.innerHTML = `<div class="wx-error">⚠️ ${message}</div>`;
  }

  renderLoading(container, message = "Fetching weather...") {
    container.innerHTML = `<div class="wx-loading"><div class="wx-spinner"></div><span>${message}</span></div>`;
  }

  async doAutoLocate(container, searchInput) {
    this.renderLoading(container, "Detecting your location...");
    try {
      const loc = await detectUserLocation();
      this.currentCoords = { latitude: loc.latitude, longitude: loc.longitude };
      this.currentCity = loc.city;
      searchInput.value = loc.city;
      const data = await this.fetchWeatherByCoords(loc.latitude, loc.longitude, loc.city, loc.country);
      this.renderWeather(container, data);
    } catch (e) {
      this.renderError(container, e.message);
    }
  }

  async doSearch(container, city) {
    this.renderLoading(container);
    try {
      const data = await this.fetchWeatherByCity(city);
      this.renderWeather(container, data);
    } catch (e) {
      this.renderError(container, e.message || "Failed to load weather.");
    }
  }

  async doRefreshWithUnit(container) {
    if (this.currentCoords) {
      this.renderLoading(container);
      try {
        const data = await this.fetchWeatherByCoords(
          this.currentCoords.latitude,
          this.currentCoords.longitude,
          this.currentCity,
          ""
        );
        this.renderWeather(container, data);
      } catch (e) {
        this.renderError(container, e.message || "Failed to reload weather.");
      }
    }
  }

  open(windowManager) {
    const wm = windowManager || this.wm;
    if (document.getElementById("weather-win")) {
      wm.bringToFront(document.getElementById("weather-win"));
      return;
    }

    const win = wm.createWindow("weather-win", "WEATHER", "420px", "560px");
    Object.assign(win.style, { left: "200px", top: "100px" });

    win.innerHTML = `
      <style>
        #weather-win {
          font-family: 'Courier New', monospace;
          background: #0a0a12;
          color: #e8e0f0;
          overflow: hidden;
        }
        #weather-win .window-content {
          padding: 0;
          overflow: hidden;
          height: calc(100% - 32px);
          display: flex;
          flex-direction: column;
        }
        .wx-toolbar {
          display: flex;
          gap: 6px;
          padding: 8px 10px;
          background: #111120;
          border-bottom: 1px solid #2a2a3a;
          align-items: center;
        }
        .wx-search {
          flex: 1;
          background: #1a1a2e;
          border: 1px solid #3a3a5c;
          color: #e8e0f0;
          padding: 4px 8px;
          font-family: 'Courier New', monospace;
          font-size: 1em;
          outline: none;
        }
        .wx-search:focus { border-color: #7b68ee; }
        .wx-btn {
          background: #7b68ee;
          border: none;
          color: #fff;
          padding: 4px 10px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
        }
        .wx-btn:hover { background: #9985f5; }
        .wx-loc-btn {
          background: #1a1a2e;
          border: 1px solid #3a3a5c;
          color: #b0a8d0;
          padding: 4px 7px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
        }
        .wx-loc-btn:hover { border-color: #7b68ee; color: #e8e0f0; }
        .wx-unit-toggle {
          background: #1a1a2e;
          border: 1px solid #3a3a5c;
          color: #b0a8d0;
          padding: 4px 8px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
        }
        .wx-unit-toggle:hover { border-color: #7b68ee; color: #e8e0f0; }
        .wx-body { flex: 1; overflow-y: auto; overflow-x: hidden; }
        .wx-body::-webkit-scrollbar { width: 4px; }
        .wx-body::-webkit-scrollbar-track { background: #0a0a12; }
        .wx-body::-webkit-scrollbar-thumb { background: #3a3a5c; }
        .wx-main { display: flex; flex-direction: column; height: 100%; }
        .wx-hero {
          background: linear-gradient(160deg, #1a0a3a 0%, #0a1a3a 100%);
          padding: 28px 20px 20px;
          text-align: center;
          border-bottom: 1px solid #2a2a4a;
        }
        .wx-location { font-size: 13px; color: #9985f5; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
        .wx-icon-big { font-size: 56px; line-height: 1; margin-bottom: 8px; }
        .wx-temp-big { font-size: 52px; font-weight: bold; letter-spacing: -2px; color: #fff; line-height: 1; }
        .wx-condition { font-size: 14px; color: #b0a8d0; margin-top: 6px; }
        .wx-feels { font-size: 1em; color: #6a6280; margin-top: 4px; }
        .wx-stats {
          display: flex;
          justify-content: space-around;
          padding: 16px 10px;
          border-bottom: 1px solid #1a1a2e;
          background: #0e0e1e;
        }
        .wx-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .wx-stat-icon { font-size: 18px; }
        .wx-stat-val { font-size: 13px; font-weight: bold; color: #e8e0f0; }
        .wx-stat-label { font-size: 10px; color: #6a6280; text-transform: uppercase; letter-spacing: 1px; }
        .wx-forecast { padding: 1em 10px; display: flex; flex-direction: column; gap: 6px; }
        .wx-forecast-day {
          display: flex;
          align-items: center;
          padding: 8px 1em;
          background: #111120;
          border: 1px solid #1e1e32;
          gap: 10px;
        }
        .wx-fday { width: 72px; font-size: 1em; color: #9985f5; text-transform: uppercase; letter-spacing: 1px; }
        .wx-ficon { font-size: 20px; flex: 1; text-align: center; }
        .wx-ftemp { display: flex; gap: 8px; align-items: center; }
        .wx-fmax { font-size: 14px; font-weight: bold; color: #e8e0f0; }
        .wx-fmin { font-size: 1em; color: #6a6280; }
        .wx-loading {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 300px; gap: 14px; color: #6a6280; font-size: 13px;
        }
        .wx-spinner {
          width: 28px; height: 28px;
          border: 2px solid #2a2a4a;
          border-top-color: #7b68ee;
          border-radius: 50%;
          animation: wx-spin 0.8s linear infinite;
        }
        @keyframes wx-spin { to { transform: rotate(360deg); } }
        .wx-error { padding: 40px 20px; text-align: center; color: #e06080; font-size: 13px; }
      </style>
      <div class="window-header">
        <span>WEATHER</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="window-content">
        <div class="wx-toolbar">
          <button class="wx-loc-btn" id="wx-loc-btn" title="Use my location"><svg width="10" height="12" viewBox="0 0 10 14" fill="currentColor"><path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg></button>
          <input class="wx-search" id="wx-search-input" type="text" placeholder="Search city..." />
          <button class="wx-btn" id="wx-search-btn">GO</button>
          <button class="wx-unit-toggle" id="wx-unit-btn">${this.unit === "metric" ? "°F" : "°C"}</button>
        </div>
        <div class="wx-body" id="wx-body"></div>
      </div>
    `;

    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.setupWindowControls(win);
    wm.addToTaskbar(win.id, "Weather", "fas fa-location-crosshairs");

    const body = win.querySelector("#wx-body");
    const searchInput = win.querySelector("#wx-search-input");
    const searchBtn = win.querySelector("#wx-search-btn");
    const unitBtn = win.querySelector("#wx-unit-btn");
    const locBtn = win.querySelector("#wx-loc-btn");

    locBtn.addEventListener("click", () => this.doAutoLocate(body, searchInput));

    searchBtn.addEventListener("click", () => {
      const city = searchInput.value.trim();
      if (city) this.doSearch(body, city);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const city = searchInput.value.trim();
        if (city) this.doSearch(body, city);
      }
    });

    unitBtn.addEventListener("click", () => {
      this.unit = this.unit === "metric" ? "imperial" : "metric";
      unitBtn.textContent = this.unit === "metric" ? "°F" : "°C";
      this.doRefreshWithUnit(body);
    });

    this.doAutoLocate(body, searchInput);
  }
}
