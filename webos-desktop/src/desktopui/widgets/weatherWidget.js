import { WidgetBase } from "../widgetManager.js";
import { getWeatherInfo } from "../../shared/weatherCodes.js";
import { detectUserLocation, getCached, setCache } from "../../apps/weather.js";

export class WeatherWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "weather", "Weather", 220, 160);
    this.cityOverride = "";
  }

  getConfigFields() {
    return [
      {
        key: "cityOverride",
        label: "City (leave empty for auto-detect)",
        type: "text",
        value: this.cityOverride,
        default: ""
      }
    ];
  }

  applyConfig(data) {
    this.cityOverride = data.cityOverride || "";
    this.fetchWeather();
    this.manager.saveState();
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-weather-main">
        <span class="widget-weather-icon" id="w-weather-icon-${this.id}"><i class="fas fa-cloud-sun"></i></span>
        <span class="widget-weather-temp" id="w-weather-temp-${this.id}">--°</span>
      </div>
      <div class="widget-weather-desc" id="w-weather-desc-${this.id}"></div>
      <div class="widget-weather-details" id="w-weather-details-${this.id}"></div>
    `;
    this.fetchWeather();
  }

  async fetchWeather() {
    try {
      const loc = await detectUserLocation();
      const cacheKey = `yukiOS_weather_widget_${loc.latitude.toFixed(2)}_${loc.longitude.toFixed(2)}`;
      let weatherData = getCached(cacheKey);
      if (!weatherData) {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m`
        );
        weatherData = await res.json();
        setCache(cacheKey, weatherData);
      }

      const cur = weatherData.current;
      const temp = Math.round(cur.temperature_2m);
      const code = cur.weather_code;
      const info = getWeatherInfo(code);
      const city = loc.city;

      const iconEl = document.getElementById(`w-weather-icon-${this.id}`);
      const tempEl = document.getElementById(`w-weather-temp-${this.id}`);
      const descEl = document.getElementById(`w-weather-desc-${this.id}`);
      const detailsEl = document.getElementById(`w-weather-details-${this.id}`);

      if (iconEl) iconEl.textContent = info.icon;
      if (tempEl) tempEl.textContent = `${temp}°C`;
      if (descEl) descEl.textContent = `${info.label} - ${city}`;
      if (detailsEl && cur.relative_humidity_2m != null && cur.wind_speed_10m != null) {
        detailsEl.textContent = `Humidity: ${cur.relative_humidity_2m}%  Wind: ${cur.wind_speed_10m} km/h`;
      }
    } catch {
      const el = document.getElementById(`w-weather-temp-${this.id}`);
      if (el) el.textContent = "N/A";
      const desc = document.getElementById(`w-weather-desc-${this.id}`);
      if (desc) desc.textContent = "Could not load weather";
    }
  }
}
