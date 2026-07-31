import { $, $$ } from "../../shared/domUtils.js";
import { os, StorageKeys } from "../../framework.js";
import { FileKind } from "../../shared/fileKindDetector.js";
import { BusEvents } from "../../core/EventBus.js";
import { Achievements } from "../../achievements.js";
import { showDynamicContextMenu } from "../../shared/contextMenu.js";
import { isFontFile, isISOFile, getExt } from "../../shared/fileKindDetector.js";
import { fileKindFromName, showFileProperties, isImageFile, readFontBlob, openFileWithApp } from "../../fileDisplay.js";
import { getCompatibleApps, getDefaultApp } from "../../fileAssociations.js";
import { showChooseAppDialog } from "../../shared/chooseAppDialog.js";
import { applyFontFamily } from "../../settings/settingsApply.js";
import { decodeFileContent, isArchiveFile } from "../../utils/utils.js";
import { saveToWallpapers } from "./upload.js";
import { showConflictDialog } from "../../shared/conflictDialog.js";
import { showConfirmDialog as showConfirmDialogDlg } from "./dialogs.js";
import { speak, ClippyAnimation } from "../../ai/clippy.js";
import { openFileConverter } from "../../utils/fileConverter.js";
import { pasteToPath, downloadItems, createArchiveFromItems } from "./transfer.js";
import { startInlineRename, spawnInlineItem } from "./inlineRename.js";
import { SystemUtilities } from "../../system.js";
import { renderTrashView, showTrashView } from "./trash.js";
import { triggerFileUpload, handleFileUpload } from "./upload.js";

async function resolveConflictAction(name, applyToAllAction) {
  if (applyToAllAction) return { action: applyToAllAction, applyToAll: false };
  return showConflictDialog(name);
}

function showConfirmDialog({ title, message, confirmText, onConfirm }) {
  showConfirmDialogDlg({ title, message, confirmText, onConfirm });
}

async function openMarkdownPreview(explorer, fileName, inst) {
  try {
    const content = await decodeFileContent(await explorer.fs.getFileContent(inst.currentPath, fileName));
    if (explorer.markdownApp?.open) {
      explorer.markdownApp.open(fileName, content, inst.currentPath.join("/"));
      speak("Opening markdown preview. Looking good!", ClippyAnimation.Show);
    } else {
      os.notify.send("Markdown app not available");
    }
  } catch (err) {
    os.notify.send(`Failed to open "${fileName}"`);
    console.error("Error opening markdown preview:", err);
  }
}

async function openMarkdownInNotepad(explorer, fileName, inst) {
  try {
    const content = await decodeFileContent(await explorer.fs.getFileContent(inst.currentPath, fileName));
    if (explorer.notepadApp?.open) {
      explorer.notepadApp.open(fileName, content, inst.currentPath.join("/"));
      speak("Opening in Notepad. Time to edit!", ClippyAnimation.Writing);
    } else {
      os.notify.send("Notepad app not available");
    }
  } catch (err) {
    os.notify.send(`Failed to open "${fileName}"`);
    console.error("Error opening file in notepad:", err);
  }
}

async function openTextInNotepad(explorer, fileName, inst) {
  try {
    const content = await decodeFileContent(await explorer.fs.getFileContent(inst.currentPath, fileName));
    if (explorer.notepadApp?.open) {
      explorer.notepadApp.open(fileName, content, inst.currentPath.join("/"));
      speak("Opening in Notepad. Time to edit!", ClippyAnimation.Writing);
    } else {
      os.notify.send("Notepad app not available");
    }
  } catch (err) {
    os.notify.send(`Failed to open "${fileName}"`);
    console.error("Error opening file in notepad:", err);
  }
}

