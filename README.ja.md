# Jupyter Session Killer

VS CodeでJupyterノートブックのタブを閉じたとき、不要になったJupyterサーバー上のセッションをクリーンアップする拡張機能です。

具体的には、Jupyterサーバー上で `"connections": 0` となっているセッションを削除します。

## Extension Settings

- `jupyterSessionKiller.serverUrl`: JupyterサーバーのURL（例: `http://localhost:8888/?token=YOUR_TOKEN`）

## Release Notes

- 0.0.4: 
  - Added a feature to kill sessions when closing the window.
  - Added a feature to prompt the user to enter the correct server URL when an error occurs.
- 0.0.3: Renamed the display to “Jupyter Session Killer” (out of respect for Jupyter).
- 0.0.2: Initial release
