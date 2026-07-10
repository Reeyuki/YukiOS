import { WidgetBase } from "../widgetManager.js";
import { os, StorageKeys } from "../../framework.js";

export class TodoWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "todo", "Todo List", 260, 200);
    this.todos = [];
    this.saveTimer = null;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-todo-input-row">
        <input type="text" class="widget-todo-input" id="w-todo-input-${this.id}" placeholder="Add task...">
        <button class="widget-todo-add" id="w-todo-add-${this.id}">+</button>
      </div>
      <div class="widget-todo-list" id="w-todo-list-${this.id}"></div>
    `;

    this.loadTodos();
    this.render();

    contentEl.querySelector(`#w-todo-add-${this.id}`).addEventListener("click", () => {
      this.addTodo();
    });

    contentEl.querySelector(`#w-todo-input-${this.id}`).addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addTodo();
    });
  }

  loadTodos() {
    const saved = os.storage.get(StorageKeys.widgetTodoItems);
    if (Array.isArray(saved)) {
      this.todos = saved;
    }
  }

  saveTodos() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      os.storage.set(StorageKeys.widgetTodoItems, this.todos);
      this.manager.saveState();
    }, 500);
  }

  addTodo() {
    const input = document.getElementById(`w-todo-input-${this.id}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    this.todos.push({ id: Date.now(), text, done: false });
    input.value = "";
    this.render();
    this.saveTodos();
  }

  toggleTodo(id) {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.done = !todo.done;
      this.render();
      this.saveTodos();
    }
  }

  deleteTodo(id) {
    this.todos = this.todos.filter((t) => t.id !== id);
    this.render();
    this.saveTodos();
  }

  render() {
    const listEl = document.getElementById(`w-todo-list-${this.id}`);
    if (!listEl) return;

    if (this.todos.length === 0) {
      listEl.innerHTML = `<div class="widget-todo-empty">No tasks</div>`;
      return;
    }

    listEl.innerHTML = this.todos
      .map(
        (todo) => `
      <div class="widget-todo-item ${todo.done ? "done" : ""}" data-id="${todo.id}">
        <input type="checkbox" class="widget-todo-check" ${todo.done ? "checked" : ""}>
        <span class="widget-todo-text">${todo.text}</span>
        <button class="widget-todo-delete"><i class="fas fa-times"></i></button>
      </div>
    `
      )
      .join("");

    listEl.querySelectorAll(".widget-todo-item").forEach((item) => {
      const id = parseInt(item.dataset.id);
      item.querySelector(".widget-todo-check").addEventListener("change", () => {
        this.toggleTodo(id);
      });
      item.querySelector(".widget-todo-delete").addEventListener("click", () => {
        this.deleteTodo(id);
      });
    });
  }

  getData() {
    return { todos: this.todos };
  }

  setData(data) {
    if (data && data.todos) {
      this.todos = data.todos;
    }
  }

  destroy() {
    clearTimeout(this.saveTimer);
    super.destroy();
  }
}
