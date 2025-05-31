import * as path from "path";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("jupyter-killer is now active!"); // 拡張機能が読み込まれたときのログ

  // ノートブックタブが閉じられたときの処理
  const disposableTabClose = vscode.workspace.onDidCloseNotebookDocument(
    async (notebookDocument) => {
      console.log(`Notebook tab closed: ${notebookDocument.uri.fsPath}`);
      const notebookPath = notebookDocument.uri.fsPath;

      await killJupyterSession(notebookPath);
    }
  );
  context.subscriptions.push(disposableTabClose);
}

function getJupyterServerUrl(): string | undefined {
  return vscode.workspace
    .getConfiguration("jupyterKiller")
    .get<string>("serverUrl");
}

function removeJvscSuffix(filename: string): string {
  // 例: "foo-bar-jvsc-xxxx-xxxx.ipynb" → "foo-bar"
  //     "foo-bar.ipynb" → "foo-bar"
  const base = filename.replace(/\.ipynb$/, "");
  const sep = "-jvsc-";
  const idx = base.lastIndexOf(sep);
  if (idx !== -1) {
    return base.substring(0, idx);
  }
  return base;
}

// notebookPathとJupyter APIのsession情報を比較するための関数
function isSameNotebookSession(session: any, closedPath: string): boolean {
  const sessionBase = removeJvscSuffix(path.basename(session.notebook?.path || ""));
  const closedBase = path.basename(closedPath, ".ipynb");
  return sessionBase === closedBase;
}

async function findSessionIdByNotebookPath(
  serverUrl: string,
  notebookPath: string
): Promise<string | undefined> {
  // クエリストリングを維持しつつパスだけ変更
  // 例: serverUrl = http://localhost:8888/?token=TOKEN
  const url = new URL(serverUrl);
  url.pathname = "/api/sessions";
  const newUrl = url.toString();
  try {
    const response = await fetch(newUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.status}`);
    }
    const sessions = await response.json();
    // sessionsが配列かどうかを確認
    if (!Array.isArray(sessions)) {
      throw new Error("Jupyter API response is not an array of sessions.");
    }
    // notebookPathとセッションのnotebook.pathを比較
    const session = sessions.find((s: any) =>
      isSameNotebookSession(s, notebookPath)
    );
    return session?.id;
  } catch (error: any) {
    console.error(`Failed to fetch sessions from ${newUrl}: ${error.message}`);
    return undefined;
  }
}

async function killJupyterSession(notebookPath: string): Promise<void> {
  const serverUrl = getJupyterServerUrl();
  if (!serverUrl) {
    const msg = `Jupyter Server URL is not set. Please configure it in settings (jupyterKiller.serverUrl). Cannot kill session for ${notebookPath}.`;
    console.error(msg);
    vscode.window.showErrorMessage(msg);
    return;
  }

  const sessionId = await findSessionIdByNotebookPath(serverUrl, notebookPath);
  if (!sessionId) {
    const msg = `Could not find session id for notebook: ${notebookPath}`;
    console.error(msg);
    vscode.window.showErrorMessage(msg);
    return;
  }

  // クエリストリングを維持しつつパスだけ変更
  const url = new URL(serverUrl);
  url.pathname = `/api/sessions/${sessionId}`;
  const killUrl = url.toString();
  const fetchOptions: RequestInit = { method: "DELETE" };

  try {
    const response = await fetch(killUrl, fetchOptions);
    if (response.status === 204) {
      vscode.window.showInformationMessage(
        `Killed Jupyter session for ${path.basename(notebookPath)}`
      );
    } else {
      const errorText = await response.text();
      const msg = `Failed to kill Jupyter session for ${path.basename(
        notebookPath
      )}. Status: ${response.status}, Body: ${errorText}`;
      console.error(msg);
      vscode.window.showErrorMessage(msg);
    }
  } catch (error: any) {
    const msg = `Error killing Jupyter session for ${path.basename(
      notebookPath
    )}: ${error.message}`;
    console.error(msg, error);
    vscode.window.showErrorMessage(msg);
  }
}
