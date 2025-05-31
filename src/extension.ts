import * as path from "path";
import * as vscode from "vscode";

// カーネル情報を保持するインターフェース
interface KernelInfo {
  sessionId: string;
  token: string;
  serverUrl: string;
  notebookUri: vscode.Uri;
  notebookPath: string; // Jupyter API で照合するための相対パス
  kernelName: string;
  id: string; // カーネルのID (Jupyter APIのレスポンスに含まれるもの)
}

// アクティブなカーネル情報を保持するマップ (キーは notebookUri.toString())
const activeKernels: Map<string, KernelInfo> = new Map();

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
      const notebookUriString = notebookDocument.uri.toString();
      const kernelInfo = activeKernels.get(notebookUriString);
      if (kernelInfo) {
        await killJupyterSession(kernelInfo);
        activeKernels.delete(notebookUriString);
      }
    }
  );
  context.subscriptions.push(disposableTabClose);
}

async function killJupyterSession(kernelInfo: KernelInfo): Promise<void> {
  const url = `${kernelInfo.serverUrl}/api/sessions/${kernelInfo.sessionId}`;
  const fetchOptions: RequestInit = {
    // fetch のオプション
    method: "DELETE",
    headers: kernelInfo.token
      ? { Authorization: `token ${kernelInfo.token}` }
      : undefined,
  };

  console.log(`Attempting to kill session: DELETE ${url}`);

  try {
    const response = await fetch(url, fetchOptions);

    if (response.status === 204) {
      // No Content - 成功
      console.log(
        `Successfully killed Jupyter session: ${kernelInfo.sessionId} for ${kernelInfo.notebookPath} on ${kernelInfo.serverUrl}`
      );
      vscode.window.showInformationMessage(
        `Killed Jupyter session for ${path.basename(kernelInfo.notebookUri.fsPath)}`
      );
    } else if (!response.ok) {
      // 204以外のエラーステータス
      const errorText = await response.text();
      console.error(
        `Failed to kill Jupyter session. Status code: ${response.status}, Body: ${errorText}`
      );
      vscode.window.showErrorMessage(
        `Failed to kill Jupyter session for ${path.basename(
          kernelInfo.notebookUri.fsPath
        )}. Status: ${response.status}`
      );
    } else {
      // 204以外の成功ステータス (例えば200 OKや202 Acceptedなど、もしサーバーが返す場合)
      console.log(
        `Session kill request for ${kernelInfo.sessionId} returned status: ${response.status}`
      );
      vscode.window.showInformationMessage(
        `Killed Jupyter session for ${path.basename(
          kernelInfo.notebookUri.fsPath
        )} (Status: ${response.status})`
      );
    }
  } catch (error: any) {
    // ネットワークエラーなど
    console.error(`Error killing Jupyter session: ${error.message}`, error);
    vscode.window.showErrorMessage(
      `Error killing Jupyter session for ${path.basename(
        kernelInfo.notebookUri.fsPath
      )}: ${error.message}`
    );
  }
}

export function deactivate() {
  console.log(
    "Deactivating jupyter-killer. Active kernel tracking will be cleared."
  );
  activeKernels.clear();
}
