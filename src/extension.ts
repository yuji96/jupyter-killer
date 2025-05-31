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

async function killJupyterSession(notebookPath: string): Promise<void> {
  // 設定からサーバーURLを取得（sessionIdやtokenもURLに含まれている前提）
  const serverUrl = vscode.workspace
    .getConfiguration("jupyterKiller")
    .get<string>("serverUrl");

  if (!serverUrl) {
    const msg = `Jupyter Server URL is not set. Please configure it in settings (jupyterKiller.serverUrl). Cannot kill session for ${notebookPath}.`;
    console.error(msg);
    vscode.window.showErrorMessage(msg);
    return;
  }

  // serverUrlにsessionIdやtokenが埋め込まれている前提
  // 例: https://host:8888/api/sessions/SESSION_ID?token=TOKEN
  console.log(`Attempting to kill session: DELETE ${serverUrl}`);

  const fetchOptions: RequestInit = {
    method: "DELETE",
    // Authorizationヘッダーは不要（tokenがURLに含まれているため）
    // headers: token ? { Authorization: `token ${token}` } : undefined,
  };

  try {
    const response = await fetch(serverUrl, fetchOptions);

    if (response.status === 204) {
      // No Content - 成功
      console.log(
        `Successfully killed Jupyter session for ${notebookPath} on ${serverUrl}`
      );
      vscode.window.showInformationMessage(
        `Killed Jupyter session for ${path.basename(notebookPath)}`
      );
    } else if (!response.ok) {
      // 204以外のエラーステータス
      const errorText = await response.text();
      const msg = `Failed to kill Jupyter session for ${path.basename(
        notebookPath
      )}. Status: ${response.status}, Body: ${errorText}`;
      console.error(msg);
      vscode.window.showErrorMessage(msg);
    } else {
      // 204以外の成功ステータス (例えば200 OKや202 Acceptedなど、もしサーバーが返す場合)
      console.log(`Session kill request returned status: ${response.status}`);
      vscode.window.showInformationMessage(
        `Killed Jupyter session for ${path.basename(notebookPath)} (Status: ${
          response.status
        })`
      );
    }
  } catch (error: any) {
    // ネットワークエラーなど
    const msg = `Error killing Jupyter session for ${path.basename(
      notebookPath
    )}: ${error.message}`;
    console.error(msg, error);
    vscode.window.showErrorMessage(msg);
  }
}
