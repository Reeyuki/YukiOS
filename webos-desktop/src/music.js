export class MusicPlayerApp {
  constructor() {}
  open(windowManager) {
    if (document.getElementById("music-win")) {
      windowManager.bringToFront(document.getElementById("music-win"));
      return;
    }
    const win = windowManager.createWindow("music-win", "Music Player", "700px", "400px");
    win.innerHTML = `
      <div class="window-header">
        <span>Music</span>
        ${windowManager.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%;height:100%;">
        <div id="player-container" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px;"></div>
      </div>`;
    desktop.appendChild(win);
    this.#renderMusicPage(document.getElementById("player-container"));
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
    windowManager.addToTaskbar(win.id, "Music", "/static/icons/music.webp");
  }
  #renderMusicPage(element) {
    if (!element) return;
    element.innerHTML = `
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        <iframe src="https://open.spotify.com/embed/playlist/6oK6F4LglYBr4mYLSRDJOa" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
        <iframe src="https://open.spotify.com/embed/playlist/1q7zv2ScwtR2jIxaIRj9iG" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
        <iframe src="https://open.spotify.com/embed/playlist/6q8mgrJZ5L4YxabVQoAZZf" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
      </div>`;
  }
}