export function showFileContextMenu(explorer, e, itemName, isFile, inst) {
  e.preventDefault();
  e.stopPropagation();

  showDynamicContextMenu(e, (menu, item, hr, submenu) => {
    if (isFile) {
      const defaultApp = getDefaultApp(itemName);
      menu.appendChild(
        item("Open", () => explorer.openItemForInstance(inst, itemName, true), defaultApp?.icon || "fa-file-alt")
      );
      menu.appendChild(
        submenu(
          "Open with",
          (subMenuEl, subItem, subHr) => {
            const apps = getCompatibleApps(itemName);
            for (const app of apps) {
              subMenuEl.appendChild(
                subItem(
                  app.title,
                  () => openFileWithApp(app.appId, { name: itemName, path: inst.currentPath }),
                  app.icon
                )
              );
            }
            subMenuEl.appendChild(subHr());
            subMenuEl.appendChild(
              subItem(
                "Choose another app",
                () => showChooseAppDialog({ ext: getExt(itemName), name: itemName, path: inst.currentPath }),
                "fa-sliders-h"
              )
            );
          },
          "fa-share-alt"
        )
      );
      menu.appendChild(hr());
    }

    if (isFile && itemName.toLowerCase().endsWith(".md")) {
      menu.appendChild(item("Preview", () => openMarkdownPreview(explorer, itemName, inst), "fa-eye"));
      menu.appendChild(item("Edit with Notepad", () => openMarkdownInNotepad(explorer, itemName, inst), "fa-edit"));
      menu.appendChild(hr());
    } else if (isFile && itemName.toLowerCase().endsWith(".desktop")) {
      menu.appendChild(item("Edit with Notepad", () => openTextInNotepad(explorer, itemName, inst), "fa-edit"));
      menu.appendChild(hr());
    } else if (isFile && fileKindFromName(itemName) === FileKind.TEXT) {
      menu.appendChild(item("Edit with Notepad", () => openTextInNotepad(explorer, itemName, inst), "fa-edit"));
      menu.appendChild(hr());
    } else {
      if (!isFile) {
        menu.appendChild(
          item("Open Folder", () => explorer.openItemForInstance(inst, itemName, false), "fa-folder-open")
        );
        menu.appendChild(
          item(
            "Open in New Window",
            () => {
              const fullPath = [...inst.currentPath, itemName];
              explorer.open(fullPath);
            },
            "fa-external-link-alt"
          )
        );
        const quickAccess = os.storage.get(StorageKeys.explorerQuickAccess) || [];
        const relPath = [...inst.currentPath, itemName].join("/");
        const isPinned = quickAccess.some((p) => p.path === relPath);
        menu.appendChild(
          item(
            isPinned ? "Unpin from Quick Access" : "Pin to Quick Access",
            () => {
              if (isPinned) {
                const filtered = quickAccess.filter((p) => p.path !== relPath);
                os.storage.set(StorageKeys.explorerQuickAccess, filtered);
              } else {
                quickAccess.push({ path: relPath, label: itemName });
                os.storage.set(StorageKeys.explorerQuickAccess, quickAccess);
              }
              const win = document.getElementById(inst.winId);
              if (win) explorer.sidebarRebuild(win, inst);
            },
            "fa-thumbtack"
          )
        );
      }
      menu.appendChild(hr());
    }

    const effectiveItems =
      inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
    const convertableItems = effectiveItems.filter((item) => {
      const ext = item.split(".").pop().toLowerCase();
      return [
        "png",
        "jpg",
        "jpeg",
        "webp",
        "bmp",
        "svg",
        "gif",
        "txt",
        "md",
        "html",
        "json",
        "log",
        "csv",
        "xml",
        "yaml",
        "yml",
        "tsv"
      ].includes(ext);
    });

    if (isFile && convertableItems.length > 0) {
      menu.appendChild(
        item(
          convertableItems.length > 1 ? `Convert ${convertableItems.length} items...` : "Convert / Transform...",
          async () => {
            convertableItems.forEach((convertItem) => {
              openFileConverter(convertItem, inst.currentPath, os, () => {
                explorer.renderInstance(inst);
              });
            });
          },
          "fa-exchange-alt"
        )
      );
      menu.appendChild(hr());
    }

    menu.appendChild(item("Copy", () => explorer.clipboardAction("copy", inst, itemName, isFile), "fa-copy"));
    menu.appendChild(item("Cut", () => explorer.clipboardAction("cut", inst, itemName, isFile), "fa-cut"));

    const cb = explorer.getClipboard();
    if (cb) {
      menu.appendChild(
        item(
          "Paste",
          async () => {
            await pasteToPath(explorer, inst.currentPath, inst);
          },
          "fa-paste"
        )
      );
    }

    menu.appendChild(hr());

    menu.appendChild(
      item(
        "Download",
        async () => {
          await downloadItems(explorer, itemName, isFile, inst);
        },
        "fa-download"
      )
    );
    menu.appendChild(
      item(
        "Create Archive",
        async () => {
          await createArchiveFromItems(explorer, itemName, isFile, inst);
        },
        "fa-file-archive"
      )
    );
    menu.appendChild(hr());

    menu.appendChild(
      item(
        "Move to Trash",
        () => {
          const effItems =
            inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
          for (const name of effItems) {
            os.fs.trashFile(inst.currentPath, name);
          }
          explorer.renderInstance(inst);
          os.notify.send(`${effItems.length} ${effItems.length > 1 ? "items" : "item"} moved to trash`);
        },
        "fa-trash-alt"
      )
    );

    menu.appendChild(
      item(
        "Delete Permanently",
        () => {
          const effItems =
            inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];
          const msg =
            effItems.length > 1
              ? `Permanently delete ${effItems.length} items? This cannot be undone.`
              : `Permanently delete "${itemName}"? This cannot be undone.`;
          showConfirmDialog({
            title: "Delete Permanently",
            message: msg,
            confirmText: "Delete",
            onConfirm: async () => {
              for (const name of effItems) {
                await os.fs.delete(inst.currentPath, name);
              }
              await explorer.renderInstance(inst);
              os.notify.send(`${effItems.length} ${effItems.length > 1 ? "items" : "item"} permanently deleted`);
            }
          });
        },
        "fa-times-circle"
      )
    );

    menu.appendChild(
      item(
        "Rename",
        () => {
          const win = $(`#${inst.winId}`);
          const view = win && $(`#${inst.winId}-view`, win);
          const itemEl =
            view && $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === itemName);
          if (itemEl) {
            startInlineRename(explorer, itemEl, itemName, inst);
          }
        },
        "fa-edit"
      )
    );

    if (isFile && isImageFile(itemName)) {
      const getContent = async () => {
        const content = await explorer.fs.getFileContent(inst.currentPath, itemName);
        if (content instanceof Blob) {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(content);
          });
        }
        return content;
      };

      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Set Wallpaper",
          async () => {
            try {
              const content = await getContent();
              await SystemUtilities.setWallpaper(content);
              os.notify.send(`Wallpaper set to "${itemName}"`);
            } catch (err) {
              console.error("Set wallpaper error:", err);
              os.dialog.alert("Error", "Could not set wallpaper");
            }
          },
          "fa-image"
        )
      );
      menu.appendChild(
        item(
          "Save as Wallpaper",
          async () => {
            try {
              const content = await getContent();
              const kind = fileKindFromName(itemName);
              await saveToWallpapers(explorer, itemName, content, kind, "@content");
              os.notify.send(`"${itemName}" saved to wallpapers`);
            } catch (err) {
              console.error("Save wallpaper error:", err);
              os.dialog.alert("Error", "Could not save wallpaper");
            }
          },
          "fa-save"
        )
      );
    }

    if (isFile && isFontFile(itemName)) {
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Set as System Font",
          async () => {
            try {
              const blob = await readFontBlob(itemName, inst.currentPath, explorer.fs);
              if (!blob || !blob.size) throw new Error("Could not read font file");
              const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              const ext = itemName.split(".").pop().toLowerCase();
              const formatMap = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };
              const fontFamily = itemName.replace(/\.[^.]+$/, "");
              const customFontData = {
                family: fontFamily,
                stack: `"${fontFamily}", sans-serif`,
                url: dataUrl,
                format: formatMap[ext] || "truetype",
                weight: "normal"
              };
              os.storage.set(StorageKeys.fontFamily, "__custom__");
              os.storage.set(StorageKeys.customFont, customFontData);
              applyFontFamily("custom", customFontData);
              os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.FontCustomizer });
              os.notify.send(`System font set to "${fontFamily}"`);
            } catch (err) {
              console.error("Set system font error:", err);
              os.dialog.alert("Error", "Could not set system font");
            }
          },
          "fa-font"
        )
      );
    }

    if (isFile && (isArchiveFile(itemName) || isISOFile(itemName))) {
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Extract Here",
          () => {
            const cb = () => {
              if (window.achievements) window.achievements.trigger(Achievements.ArchiveHandler);
              explorer.renderInstance(inst);
            };
            if (isISOFile(itemName)) {
              explorer.archiveExtractor.extractISO(itemName, inst.currentPath, cb);
            } else {
              explorer.archiveExtractor.extract(itemName, inst.currentPath, cb);
            }
          },
          "fa-box-open"
        )
      );
    }

    menu.appendChild(
      item(
        "Properties",
        async () => {
          await showFileProperties([...inst.currentPath, itemName], itemName, !isFile, () =>
            explorer.renderInstance(inst)
          );
        },
        "fa-info-circle"
      )
    );
  });
}

