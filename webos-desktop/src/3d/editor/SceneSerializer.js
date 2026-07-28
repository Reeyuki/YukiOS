import { os } from "../../os/index.js";

const STORAGE_KEY = "rm3d_roomLayout";

export class SceneSerializer {
  serialize(furnitureManager, decorManager) {
    const furniturePositions = furnitureManager.getPositions();
    const decorActiveStates = decorManager.getActiveStates();
    const decorPositions = decorManager.getPositions();

    const json = {
      furniture: furniturePositions,
      decorations: {
        active: decorActiveStates,
        positions: decorPositions
      },
      version: 1
    };

    os.storage.set(STORAGE_KEY, json);
  }

  deserialize() {
    const data = os.storage.get(STORAGE_KEY);
    if (data === null) {
      return null;
    }
    try {
      return data;
    } catch (error) {
      return null;
    }
  }

  apply(json, furnitureManager, decorManager) {
    if (!json) return;

    if (json.furniture) {
      furnitureManager.restorePositions(json.furniture);
    }

    if (json.decorations) {
      if (json.decorations.active) {
        decorManager.restoreStates(json.decorations.active);

        const activeMap = json.decorations.active;
        const allItems = decorManager.getAllItems();
        for (const item of allItems) {
          if (!(item.id in activeMap) || activeMap[item.id] === false) {
            decorManager.despawn(item.id);
          }
        }
      }

      if (json.decorations.positions) {
        decorManager.restorePositions(json.decorations.positions);
      }
    }
  }

  clear() {
    os.storage.remove(STORAGE_KEY);
  }
}
