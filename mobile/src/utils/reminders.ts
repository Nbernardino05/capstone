import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ID_PREFIX = 'reminder_notif_';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Schedule a daily local notification for a medication and persist its ID. */
export async function scheduleReminder(
  medicationId: number,
  medicationName: string,
  timeStr: string // 'HH:MM'
): Promise<void> {
  // Cancel any existing notification for this medication first
  await cancelReminder(medicationId);

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Medication Reminder',
      body: `Time to take your ${medicationName}`,
      data: { medicationId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(`${NOTIF_ID_PREFIX}${medicationId}`, notifId);
}

/** Cancel the scheduled notification for a medication. */
export async function cancelReminder(medicationId: number): Promise<void> {
  const storedId = await AsyncStorage.getItem(`${NOTIF_ID_PREFIX}${medicationId}`);
  if (storedId) {
    await Notifications.cancelScheduledNotificationAsync(storedId);
    await AsyncStorage.removeItem(`${NOTIF_ID_PREFIX}${medicationId}`);
  }
}
