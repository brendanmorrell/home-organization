from setuptools import setup

APP = ['launch-quicktodo.py']
DATA_FILES = [('', ['quicktodo.html'])]
OPTIONS = {
    'argv_emulation': False,
    'iconfile': 'AppIcon.icns',
    'plist': {
        'CFBundleName': 'QuickTodo',
        'CFBundleDisplayName': 'QuickTodo',
        'CFBundleIdentifier': 'com.brendan.quicktodo',
        'CFBundleShortVersionString': '1.0',
        'NSHighResolutionCapable': True,
        'LSUIElement': False,
    },
    'packages': ['webview'],
    'includes': ['objc', 'AppKit', 'Foundation', 'WebKit'],
    'excludes': ['tkinter', 'test'],
}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
