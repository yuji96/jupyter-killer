import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("jupyter-killer is now active!");

  // ノートブックタブが閉じられたときの処理
  const disposableTabClose = vscode.workspace.onDidCloseNotebookDocument(
    async () => {
      console.log("Notebook tab closed. Checking for orphaned Jupyter sessions...");
      await killAllZeroConnectionSessions();
    }
  );
  context.subscriptions.push(disposableTabClose);

  // ウィンドウが閉じられたときの処理
  const disposableWindowClose = vscode.window.onDidCloseTerminal(async () => {
    console.log(
      "VS Code window or terminal closed. Checking for orphaned Jupyter sessions..."
    );
    await killAllZeroConnectionSessions();
  });
  context.subscriptions.push(disposableWindowClose);
}

function getJupyterServerUrl(): string | undefined {
  return vscode.workspace
    .getConfiguration("jupyterSessionKiller")
    .get<string>("serverUrl");
}

async function promptAndUpdateJupyterServerUrl(errorMsg?: string) {
  const input = await vscode.window.showInputBox({
    prompt: errorMsg
      ? `${errorMsg}\nPlease enter the correct Jupyter server URL (e.g. http://localhost:8888/?token=YOUR_TOKEN):`
      : "Please enter the Jupyter server URL (e.g. http://localhost:8888/?token=YOUR_TOKEN):",
    ignoreFocusOut: true,
    placeHolder: "http://localhost:8888/?token=YOUR_TOKEN",
    value: getJupyterServerUrl() || "",
  });
  if (input) {
    await vscode.workspace
      .getConfiguration("jupyterSessionKiller")
      .update("serverUrl", input, vscode.ConfigurationTarget.Global);
    return true;
  }
  return false;
}

async function killAllZeroConnectionSessions(): Promise<void> {
  const serverUrl = getJupyterServerUrl();
  if (!serverUrl) {
    const msg = `Jupyter Server URL is not set. Please configure it in settings (jupyterSessionKiller.serverUrl). Cannot kill sessions.`;
    console.error(msg);
    // 入力欄を表示して再試行
    const updated = await promptAndUpdateJupyterServerUrl(msg);
    if (updated) {
      await killAllZeroConnectionSessions();
    }
    return;
  }

  // /api/sessions のURLを作成（クエリストリング維持）
  const url = new URL(serverUrl);
  url.pathname = "/api/sessions";
  const sessionsUrl = url.toString();

  try {
    const response = await fetch(sessionsUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.status}`);
    }
    const sessions = await response.json();
    if (!Array.isArray(sessions)) {
      throw new Error("Jupyter API response is not an array of sessions.");
    }

    // connections === 0 のセッションを全てkill
    const zeroConnSessions = sessions.filter(
      (s: any) => s.kernel?.connections === 0
    );

    for (const session of zeroConnSessions) {
      const killUrl = new URL(serverUrl);
      killUrl.pathname = `/api/sessions/${session.id}`;
      const killUrlStr = killUrl.toString();
      try {
        const delRes = await fetch(killUrlStr, { method: "DELETE" });
        if (delRes.status === 204) {
          vscode.window.showInformationMessage(
            `Killed orphaned Jupyter session: ${
              session.notebook?.path || session.path
            }`
          );
        } else {
          const errorText = await delRes.text();
          const msg = `Failed to kill session ${session.id} (${
            session.notebook?.path || session.path
          }). Status: ${delRes.status}, Body: ${errorText}`;
          console.error(msg);
          vscode.window.showErrorMessage(msg);
        }
      } catch (error: any) {
        const msg = `Error killing session ${session.id}: ${error.message}`;
        console.error(msg, error);
        vscode.window.showErrorMessage(msg);
      }
    }
    if (zeroConnSessions.length === 0) {
      console.log("No orphaned Jupyter sessions (connections: 0) found.");
    }
  } catch (error: any) {
    const msg = `Failed to fetch or kill Jupyter sessions: ${error.message}`;
    console.error(msg, error);
    vscode.window.showErrorMessage(msg);
  }
}
