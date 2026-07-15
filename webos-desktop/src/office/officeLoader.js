let officeApp = null;
let loading = null;

export async function getOfficeApp(os) {
  if (officeApp) return officeApp;
  if (loading) return loading;

  loading = import("../apps/office.js").then(({ OfficeApp }) => {
    officeApp = new OfficeApp(os);
    loading = null;
    return officeApp;
  });

  return loading;
}

export class OfficeAppProxy {
  constructor(os) {
    this.os = os;
    this.explorer = null;
    this.real = null;
    this.pending = null;
  }

  setExplorer(explorer) {
    this.explorer = explorer;
    if (this.real) this.real.explorerApp = explorer;
  }

  async ensure() {
    if (this.real) return this.real;
    if (this.pending) return this.pending;
    this.pending = getOfficeApp(this.os).then((app) => {
      this.real = app;
      this.pending = null;
      return app;
    });
    return this.pending;
  }

  async open(title, content, filePath) {
    const app = await this.ensure();
    return app.open(title, content, filePath);
  }

  async openFileDialog() {
    const app = await this.ensure();
    return app.openFileDialog();
  }

  async loadContent(fileName, content, filePath) {
    const app = await this.ensure();
    return app.loadContent(fileName, content, filePath);
  }
}
