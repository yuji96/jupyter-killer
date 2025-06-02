# Jupyter Session Killer

This VS Code extension automatically cleans up unused sessions on your Jupyter server when you close a Jupyter notebook tab.

Specifically, it detects and kills sessions on the Jupyter server where `"connections": 0`.

## Extension Settings

- `jupyterSessionKiller.serverUrl`: URL of your Jupyter server (e.g., `http://localhost:8888/?token=YOUR_TOKEN`)

## Release Notes

- 0.0.2: Initial release
