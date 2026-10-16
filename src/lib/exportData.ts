// Android/iOS: write the export to the cache folder and open the share sheet (save to Files, Drive, email...).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { collectExport } from './exportCollect';

export async function exportData(userId: string, email: string | null) {
  clearExportFiles(); // earlier exports never pile up
  const { stamp, json, csv } = await collectExport(userId, email);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const files = [
    { file: new File(Paths.cache, `repproof-${stamp}.json`), body: json, mimeType: 'application/json', dialogTitle: 'Your RepProof data' },
    { file: new File(Paths.cache, `repproof-sets-${stamp}.csv`), body: csv, mimeType: 'text/csv', dialogTitle: 'Your logged sets (CSV)' },
  ];
  for (const f of files) {
    if (f.file.exists) f.file.delete();
    f.file.create();
    f.file.write(f.body);
  }
  for (const f of files) await Sharing.shareAsync(f.file.uri, { mimeType: f.mimeType, dialogTitle: f.dialogTitle });
  // Not deleted here: some share targets (e.g. a cloud upload) keep reading the file after the share sheet
  // closes. Old exports are swept instead (next export, sign-out, account deletion). The cache is private
  // to the app and Android backup is off.
}

/** Removes any export left in the cache (repproof-*.json / repproof-sets-*.csv). Never throws. */
export function clearExportFiles() {
  try {
    for (const item of Paths.cache.list()) {
      if (item instanceof File && /^repproof-.*\.(json|csv)$/.test(item.name)) item.delete();
    }
  } catch {
    // nothing to clear, or the cache is unavailable
  }
}
