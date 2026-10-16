// Web: download the export as two files (nothing is kept by the app).
import { collectExport } from './exportCollect';

export async function exportData(userId: string, email: string | null) {
  const { stamp, json, csv } = await collectExport(userId, email);
  for (const [name, body, type] of [[`repproof-${stamp}.json`, json, 'application/json'], [`repproof-sets-${stamp}.csv`, csv, 'text/csv']]) {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Web keeps no export files. */
export function clearExportFiles() {}
