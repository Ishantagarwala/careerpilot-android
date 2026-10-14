import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPermissionStatus = 'undetermined' | 'granted' | 'denied';

const NOTIFICATION_PERMISSION_KEY = '@careerpilot_notification_perm';

class NotificationService {
  private permissionStatus: NotificationPermissionStatus = 'undetermined';
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_KEY);
      if (stored === 'granted' || stored === 'denied' || stored === 'undetermined') {
        this.permissionStatus = stored;
      }
    } catch {
      // Default to undetermined
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Get current permission status for local timer notifications
   */
  public async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    if (!this.isLoaded) {
      await this.init();
    }
    return this.permissionStatus;
  }

  /**
   * Request permission to alert on timer completion.
   * Handles denial gracefully without throwing.
   */
  public async requestPermission(): Promise<NotificationPermissionStatus> {
    // If running in browser/web environment with Notification API
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await (window as any).Notification.requestPermission();
        this.permissionStatus = result === 'granted' ? 'granted' : 'denied';
        await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, this.permissionStatus);
        return this.permissionStatus;
      } catch {
        this.permissionStatus = 'denied';
        await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'denied');
        return 'denied';
      }
    }

    // Native environment simulation / fallback: grant local alert permission
    this.permissionStatus = 'granted';
    try {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'granted');
    } catch {
      // Ignore
    }
    return this.permissionStatus;
  }

  /**
   * Explicitly set permission (e.g., from settings or denial handler)
   */
  public async setPermissionStatus(status: NotificationPermissionStatus): Promise<void> {
    this.permissionStatus = status;
    try {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, status);
    } catch {
      // Ignore
    }
  }

  /**
   * Notify completion of a study timer session.
   * Scoped strictly to local study alerts; never triggers or implies remote push.
   */
  public async notifySessionComplete(title: string, body: string): Promise<boolean> {
    const status = await this.getPermissionStatus();
    if (status !== 'granted') {
      return false; // Denied or not granted, skip gracefully
    }

    // If browser Notification API is available and granted
    if (typeof window !== 'undefined' && 'Notification' in window && (window as any).Notification.permission === 'granted') {
      try {
        new (window as any).Notification(title, {
          body,
          icon: '/favicon.ico',
        });
        return true;
      } catch {
        return false;
      }
    }

    // In native runtime or tests, returns true when permitted
    return true;
  }
}

export const notificationService = new NotificationService();
