package com.ksan.dailytasks;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class DayflowRingActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        String title = getIntent().getStringExtra(AlarmScheduler.EXTRA_TITLE);
        String body = getIntent().getStringExtra(AlarmScheduler.EXTRA_BODY);
        int minutes = getIntent().getIntExtra(AlarmScheduler.EXTRA_SNOOZE, 10);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#0F172A"));
        int pad = dp(24);
        root.setPadding(pad, pad, pad, pad);

        TextView label = text("ALARM", 12, Color.parseColor("#C7D2FE"));
        TextView heading = text(title == null || title.isEmpty() ? "Alarm" : title, 32, Color.WHITE);
        heading.setTypeface(Typeface.DEFAULT_BOLD);
        TextView detail = text(body == null ? "" : body, 16, Color.parseColor("#CBD5E1"));
        root.addView(label);
        root.addView(heading);
        root.addView(detail);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(0, dp(52), 1);
        buttonParams.setMargins(dp(6), dp(28), dp(6), 0);

        Button snooze = new Button(this);
        snooze.setText("Snooze " + minutes + "m");
        snooze.setOnClickListener(view -> send(DayflowRingService.ACTION_SNOOZE));
        Button dismiss = new Button(this);
        dismiss.setText("Dismiss");
        dismiss.setOnClickListener(view -> send(DayflowRingService.ACTION_DISMISS));
        row.addView(snooze, buttonParams);
        row.addView(dismiss, buttonParams);
        root.addView(row);
        setContentView(root);
        startRinging(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        startRinging(intent);
    }

    private void startRinging(Intent source) {
        if (source == null || source.getStringExtra(AlarmScheduler.EXTRA_ID) == null) return;
        Intent service = new Intent(this, DayflowRingService.class);
        service.setAction(DayflowRingService.ACTION_START);
        DayflowAlarmReceiver.copyExtras(source, service);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(service);
        } else {
            startService(service);
        }
    }

    private void send(String action) {
        Intent service = new Intent(this, DayflowRingService.class);
        service.setAction(action);
        DayflowAlarmReceiver.copyExtras(getIntent(), service);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(service);
        } else {
            startService(service);
        }
        finish();
    }

    private TextView text(String value, int sp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        view.setPadding(0, dp(6), 0, dp(6));
        return view;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