export function showBackgroundContextMenu(explorer, e, inst) {
  e.preventDefault();
  e.stopPropagation();
  const hasClipboard = !!explorer.getClipboard();

  if (inst.isTrashView) {
    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(
        item(
          "Restore All",
          () => {
            const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
            os.fs.restoreAllTrashItems().then(() => {
              if (view) renderTrashView(explorer, inst, view, $(`#${inst.winId}`));
              os.notify.send("All items restored from trash");
            });
          },
          "fa-undo"
        )
      );
      menu.appendChild(
        item(
          "Empty Trash",
          () => {
            os.dialog.confirm("Empty Trash", "Empty the trash for good? You can't undo this.").then((confirmed) => {
              if (!confirmed) return;
              const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
              os.fs.emptyTrash().then(() => {
                if (view) renderTrashView(explorer, inst, view, $(`#${inst.winId}`));
                os.notify.send("Trash emptied");
              });
            });
          },
          "fa-trash-alt"
        )
      );
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Refresh",
          () => {
            const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
            if (view) renderTrashView(explorer, inst, view, $(`#${inst.winId}`));
          },
          "fa-sync-alt"
        )
      );
    });
    return;
  }

  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(
      item(
        "Add file(s)",
        () => {
          triggerFileUpload(explorer, inst);
        },
        "fa-file-upload"
      )
    );
    menu.appendChild(
      item(
        "Add Folder",
        () => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.setAttribute("webkitdirectory", "");
          input.addEventListener("change", async () => {
            const files = Array.from(input.files);
            if (!files.length) return;
            const win = document.getElementById(inst.winId);
            await handleFileUpload(explorer, files, true, win, inst);
          });
          input.click();
        },
        "fa-folder-plus"
      )
    );
    menu.appendChild(
      item(
        "New File",
        () => {
          spawnInlineItem(explorer, inst, true);
        },
        "fa-file-medical"
      )
    );
    menu.appendChild(
      item(
        "New Folder",
        () => {
          spawnInlineItem(explorer, inst, false);
        },
        "fa-folder-plus"
      )
    );
    if (hasClipboard) {
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Paste",
          async () => {
            await pasteToPath(explorer, inst.currentPath, inst);
          },
          "fa-paste"
        )
      );
    }
    menu.appendChild(hr());
    menu.appendChild(
      item(
        "Mount Directory...",
        async () => {
          try {
            const handle = await os.fs.pickDirectory();
            const label = await os.dialog.prompt("Mount Directory", `Name for "${handle.name}":`, handle.name);
            if (!label || !label.trim()) return;
            os.fs.registerMount(handle, label.trim());
            os.notify.send(`Mounted "${label.trim()}"`, { type: "success" });
            const win = $(`#${inst.winId}`);
            if (win) {
              explorer.renderMountsInSidebar(win, inst);
            }
            await explorer.renderInstance(inst);
          } catch (err) {
            if (err.name !== "AbortError" && err.name !== "SecurityError") {
              os.dialog.alert("Mount Error", err.message || "Failed to mount directory");
            }
          }
        },
        "fa-hdd"
      )
    );
    menu.appendChild(hr());
    menu.appendChild(item("Sort by", () => showSortSubmenu(explorer, inst), "fa-sort"));
    menu.appendChild(
      item(
        "Open in Terminal",
        () => {
          const sessionKey = explorer.fs?.sessionKey || "guest";
          const termPath = ["ys", "users", sessionKey, ...inst.currentPath];
          os.app.launch("terminalApp", { initialPath: termPath });
        },
        "fa-terminal"
      )
    );
    menu.appendChild(item("Refresh", () => explorer.renderInstance(inst), "fa-sync-alt"));
  });
}

