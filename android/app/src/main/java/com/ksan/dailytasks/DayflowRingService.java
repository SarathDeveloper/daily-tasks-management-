package com.ksan.dailytasks;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class DayflowRingService extends Service {
    static final String ACTION_START = "com.ksan.dailytasks.RING";
    static final String ACTION_DISMISS = "com.ksan.dailytasks.DISMISS";
    static final String ACTION_SNOOZE = "com.ksan.dailytasks.SNOOZE";
    private static final String CHANNEL_ID = "dayflow_ring";
    private static final int NOTICE_ID = 42;

    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;
    private String ringingId;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_DISMISS.equals(action)) {
            stopRinging();
            AlarmScheduler.dismiss(this, intent);
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_SNOOZE.equals(action)) {
            stopRinging();
            int minutes = intent.getIntExtra(AlarmScheduler.EXTRA_SNOOZE, 10);
            AlarmScheduler.snooze(this, intent, minutes);
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        if (id != null && id.equals(ringingId) && player != null) return START_NOT_STICKY;
        ringingId = id;
        ensureChannel();
        Notification notification = buildNotification(intent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTICE_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTICE_ID, notification);
        }
        acquireWakeLock();
        stopRinging();
        player = AlarmScheduler.buildPlayer(this, intent.getStringExtra(AlarmScheduler.EXTRA_SOUND), true);
        if (player != null) player.start();
        openScreen(intent);
        return START_NOT_STICKY;
    }

    private void openScreen(Intent source) {
        Intent activity = new Intent(this, DayflowRingActivity.class);
        activity.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        DayflowAlarmReceiver.copyExtras(source, activity);
        try {
            startActivity(activity);
        } catch (Exception ignored) {
            // The full-screen notification intent still opens the screen when the system allows it.
        }
    }

    private Notification buildNotification(Intent source) {
        String title = source.getStringExtra(AlarmScheduler.EXTRA_TITLE);
        String body = source.getStringExtra(AlarmScheduler.EXTRA_BODY);
        Intent open = new Intent(this, DayflowRingActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        DayflowAlarmReceiver.copyExtras(source, open);
        PendingIntent fullScreen = PendingIntent.getActivity(
            this,
            70,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        int minutes = source.getIntExtra(AlarmScheduler.EXTRA_SNOOZE, 10);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_icon)
            .setContentTitle(title == null || title.isEmpty() ? "Alarm" : title)
            .setContentText(body == null ? "" : body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .addAction(0, "Snooze " + minutes + "m", actionIntent(ACTION_SNOOZE, source, 71))
            .addAction(0, "Dismiss", actionIntent(ACTION_DISMISS, source, 72))
            .build();
    }

    private PendingIntent actionIntent(String action, Intent source, int requestCode) {
        Intent intent = new Intent(this, DayflowRingService.class);
        intent.setAction(action);
        DayflowAlarmReceiver.copyExtras(source, intent);
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Rings until you dismiss or snooze");
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager manager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (manager == null) return;
        wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "dayflow:ring");
        wakeLock.acquire(10 * 60 * 1000L);
    }

    private void stopRinging() {
        if (player != null) {
            try {
                player.stop();
            } catch (Exception ignored) {
                // already stopped
            }
            player.release();
            player = null;
        }
    }

    @Override
    public void onDestroy() {
        stopRinging();
        ringingId = null;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }
}
