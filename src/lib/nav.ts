import { router } from 'expo-router';

/** Back if there is a screen to return to (deep link or app restart may leave none), else Home. */
export function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}
