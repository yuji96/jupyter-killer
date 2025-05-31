import * as path from "path";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("jupyter-killer is now active!"); // 拡張機能が読み込まれたときのログ

  // 設定からサーバーURLを取得
  let serverUrl = vscode.workspace
    .getConfiguration("jupyterKiller")
    .get<string>("serverUrl");

  if (!serverUrl) {
    vscode.window.showWarningMessage(
      "Jupyter Server URL is not set. Please configure it in settings (jupyterKiller.serverUrl)."
    );
    return;
  }

  // ノートブックタブが閉じられたときの処理
  const disposableTabClose = vscode.workspace.onDidCloseNotebookDocument(
    async (notebookDocument) => {
      console.log(`Notebook tab closed: ${notebookDocument.uri.fsPath}`); // tabが閉じたときのログ
      const notebookUri = notebookDocument.uri;
      const notebookPath = notebookUri.fsPath;

      // ここでセッションIDやトークンを取得する必要があります
      // 例: メタデータやファイル名から取得するなど
      // 仮の値を設定（実際の実装では適切な取得方法に置き換えてください）
      const sessionId = ""; // TODO: セッションIDを取得
      const token = ""; // TODO: トークンを取得

      if (!sessionId) {
        vscode.window.showWarningMessage(
          `Could not determine Jupyter session ID for ${notebookPath}.`
        );
        return;
      }

      await killJupyterSession(
        sessionId,
        token,
        serverUrl,
        notebookUri,
        notebookPath
      );
    }
  );
  context.subscriptions.push(disposableTabClose);
}

async function killJupyterSession(
  sessionId: string,
  token: string,
  serverUrl: string,
  notebookUri: vscode.Uri,
  notebookPath: string
): Promise<void> {
  const url = `${serverUrl}/api/sessions/${sessionId}`;
  const fetchOptions: RequestInit = {
    method: "DELETE",
    headers: token ? { Authorization: `token ${token}` } : undefined,
  };

  console.log(`Attempting to kill session: DELETE ${url}`);

  try {
    const response = await fetch(url, fetchOptions);

    if (response.status === 204) {
      // No Content - 成功
      console.log(
        `Successfully killed Jupyter session: ${sessionId} for ${notebookPath} on ${serverUrl}`
      );
      vscode.window.showInformationMessage(
        `Killed Jupyter session for ${path.basename(notebookUri.fsPath)}`
      );
    } else if (!response.ok) {
      // 204以外のエラーステータス
      const errorText = await response.text();
      console.error(
        `Failed to kill Jupyter session. Status code: ${response.status}, Body: ${errorText}`
      );
      vscode.window.showErrorMessage(
        `Failed to kill Jupyter session for ${path.basename(
          notebookUri.fsPath
        )}. Status: ${response.status}`
      );
    } else {
      // 204以外の成功ステータス (例えば200 OKや202 Acceptedなど、もしサーバーが返す場合)
      console.log(
        `Session kill request for ${sessionId} returned status: ${response.status}`
      );
      vscode.window.showInformationMessage(
        `Killed Jupyter session for ${path.basename(notebookUri.fsPath)} (Status: ${
          response.status
        })`
      );
    }
  } catch (error: any) {
    // ネットワークエラーなど
    console.error(`Error killing Jupyter session: ${error.message}`, error);
    vscode.window.showErrorMessage(
      `Error killing Jupyter session for ${path.basename(notebookUri.fsPath)}: ${
        error.message
      }`
    );
  }
}
