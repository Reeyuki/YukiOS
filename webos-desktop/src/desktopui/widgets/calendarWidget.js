import { WidgetBase } from "../widgetManager.js";
import { getDateKey, getEventsForDate, loadEvents } from "../../shared/calendarUtils.js";

export class CalendarWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "calendar", "Calendar", 280, 220);
    this._currentMonth = new Date();
    this._interval = null;
    this._events = [];
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-calendar-header">
        <button class="widget-calendar-nav" id="w-cal-prev-${this.id}">&lt;</button>
        <span class="widget-calendar-month" id="w-cal-month-${this.id}"></span>
        <button class="widget-calendar-nav" id="w-cal-next-${this.id}">&gt;</button>
      </div>
      <div class="widget-calendar-grid" id="w-cal-grid-${this.id}"></div>
      <div class="widget-calendar-events" id="w-cal-events-${this.id}"></div>
    `;

    contentEl.querySelector(`#w-cal-prev-${this.id}`).addEventListener("click", () => {
      this._currentMonth.setMonth(this._currentMonth.getMonth() - 1);
      this._render();
    });

    contentEl.querySelector(`#w-cal-next-${this.id}`).addEventListener("click", () => {
      this._currentMonth.setMonth(this._currentMonth.getMonth() + 1);
      this._render();
    });

    this._events = loadEvents();
    this._render();
    this._interval = setInterval(() => this._render(), 60000);
  }

  _render() {
    const now = new Date();
    const year = this._currentMonth.getFullYear();
    const month = this._currentMonth.getMonth();
    const ce = this._contentEl;

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    const monthEl = ce.querySelector(`#w-cal-month-${this.id}`);
    if (monthEl) monthEl.textContent = `${monthNames[month]} ${year}`;

    const gridEl = ce.querySelector(`#w-cal-grid-${this.id}`);
    if (!gridEl) return;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;

    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    let html = dayNames.map((d) => `<div class="widget-calendar-day-name">${d}</div>`).join("");

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="widget-calendar-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = getDateKey(year, month, day);
      const events = getEventsForDate(this._events, dateKey);
      const isToday = isCurrentMonth && day === today;
      const hasEvents = events.length > 0;
      html += `<div class="widget-calendar-day ${isToday ? "today" : ""} ${hasEvents ? "has-events" : ""}" data-day="${day}">${day}</div>`;
    }

    gridEl.innerHTML = html;

    const eventsEl = ce.querySelector(`#w-cal-events-${this.id}`);
    if (eventsEl) {
      const todayKey = getDateKey(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEvents = getEventsForDate(this._events, todayKey);
      if (todayEvents.length > 0) {
        eventsEl.innerHTML = todayEvents
          .slice(0, 3)
          .map((e) => `<div class="widget-calendar-event" style="border-left: 3px solid ${e.color}">${e.title}</div>`)
          .join("");
        if (todayEvents.length > 3) {
          eventsEl.innerHTML += `<div class="widget-calendar-event-more">+${todayEvents.length - 3} more</div>`;
        }
      } else {
        eventsEl.innerHTML = `<div class="widget-calendar-no-events">No events today</div>`;
      }
    }
  }

  destroy() {
    if (this._interval) clearInterval(this._interval);
    super.destroy();
  }
}
