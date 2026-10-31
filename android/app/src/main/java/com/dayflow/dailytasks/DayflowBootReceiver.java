package com.dayflow.dailytasks;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class DayflowBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            AlarmScheduler.restore(context);
        }
    }
}
