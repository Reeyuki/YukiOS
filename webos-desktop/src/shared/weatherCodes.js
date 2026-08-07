export const WEATHER_CODES = {
  0: { label: "Clear Sky", icon: "fas fa-sun" },
  1: { label: "Mainly Clear", icon: "fas fa-sun" },
  2: { label: "Partly Cloudy", icon: "fas fa-cloud-sun" },
  3: { label: "Overcast", icon: "fas fa-cloud" },
  45: { label: "Foggy", icon: "fas fa-smog" },
  48: { label: "Icy Fog", icon: "fas fa-smog" },
  51: { label: "Light Drizzle", icon: "fas fa-cloud-rain" },
  53: { label: "Drizzle", icon: "fas fa-cloud-rain" },
  55: { label: "Heavy Drizzle", icon: "fas fa-cloud-showers-heavy" },
  61: { label: "Light Rain", icon: "fas fa-cloud-rain" },
  63: { label: "Rain", icon: "fas fa-cloud-showers-heavy" },
  65: { label: "Heavy Rain", icon: "fas fa-cloud-showers-heavy" },
  71: { label: "Light Snow", icon: "fas fa-snowflake" },
  73: { label: "Snow", icon: "fas fa-snowflake" },
  75: { label: "Heavy Snow", icon: "fas fa-snowflake" },
  80: { label: "Rain Showers", icon: "fas fa-cloud-showers-heavy" },
  81: { label: "Showers", icon: "fas fa-cloud-showers-heavy" },
  82: { label: "Violent Showers", icon: "fas fa-cloud-showers-heavy" },
  95: { label: "Thunderstorm", icon: "fas fa-bolt" },
  96: { label: "Thunderstorm w/ Hail", icon: "fas fa-cloud-bolt" },
  99: { label: "Thunderstorm w/ Hail", icon: "fas fa-cloud-bolt" }
};

export function getWeatherIcon(code) {
  return (WEATHER_CODES[code] || { label: "Unknown", icon: "fas fa-cloud" }).icon;
}

export function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { label: "Unknown", icon: "🌡️" };
}
