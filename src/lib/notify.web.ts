// Web: expo-notifications does not support the browser, so rest alerts are off (the on-screen timer still runs).
export const notificationsSupported = false;
export const restAlertsOn = () => false;
export async function setRestAlerts(_on: boolean): Promise<boolean> { return false; }
export async function scheduleRestAlert(_seconds: number, _next: string | null) {}
export async function cancelRestAlert() {}
