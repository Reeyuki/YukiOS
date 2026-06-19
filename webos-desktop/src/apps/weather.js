import "../styles/weather.css";
import { getWeatherInfo } from "../shared/weatherCodes.js";
import { WindowHelper } from "../utils/WindowHelper.js";

import { BaseApp, PersistenceTypes, os } from "../framework.js";
const WEATHER_CACHE_TTL = 10 * 60 * 1000;
const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000;
function getCached(key, ttl = WEATHER_CACHE_TTL) {
  try {
    const raw = os.storage.get(key);
    if (!raw) return null;
    const { ts, data } = raw;
    if (Date.now() - ts > ttl) {
      os.storage.remove(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
function setCache(key, data) {
  try {
    os.storage.set(key, { ts: Date.now(), data });
  } catch {}
}

export { getCached, setCache };

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
export class WeatherApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.unit = "metric";
    this.currentCity = null;
    this.currentCoords = null;
    this._declarativeApp = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "weather-win",
      name: "Weather",
      icon: "fas fa-cloud",
      singleton: true,
      windows: [
        {
          id: "weather-win",
          title: "Weather",
          size: ["420px", "560px"],
          icon: "fas fa-cloud",
          ui: `
      <div class="window-content">
        <div class="wx-toolbar">
          <button class="wx-loc-btn" id="wx-loc-btn" title="Use my location"><svg width="10" height="12" viewBox="0 0 10 14" fill="currentColor"><path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg></button>
          <input class="wx-search" id="wx-search-input" type="text" placeholder="Search city..." />
          <button class="wx-btn" id="wx-search-btn">GO</button>
          <button class="wx-unit-toggle" id="wx-unit-btn">°C</button>
        </div>
        <div class="wx-body" id="wx-body"></div>
      </div>`,
          events: {
            "#wx-loc-btn": {
              click: {
                type: "custom:autoLocate",
                stopPropagation: true
              }
            },
            "#wx-search-btn": {
              click: {
                type: "custom:searchCity",
                stopPropagation: true
              }
            },
            "#wx-search-input": {
              keydown: {
                type: "custom:searchOnEnter",
                stopPropagation: false
              }
            },
            "#wx-unit-btn": {
              click: {
                type: "custom:toggleUnit",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          unit: "metric",
          currentCity: null,
          currentCoords: null,
          currentWeatherData: null
        },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        autoLocate: async (payload, event, element, state) => {
          const body = document.getElementById("wx-body");
          const searchInput = document.getElementById("wx-search-input");
          if (body) {
            this.renderLoading(body);
            try {
              const loc = await detectUserLocation();
              state.currentCoords = { latitude: loc.latitude, longitude: loc.longitude };
              state.currentCity = loc.city;
              const data = await this.fetchWeatherByCoords(loc.latitude, loc.longitude, loc.city, loc.country);
              state.currentWeatherData = data;
              this.renderWeather(body, data);
              if (searchInput) searchInput.value = loc.city;
            } catch (e) {
              this.renderError(body, e.message || "Failed to detect location.");
            }
          }
        },
        searchCity: async (payload, event, element, state) => {
          const body = document.getElementById("wx-body");
          const searchInput = document.getElementById("wx-search-input");
          const city = searchInput ? searchInput.value.trim() : "";
          if (city && body) {
            this.renderLoading(body);
            try {
              const data = await this.fetchWeatherByCity(city);
              state.currentWeatherData = data;
              state.currentCoords = { ...this.currentCoords };
              state.currentCity = this.currentCity;
              this.renderWeather(body, data);
            } catch (e) {
              this.renderError(body, e.message || "Failed to load weather.");
            }
          }
        },
        searchOnEnter: async (payload, event, element, state) => {
          if (event.key === "Enter") {
            const body = document.getElementById("wx-body");
            const searchInput = document.getElementById("wx-search-input");
            const city = searchInput ? searchInput.value.trim() : "";
            if (city && body) {
              this.renderLoading(body);
              try {
                const data = await this.fetchWeatherByCity(city);
                state.currentWeatherData = data;
                state.currentCoords = { ...this.currentCoords };
                state.currentCity = this.currentCity;
                this.renderWeather(body, data);
              } catch (e) {
                this.renderError(body, e.message || "Failed to load weather.");
              }
            }
          }
        },
        toggleUnit: async (payload, event, element, state) => {
          state.unit = state.unit === "metric" ? "imperial" : "metric";
          this.unit = state.unit;
          const unitBtn = document.getElementById("wx-unit-btn");
          if (unitBtn) unitBtn.textContent = state.unit === "metric" ? "°C" : "°F";
          const body = document.getElementById("wx-body");
          if (body && state.currentCoords) {
            this.renderLoading(body);
            try {
              const data = await this.fetchWeatherByCoords(
                state.currentCoords.latitude,
                state.currentCoords.longitude,
                state.currentCity,
                state.currentWeatherData?.country ?? ""
              );
              state.currentWeatherData = data;
              this.renderWeather(body, data);
            } catch (e) {
              this.renderError(body, e.message || "Failed to reload weather.");
            }
          }
        }
      },
      onMount: "initWeather"
    };
  }

  initWeather(payload, event, element, state) {
    this.wxBody = document.getElementById("wx-body");
    const searchInput = document.getElementById("wx-search-input");
    this.renderPlaceholder(this.wxBody, "Weather");
    this.initializeWeather(this.wxBody, searchInput);
  }

  async fetchWeatherByCoords(latitude, longitude, cityName, country) {
    const tempUnit = this.unit === "imperial" ? "fahrenheit" : "celsius";
    const windUnit = this.unit === "imperial" ? "mph" : "kmh";
    const cacheKey = `yukiOS_weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}_${this.unit}`;
    const cached = getCached(cacheKey);
    if (cached) return { ...cached, cityName, country };

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=10`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API failed");

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
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
  }
  renderWeather(container, data) {
    const cur = data.current;
    const daily = data.daily;

    const unitSymbol = this.unit === "imperial" ? "°F" : "°C";
    const windUnitLabel = this.unit === "imperial" ? "mph" : "km/h";

    const wInfo = this.getWeatherInfo(cur.weather_code);

    const forecastHTML = (daily.time || [])
      .map((date, i) => {
        const info = this.getWeatherInfo(daily.weather_code?.[i]);

        return `
        <div class="wx-forecast-day">
          <span class="wx-fday">${this.getDayName(date, i)}</span>
          <span class="wx-ficon">${info.icon}</span>
          <span class="wx-ftemp">
            <span class="wx-fmax">${Math.round(daily.temperature_2m_max?.[i] ?? 0)}°</span>
            <span class="wx-fmin">${Math.round(daily.temperature_2m_min?.[i] ?? 0)}°</span>
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

      <div class="wx-forecast">
        ${forecastHTML}
      </div>
    </div>
  `;
  }
  renderError(container, message) {
    container.innerHTML = `<div class="wx-error">⚠️ ${message}</div>`;
  }

  renderPlaceholder(container, message = "Check the Weather") {
    container.innerHTML = `
    <div class="wx-placeholder">
      <div class="wx-placeholder-icon">🌤️</div>
      <div class="wx-placeholder-title">${message}</div>
      <div class="wx-placeholder-desc">Get real-time weather for any location</div>
      <div class="wx-placeholder-tips">
        <div class="wx-tip">📍 Click the location button to auto-detect your location</div>
        <div class="wx-tip">🔍 Or search for any city manually</div>
      </div>
    </div>
  `;
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
      this.notify("Weather", `City not found: ${city}`, "error", 4000, "fas fa-search");
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

  async initializeWeather(container, searchInput) {
    const locCacheKey = "wx_user_location";
    const cachedLoc = getCached(locCacheKey, LOCATION_CACHE_TTL);

    if (cachedLoc) {
      this.currentCoords = { latitude: cachedLoc.latitude, longitude: cachedLoc.longitude };
      this.currentCity = cachedLoc.city;
      searchInput.value = cachedLoc.city;

      const appCacheKey = `yukiOS_weather_${cachedLoc.latitude.toFixed(2)}_${cachedLoc.longitude.toFixed(2)}_${this.unit}`;
      const cachedAppData = getCached(appCacheKey);

      if (cachedAppData) {
        this.renderWeather(container, { ...cachedAppData, cityName: cachedLoc.city, country: cachedLoc.country });
        return;
      }
    }

    this.doAutoLocate(container, searchInput);
  }
}
