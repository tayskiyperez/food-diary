import { LocalNotifications } from '@capacitor/local-notifications';

export async function initNotifications() {
    try {
        // Запрашиваем разрешение на уведомления
        const perm = await LocalNotifications.requestPermissions();

        if (perm && perm.display === 'granted') {
            console.log('Уведомления разрешены ✅');
        } else {
            console.log('Уведомления запрещены ❌');
        }
    } catch (e) {
        console.error('Ошибка при запросе разрешения на уведомления:', e);
    }
}
