# Yuki OS

Yuki OS is a browser-based desktop environment that runs games, emulators, and web applications inside a single, consistent system. It provides a windowed interface where different technologies share the same lifecycle, input model, and UI behavior.

---

## Overview

Yuki OS combines multiple execution environments into one desktop-style interface. Instead of switching between separate tools, everything runs within the same system, using a unified window manager and application model.

---

## Core Capabilities

### Desktop Environment

* Windowed multitasking with drag, resize, and focus handling
* Desktop layout with icons, wallpapers, and task management
* Start menu and application launcher

### Application System

* Central app registry
* Type-based app loading
* Shared window lifecycle across all apps
* Modular structure for adding new functionality

### Built-in Tools

* File explorer with virtual filesystem
* Terminal and text editor
* Web browser
* Emulator and game launcher
* Camera access
* Task Manager
* Basic utilities (calculator, weather)

---

## Multi-Runtime Support

Yuki OS supports multiple execution environments under a single interface:

* Flash content via Ruffle
* Emulator-based systems (GBA, NDS)
* WebAssembly applications
* Unity Web builds
* HTML5 and JavaScript apps

All runtimes are handled through the same windowing, input, and lifecycle system.

---

## Use Case

Yuki OS is designed as a unified platform for interactive content. It works best as a hub for:

* browser-based games
* emulated systems
* archived web content
* experimental or mixed-runtime apps

---

## 📜 License

The project license applies to platform code only.
External engines, emulators, runtimes, and game assets remain the property of their respective owners.
