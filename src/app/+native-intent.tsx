import { safeLink } from '@/lib/links';

// expo-router calls this for every link that opens the app, before routing it.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return safeLink(path);
}
