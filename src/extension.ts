import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const cmd = vscode.commands.registerCommand('dataOps.runPipeline', async (uri?: vscode.Uri) => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) { vscode.window.showErrorMessage("No workspace open."); return; }

    // Infer CSV & folders from context (active editor or selected file/folder)
    const hintPath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName || workspaceFolder;
    const baseDir = fs.statSync(hintPath).isDirectory() ? hintPath : path.dirname(hintPath);

    const CSV_PATH = path.join(baseDir, 'input.csv');          // customize if needed
    const SCRIPT_PATH = path.join(baseDir, 'generated.sh');
    const OUTPUT_DIR = path.join(baseDir, 'out');

    // 1) Read CSV
    if (!fs.existsSync(CSV_PATH)) { vscode.window.showErrorMessage(`CSV not found: ${CSV_PATH}`); return; }
    const csvText = fs.readFileSync(CSV_PATH, 'utf8');
    const rows = parseCsv(csvText); // simple parser below

    // 2) Build commands from rows (customize mapping!)
    const commands: string[] = [];
    ensureDir(OUTPUT_DIR);
    for (const row of rows) {
      const tool = (row['tool'] || '').trim();
      const a1   = (row['arg1'] || '').trim();
      const a2   = (row['arg2'] || '').trim();
      if (!tool) continue;
      const out = path.join(OUTPUT_DIR, `${tool}_${a1 || 'x'}_${a2 || 'y'}.txt`);
      commands.push(`echo "generated from ${tool},${a1},${a2}" > "${out}"`);
    }
    if (!commands.length) { vscode.window.showErrorMessage("No commands generated from CSV."); return; }

    // 3) Write shell script
    const shebang = '#!/usr/bin/env bash\nset -euo pipefail\nIFS=$\'\\n\\t\'\n\n';
    fs.writeFileSync(SCRIPT_PATH, shebang + commands.join('\n') + '\n', { encoding: 'utf8' });
    try { fs.chmodSync(SCRIPT_PATH, 0o755); } catch {}

    // 4) Execute shell script in integrated terminal (streams output)
    const term = vscode.window.createTerminal({ name: 'DataOps Pipeline' });
    term.show(true);
    const bash = process.platform === 'win32'
      ? `"C:/Program Files/Git/bin/bash.exe"` // adjust if needed
      : '/bin/bash';
    term.sendText(`${bash} "${SCRIPT_PATH}"`);

    // 5) After run completes, cleanse files (simple watcher)
    //    You can replace this with a more robust status check or ask user to confirm.
    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Cleansing generated files…' }, async () => {
      await waitMs(1500); // tiny delay so files exist
      cleanseDir(OUTPUT_DIR);
      vscode.window.showInformationMessage(`Pipeline done. Cleansed: ${OUTPUT_DIR}`);
    });
  });

  context.subscriptions.push(cmd);
}

export function deactivate() {}

/* ---------- helpers ---------- */
function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function waitMs(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function cleanseDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) cleanseDir(p);
    else if (st.isFile()) cleanseFile(p);
  }
}
function cleanseFile(p: string) {
  let t = fs.readFileSync(p, 'utf8');
  t = t.replace(/\r\n?/g, '\n')
       .split('\n')
       .map(line => line.replace(/[ \t]+$/g, ''))
       .filter(line => line.trim() !== '')
       .join('\n');
  fs.writeFileSync(p, t + (t ? '\n' : ''), 'utf8');
}
function parseCsv(txt: string): Record<string,string>[] {
  const lines = txt.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line);
    const obj: Record<string,string> = {};
    headers.forEach((h,i)=>obj[h]=cols[i] ?? '');
    return obj;
  });
}
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i=0; i<line.length; i++) {
    const c = line[i];
    if (c === '"' ) { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur=''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
                                              }