function showSortSubmenu(explorer, inst) {
  const currentSort = inst.sortBy || "name";
  const currentDir = inst.sortDir || "asc";
  const options = [
    { key: "name", label: "Name", icon: "fa-font" },
    { key: "mtime", label: "Date modified", icon: "fa-calendar" },
    { key: "kind", label: "Type", icon: "fa-tag" },
    { key: "size", label: "Size", icon: "fa-weight" }
  ];
  showDynamicContextMenu(
    { clientX: window.event?.clientX || 0, clientY: window.event?.clientY || 0 },
    (menu, item, hr) => {
      for (const opt of options) {
        menu.appendChild(
          item(
            `${opt.label} ${currentSort === opt.key ? (currentDir === "asc" ? " ↑" : " ↓") : ""}`,
            () => {
              if (currentSort === opt.key) {
                inst.sortDir = currentDir === "asc" ? "desc" : "asc";
              } else {
                inst.sortBy = opt.key;
                inst.sortDir = "asc";
              }
              explorer.renderInstance(inst);
            },
            opt.icon
          )
        );
      }
    }
  );
}

export function showSidebarItemContextMenu(explorer, e, path, label, inst) {
  e.preventDefault();
  e.stopPropagation();

  const quickAccess = os.storage.get(StorageKeys.explorerQuickAccess) || [];
  const isPinned = quickAccess.some((p) => p.path === path);
  const defaultQuickPaths = new Set(["", "Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"]);
  const isDefault = defaultQuickPaths.has(path);
  const hiddenDefaults = new Set(os.storage.get(StorageKeys.explorerQuickAccessHidden) || []);
  const isDefaultHidden = isDefault && hiddenDefaults.has(path);

  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(
      item("Open", () => explorer.navigateInstance(inst, path.split("/").filter(Boolean)), "fa-folder-open")
    );
    menu.appendChild(
      item(
        "Open in New Window",
        () => {
          explorer.open([...path.split("/").filter(Boolean)]);
        },
        "fa-external-link-alt"
      )
    );
    menu.appendChild(hr());
    if (isDefault) {
      menu.appendChild(
        item(
          isDefaultHidden ? "Add to Quick Access" : "Remove from Quick Access",
          () => {
            const hiddenDefaultsList = os.storage.get(StorageKeys.explorerQuickAccessHidden) || [];
            if (isDefaultHidden) {
              os.storage.set(
                StorageKeys.explorerQuickAccessHidden,
                hiddenDefaultsList.filter((p) => p !== path)
              );
            } else {
              if (!hiddenDefaultsList.includes(path)) hiddenDefaultsList.push(path);
              os.storage.set(StorageKeys.explorerQuickAccessHidden, hiddenDefaultsList);
            }
            const win = document.getElementById(inst.winId);
            if (win) explorer.sidebarRebuild(win, inst);
          },
          "fa-thumbtack"
        )
      );
    } else {
      menu.appendChild(
        item(
          isPinned ? "Unpin from Quick Access" : "Pin to Quick Access",
          () => {
            if (isPinned) {
              const filtered = quickAccess.filter((p) => p.path !== path);
              os.storage.set(StorageKeys.explorerQuickAccess, filtered);
            } else {
              quickAccess.push({ path, label });
              os.storage.set(StorageKeys.explorerQuickAccess, quickAccess);
            }
            const win = document.getElementById(inst.winId);
            if (win) explorer.sidebarRebuild(win, inst);
          },
          "fa-thumbtack"
        )
      );
    }
    menu.appendChild(hr());
    menu.appendChild(
      item(
        "Copy Path",
        () => {
          const fullPath = "/" + path.split("/").filter(Boolean).join("/");
          navigator.clipboard.writeText(fullPath).catch(() => {});
          os.notify.send(`Path copied: ${fullPath}`);
        },
        "fa-copy"
      )
    );
  });
}

