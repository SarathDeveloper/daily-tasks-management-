package com.ksan.dailytasks;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class DayflowAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        // The alarm delivery grants this receiver a brief right to open the
        // ringing screen. A foreground service started afterwards does not
        // inherit that right, so the screen has to open here.
        Intent activity = new Intent(context, DayflowRingActivity.class);
        activity.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        copyExtras(intent, activity);
        try {
            context.startActivity(activity);
        } catch (Exception ignored) {
            // The service notification's full-screen intent is the fallback.
        }
        Intent service = new Intent(context, DayflowRingService.class);
        service.setAction(DayflowRingService.ACTION_START);
        copyExtras(intent, service);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(service);
        } else {
            context.startService(service);
        }
    }

    static void copyExtras(Intent from, Intent to) {
        to.putExtra(AlarmScheduler.EXTRA_ID, from.getStringExtra(AlarmScheduler.EXTRA_ID));
        to.putExtra(AlarmScheduler.EXTRA_TITLE, from.getStringExtra(AlarmScheduler.EXTRA_TITLE));
        to.putExtra(AlarmScheduler.EXTRA_BODY, from.getStringExtra(AlarmScheduler.EXTRA_BODY));
        to.putExtra(AlarmScheduler.EXTRA_SOUND, from.getStringExtra(AlarmScheduler.EXTRA_SOUND));
        to.putExtra(AlarmScheduler.EXTRA_KIND, from.getStringExtra(AlarmScheduler.EXTRA_KIND));
        to.putExtra(AlarmScheduler.EXTRA_SNOOZE, from.getIntExtra(AlarmScheduler.EXTRA_SNOOZE, 10));
        to.putExtra(AlarmScheduler.EXTRA_NOTIFICATION_ID, from.getIntExtra(AlarmScheduler.EXTRA_NOTIFICATION_ID, 0));
        to.putExtra(AlarmScheduler.EXTRA_TIME, from.getStringExtra(AlarmScheduler.EXTRA_TIME));
        to.putExtra(AlarmScheduler.EXTRA_DAYS, from.getStringExtra(AlarmScheduler.EXTRA_DAYS));
    }
}
