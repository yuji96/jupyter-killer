# Jupyter Killer

VS CodeでJupyterノートブックのタブを閉じたとき、不要になったJupyterサーバー上のセッションをクリーンアップする拡張機能です。

具体的には、Jupyterサーバー上で `"connections": 0` となっているセッションを削除します。

## Extension Settings

- `jupyterKiller.serverUrl`: JupyterサーバーのURL（例: `http://localhost:8888/?token=YOUR_TOKEN`）

## Release Notes

- 0.0.1: Initial release
