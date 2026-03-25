let _officeApp = null;
let _loading = null;

export async function getOfficeApp(fs, wm, explorer) {
  if (_officeApp) return _officeApp;
  if (_loading) return _loading;

  _loading = import("./office.js").then(({ OfficeApp }) => {
    _officeApp = new OfficeApp(fs, wm, explorer);
    _loading = null;
    return _officeApp;
  });

  return _loading;
}

export class OfficeAppProxy {
  constructor(fs, wm) {
    this._fs = fs;
    this._wm = wm;
    this._explorer = null;
    this._real = null;
    this._pending = null;
  }

  setExplorer(explorer) {
    this._explorer = explorer;
    if (this._real) this._real.explorerApp = explorer;
  }

  async _ensure() {
    if (this._real) return this._real;
    if (this._pending) return this._pending;
    this._pending = getOfficeApp(this._fs, this._wm, this._explorer).then((app) => {
      this._real = app;
      this._pending = null;
      return app;
    });
    return this._pending;
  }

  async open(title, content, filePath) {
    const app = await this._ensure();
    return app.open(title, content, filePath);
  }

  async openFileDialog() {
    const app = await this._ensure();
    return app.openFileDialog();
  }

  async loadContent(fileName, content, filePath) {
    const app = await this._ensure();
    return app.loadContent(fileName, content, filePath);
  }
}
