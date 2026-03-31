#!/usr/bin/env python3
"""
QuickTodo launcher — opens quicktodo.html in a frameless native window.
Requires: pip install pywebview
Keep this file in the same folder as quicktodo.html.
"""
import os
import json
import webview

# Set the app icon (replaces default Python rocket in app switcher)
icon_path = '/Applications/QuickTodo.app/Contents/Resources/AppIcon.icns'
if os.path.exists(icon_path):
    try:
        from AppKit import NSApplication, NSImage
        app = NSApplication.sharedApplication()
        icon = NSImage.alloc().initWithContentsOfFile_(icon_path)
        if icon:
            app.setApplicationIconImage_(icon)
    except Exception:
        pass

WIDTH = 360
HEIGHT = 520
COLLAPSED_HEIGHT = 30

here = os.path.dirname(os.path.abspath(__file__))
html_path = os.path.join(here, 'quicktodo.html')
data_path = os.path.join(here, '.quicktodo-data.json')


class Api:
    def __init__(self, window_ref):
        self._window_ref = window_ref

    def set_collapsed(self, collapsed):
        w = self._window_ref[0]
        if w:
            if collapsed:
                w.resize(WIDTH, COLLAPSED_HEIGHT)
            else:
                w.resize(WIDTH, HEIGHT)

    def toggle_on_top(self):
        w = self._window_ref[0]
        if w:
            w.on_top = not w.on_top
            return w.on_top
        return False

    def get_on_top(self):
        w = self._window_ref[0]
        return w.on_top if w else False

    def save_data(self, json_str):
        """Save state to a JSON file next to the app."""
        try:
            with open(data_path, 'w', encoding='utf-8') as f:
                f.write(json_str)
            return True
        except Exception as e:
            print(f"Save error: {e}")
            return False

    def load_data(self):
        """Load state from the JSON file."""
        try:
            if os.path.exists(data_path):
                with open(data_path, 'r', encoding='utf-8') as f:
                    return f.read()
        except Exception as e:
            print(f"Load error: {e}")
        return None


window_ref = [None]
api = Api(window_ref)

window = webview.create_window(
    'QuickTodo',
    url=f'file://{html_path}',
    width=WIDTH,
    height=HEIGHT,
    resizable=True,
    frameless=True,
    on_top=False,
    easy_drag=True,
    js_api=api,
)
window_ref[0] = window

webview.start()