export function showTrashContextMenu(explorer, e, inst) {
  e.preventDefault();
  e.stopPropagation();

  showDynamicContextMenu(e, (menu, item, hr) => {
    const isTrashView = inst.isTrashView;
    if (isTrashView) {
      menu.appendChild(
        item(
          "Restore All",
          () => {
            os.fs.restoreAllTrashItems().then(() => {
              const win = $(`#${inst.winId}`);
              const view = win && $(`#${inst.winId}-view`, win);
              if (view) {
                renderTrashView(explorer, inst, view, win);
              }
              os.notify.send("All items restored from trash");
            });
          },
          "fa-undo"
        )
      );
      menu.appendChild(
        item(
          "Empty Trash",
          () => {
            os.dialog.confirm("Empty Trash", "Empty the trash for good? You can't undo this.").then((confirmed) => {
              if (!confirmed) return;
              os.fs.emptyTrash().then(() => {
                const win = $(`#${inst.winId}`);
                const view = win && $(`#${inst.winId}-view`, win);
                if (view) {
                  renderTrashView(explorer, inst, view, win);
                }
                os.notify.send("Trash emptied");
              });
            });
          },
          "fa-trash-alt"
        )
      );
    } else {
      menu.appendChild(
        item(
          "Open Trash",
          () => {
            showTrashView(explorer, inst);
          },
          "fa-trash"
        )
      );
      menu.appendChild(
        item(
          "Empty Trash",
          () => {
            os.dialog.confirm("Empty Trash", "Empty the trash for good? You can't undo this.").then((confirmed) => {
              if (!confirmed) return;
              os.fs.emptyTrash().then(() => {
                os.notify.send("Trash emptied");
              });
            });
          },
          "fa-trash-alt"
        )
      );
    }
    menu.appendChild(hr());
    menu.appendChild(item("Refresh", () => explorer.renderInstance(inst), "fa-sync-alt"));
  });
}
