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
}

function getJupyterServerUrl(): string | undefined {
  return vscode.workspace
    .getConfiguration("jupyterKiller")
    .get<string>("serverUrl");
}

async function killAllZeroConnectionSessions(): Promise<void> {
  const serverUrl = getJupyterServerUrl();
  if (!serverUrl) {
    const msg = `Jupyter Server URL is not set. Please configure it in settings (jupyterKiller.serverUrl). Cannot kill sessions.`;
    console.error(msg);
    vscode.window.showErrorMessage(msg);
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
