import { $, $$, setStyle } from "../../shared/domUtils.js";
import { os } from "../../framework.js";
import { FileKind } from "../../shared/fileKindDetector.js";

import { showDynamicContextMenu } from "../../shared/contextMenu.js";
import { fileKindFromName, showFileProperties, isImageFile } from "../../fileDisplay.js";
import { decodeFileContent, pluralize, isArchiveFile, buildClipboardIcons } from "../../utils/utils.js";
import { saveToWallpapers } from "./upload.js";

async function resolveConflictAction(name, applyToAllAction) {
  if (applyToAllAction) return { action: applyToAllAction, applyToAll: false };
  const { showConflictDialog } = await import("../../shared/conflictDialog.js");
  return showConflictDialog(name);
}

function showConfirmDialog({ title, message, confirmText, onConfirm }) {
  import("./dialogs.js").then(({ showConfirmDialog: dlg }) => {
    dlg({ title, message, confirmText, onConfirm });
  });
}

async function openMarkdownPreview(explorer, fileName, inst) {
  try {
    const content = decodeFileContent(await explorer.fs.getFileContent(inst.currentPath, fileName));
    if (explorer.markdownApp?.open) {
      explorer.markdownApp.open(fileName, content, inst.currentPath.join("/"));
      const { speak, ClippyAnimation } = await import("../../ai/clippy.js");
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
    const content = decodeFileContent(await explorer.fs.getFileContent(inst.currentPath, fileName));
    if (explorer.notepadApp?.open) {
      explorer.notepadApp.open(fileName, content, inst.currentPath.join("/"));
      const { speak, ClippyAnimation } = await import("../../ai/clippy.js");
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
    const content = decodeFileContent(await explorer.fs.getFileContent(inst.currentPath, fileName));
    if (explorer.notepadApp?.open) {
      explorer.notepadApp.open(fileName, content, inst.currentPath.join("/"));
      const { speak, ClippyAnimation } = await import("../../ai/clippy.js");
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

  showDynamicContextMenu(e, (menu, item, hr) => {
    if (isFile && itemName.toLowerCase().endsWith(".md")) {
      menu.appendChild(item("Preview", () => openMarkdownPreview(explorer, itemName, inst), "fa-eye"));
      menu.appendChild(item("Edit with Notepad", () => openMarkdownInNotepad(explorer, itemName, inst), "fa-edit"));
      menu.appendChild(hr());
    } else if (isFile && itemName.toLowerCase().endsWith(".desktop")) {
      menu.appendChild(item("Open", () => explorer.openItemForInstance(inst, itemName, true), "fa-file-alt"));
      menu.appendChild(item("Edit with Notepad", () => openTextInNotepad(explorer, itemName, inst), "fa-edit"));
      menu.appendChild(hr());
    } else if (isFile && fileKindFromName(itemName) === FileKind.TEXT) {
      menu.appendChild(item("Open", () => explorer.openItemForInstance(inst, itemName, true), "fa-file-alt"));
      menu.appendChild(item("Edit with Notepad", () => openTextInNotepad(explorer, itemName, inst), "fa-edit"));
      menu.appendChild(hr());
    } else {
      menu.appendChild(
        item(
          isFile ? "Open" : "Open Folder",
          () => explorer.openItemForInstance(inst, itemName, isFile),
          isFile ? "fa-file-alt" : "fa-folder-open"
        )
      );
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
            const { openFileConverter } = await import("../../utils/fileConverter.js");
            const services = {
              windowManager: explorer.wm,
              fileSystemManager: explorer.fs,
              notepadApp: explorer.notepadApp,
              browserApp: explorer.browserApp,
              officeApp: explorer.officeApp,
              markdownApp: explorer.markdownApp,
              jsDosApp: explorer.jsDosApp,
              appLauncher: explorer.appLauncher
            };
            convertableItems.forEach((convertItem) => {
              openFileConverter(convertItem, inst.currentPath, services, () => {
                explorer.renderInstance(inst);
              });
            });
          },
          "fa-exchange-alt"
        )
      );
      menu.appendChild(hr());
    }

    const buildClipItem = (action) => {
      const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
      const icons = buildClipboardIcons(inst.selectedItems, itemName, isFile, view, inst.currentPath);
      explorer._setClipboard({ source: "explorer", action, icons, sourceInst: inst });

      if (action === "cut" && view) {
        icons.forEach(({ data: { name: n } }) => {
          const el = $$(".file-item", view).find((el) => el.querySelector("span")?.textContent === n);
          if (el) setStyle(el, { opacity: "0.5" });
        });
      }

      os.notify.send(`${icons.length} ${pluralize(icons.length, "item")} ${action}`);
    };

    menu.appendChild(item("Copy", () => buildClipItem("copy"), "fa-copy"));
    menu.appendChild(item("Cut", () => buildClipItem("cut"), "fa-cut"));

    const cb = explorer._getClipboard();
    if (cb) {
      menu.appendChild(
        item(
          "Paste",
          async () => {
            const { pasteToPath } = await import("./transfer.js");
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
          const { downloadItems } = await import("./transfer.js");
          await downloadItems(explorer, itemName, isFile, inst);
        },
        "fa-download"
      )
    );
    menu.appendChild(
      item(
        "Create Archive",
        async () => {
          const { createArchiveFromItems } = await import("./transfer.js");
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
            import("./inlineRename.js").then(({ startInlineRename }) => {
              startInlineRename(explorer, itemEl, itemName, inst);
            });
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
              const { SystemUtilities } = await import("../../system.js");
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

    if (isFile && isArchiveFile(itemName)) {
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Extract Here",
          () => {
            import("../../achievements.js").then(({ Achievements }) => {
              explorer._archiveExtractor.extract(itemName, inst.currentPath, () => {
                if (window.achievements) window.achievements.trigger(Achievements.ArchiveHandler);
                explorer.renderInstance(inst);
              });
            });
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
  const hasClipboard = !!explorer._getClipboard();

  if (inst._isTrashView) {
    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(
        item(
          "Restore All",
          () => {
            const view = $(`#${inst.winId}-view`, $(`#${inst.winId}`));
            os.fs.restoreAllTrashItems().then(() => {
              import("./trash.js").then(({ renderTrashView }) => {
                if (view) renderTrashView(explorer, inst, view, $(`#${inst.winId}`));
                os.notify.send("All items restored from trash");
              });
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
                import("./trash.js").then(({ renderTrashView }) => {
                  if (view) renderTrashView(explorer, inst, view, $(`#${inst.winId}`));
                  os.notify.send("Trash emptied");
                });
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
            import("./trash.js").then(({ renderTrashView }) => {
              if (view) renderTrashView(explorer, inst, view, $(`#${inst.winId}`));
            });
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
          import("./upload.js").then(({ triggerFileUpload }) => {
            triggerFileUpload(explorer, inst);
          });
        },
        "fa-file-upload"
      )
    );
    menu.appendChild(
      item(
        "New File",
        () => {
          import("./inlineRename.js").then(({ spawnInlineItem }) => {
            spawnInlineItem(explorer, inst, true);
          });
        },
        "fa-file-medical"
      )
    );
    menu.appendChild(
      item(
        "New Folder",
        () => {
          import("./inlineRename.js").then(({ spawnInlineItem }) => {
            spawnInlineItem(explorer, inst, false);
          });
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
            const { pasteToPath } = await import("./transfer.js");
            await pasteToPath(explorer, inst.currentPath, inst);
          },
          "fa-paste"
        )
      );
    }
    menu.appendChild(hr());
    menu.appendChild(item("Refresh", () => explorer.renderInstance(inst), "fa-sync-alt"));
  });
}
