package com.ksan.dailytasks;

import android.app.ActivityOptions;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Calendar;

/** Stores the device song and the pending ring list, and talks to AlarmManager. */
public final class AlarmScheduler {
    static final String PREFS = "dayflow_alarms";
    static final String KEY_PLANS = "plans";
    static final String KEY_EVENTS = "events";
    static final String KEY_MUSIC_NAME = "music_name";
    static final String MUSIC_FILE = "reminder-music";
    static final int MAX_MUSIC_BYTES = 15 * 1024 * 1024;

    static final String EXTRA_ID = "id";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_SOUND = "sound";
    static final String EXTRA_KIND = "kind";
    static final String EXTRA_SNOOZE = "snoozeMinutes";
    static final String EXTRA_NOTIFICATION_ID = "notificationId";
    static final String EXTRA_TIME = "time";
    static final String EXTRA_DAYS = "days";

    private static MediaPlayer previewPlayer;

    private AlarmScheduler() {}

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static File musicFile(Context context) {
        return new File(context.getFilesDir(), MUSIC_FILE);
    }

    static void replace(Context context, JSONArray plans) {
        cancelAll(context);
        prefs(context).edit().putString(KEY_PLANS, plans == null ? "[]" : plans.toString()).apply();
        restore(context);
    }

    static void restore(Context context) {
        JSONArray plans = readPlans(context);
        for (int i = 0; i < plans.length(); i++) {
            JSONObject plan = plans.optJSONObject(i);
            if (plan == null) continue;
            long at = plan.optLong("at", 0);
            if (at <= System.currentTimeMillis()) continue;
            schedule(context, plan, at);
        }
    }

    static void schedule(Context context, JSONObject plan, long at) {
        int requestCode = plan.optInt("notificationId", plan.optString("id", "alarm").hashCode());
        Intent intent = new Intent(context, DayflowAlarmReceiver.class);
        intent.putExtra(EXTRA_ID, plan.optString("id"));
        intent.putExtra(EXTRA_TITLE, plan.optString("title", "Alarm"));
        intent.putExtra(EXTRA_BODY, plan.optString("body", ""));
        intent.putExtra(EXTRA_SOUND, plan.optString("sound", "chime"));
        intent.putExtra(EXTRA_KIND, plan.optString("kind", "alarm"));
        intent.putExtra(EXTRA_SNOOZE, plan.optInt("snoozeMinutes", 10));
        intent.putExtra(EXTRA_NOTIFICATION_ID, requestCode);
        intent.putExtra(EXTRA_TIME, plan.optString("time", ""));
        intent.putExtra(EXTRA_DAYS, daysToCsv(plan.optJSONArray("daysOfWeek")));
        Intent activity = new Intent(context, DayflowRingActivity.class);
        activity.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        activity.putExtras(intent);
        PendingIntent pending = ringPending(context, requestCode, activity);
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            } else {
                manager.setExact(AlarmManager.RTC_WAKEUP, at, pending);
            }
        } catch (SecurityException ignored) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            } else {
                manager.set(AlarmManager.RTC_WAKEUP, at, pending);
            }
        }
    }

    static void cancelAll(Context context) {
        JSONArray plans = readPlans(context);
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        for (int i = 0; i < plans.length(); i++) {
            JSONObject plan = plans.optJSONObject(i);
            if (plan == null) continue;
            int requestCode = plan.optInt("notificationId", 0);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            PendingIntent broadcast = PendingIntent.getBroadcast(
                context,
                requestCode,
                new Intent(context, DayflowAlarmReceiver.class),
                flags
            );
            manager.cancel(broadcast);
            broadcast.cancel();
            PendingIntent activity = ringPending(context, requestCode, new Intent(context, DayflowRingActivity.class));
            manager.cancel(activity);
            activity.cancel();
        }
    }

    /** AlarmManager launches the ringing screen itself, so the screen can appear while the app is closed. */
    private static PendingIntent ringPending(Context context, int requestCode, Intent activity) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ActivityOptions options = ActivityOptions.makeBasic();
            options.setPendingIntentBackgroundActivityStartMode(
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
            );
            options.setPendingIntentCreatorBackgroundActivityStartMode(
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
            );
            return PendingIntent.getActivity(context, requestCode, activity, flags, options.toBundle());
        }
        return PendingIntent.getActivity(context, requestCode, activity, flags);
    }

    static JSONArray readPlans(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_PLANS, "[]"));
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    static void snooze(Context context, Intent fired, int minutes) {
        long at = System.currentTimeMillis() + minutes * 60_000L;
        String id = fired.getStringExtra(EXTRA_ID);
        JSONArray plans = readPlans(context);
        JSONObject matched = null;
        for (int i = 0; i < plans.length(); i++) {
            JSONObject plan = plans.optJSONObject(i);
            if (plan != null && id != null && id.equals(plan.optString("id"))) {
                try {
                    plan.put("at", at);
                } catch (Exception ignored) {
                    // The original plan still rings at its old time if this write fails.
                }
                matched = plan;
                break;
            }
        }
        prefs(context).edit().putString(KEY_PLANS, plans.toString()).apply();
        if (matched != null) schedule(context, matched, at);
        enqueue(context, "snooze", fired, at - minutes * 60_000L);
    }

    static void dismiss(Context context, Intent fired) {
        String id = fired.getStringExtra(EXTRA_ID);
        String kind = fired.getStringExtra(EXTRA_KIND);
        String days = fired.getStringExtra(EXTRA_DAYS);
        String time = fired.getStringExtra(EXTRA_TIME);
        JSONArray plans = readPlans(context);
        JSONArray next = new JSONArray();
        JSONObject kept = null;
        for (int i = 0; i < plans.length(); i++) {
            JSONObject plan = plans.optJSONObject(i);
            if (plan == null) continue;
            if (id != null && id.equals(plan.optString("id")) && "alarm".equals(kind) && days != null && !days.isEmpty()) {
                long following = nextRepeat(time, days, System.currentTimeMillis());
                if (following > 0) {
                    try {
                        plan.put("at", following);
                    } catch (Exception ignored) {
                        // Leave the stored time; the app resyncs the rule when it next opens.
                    }
                    kept = plan;
                    next.put(plan);
                }
                continue;
            }
            if (id != null && id.equals(plan.optString("id"))) continue;
            next.put(plan);
        }
        prefs(context).edit().putString(KEY_PLANS, next.toString()).apply();
        if (kept != null) schedule(context, kept, kept.optLong("at"));
        enqueue(context, "dismiss", fired, System.currentTimeMillis());
    }

    static void enqueue(Context context, String type, Intent fired, long at) {
        try {
            JSONArray events;
            synchronized (AlarmScheduler.class) {
                events = new JSONArray(prefs(context).getString(KEY_EVENTS, "[]"));
                JSONObject event = new JSONObject();
                event.put("type", type);
                event.put("id", fired.getStringExtra(EXTRA_ID));
                event.put("kind", fired.getStringExtra(EXTRA_KIND));
                event.put("at", at);
                event.put("snoozeMinutes", fired.getIntExtra(EXTRA_SNOOZE, 10));
                events.put(event);
                prefs(context).edit().putString(KEY_EVENTS, events.toString()).apply();
            }
            DayflowAlarmPlugin.emit(
                type,
                fired.getStringExtra(EXTRA_ID),
                fired.getStringExtra(EXTRA_KIND),
                at,
                fired.getIntExtra(EXTRA_SNOOZE, 10)
            );
        } catch (Exception ignored) {
            // The ringing screen already stopped; the app reconciles on the next open.
        }
    }

    static JSONArray drainEvents(Context context) {
        synchronized (AlarmScheduler.class) {
            JSONArray events;
            try {
                events = new JSONArray(prefs(context).getString(KEY_EVENTS, "[]"));
            } catch (Exception ignored) {
                events = new JSONArray();
            }
            prefs(context).edit().putString(KEY_EVENTS, "[]").apply();
            return events;
        }
    }

    static String copyMusic(Context context, Uri uri) throws IOException {
        String name = "Song";
        Cursor cursor = context.getContentResolver().query(
            uri,
            new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE},
            null,
            null,
            null
        );
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                    if (nameIndex >= 0 && cursor.getString(nameIndex) != null) name = cursor.getString(nameIndex);
                    if (sizeIndex >= 0 && !cursor.isNull(sizeIndex) && cursor.getLong(sizeIndex) > MAX_MUSIC_BYTES) {
                        throw new IOException("too-large");
                    }
                }
            } finally {
                cursor.close();
            }
        }

        File temp = new File(context.getFilesDir(), MUSIC_FILE + ".tmp");
        long total = 0;
        try (InputStream in = context.getContentResolver().openInputStream(uri);
             OutputStream out = new FileOutputStream(temp)) {
            if (in == null) throw new IOException("empty");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) >= 0) {
                total += read;
                if (total > MAX_MUSIC_BYTES) throw new IOException("too-large");
                if (read > 0) out.write(buffer, 0, read);
            }
        } catch (IOException error) {
            temp.delete();
            throw error;
        }
        if (total <= 0) {
            temp.delete();
            throw new IOException("empty");
        }
        File dest = musicFile(context);
        if (dest.exists() && !dest.delete()) temp.delete();
        if (!temp.renameTo(dest)) {
            temp.delete();
            throw new IOException("rename");
        }
        prefs(context).edit().putString(KEY_MUSIC_NAME, name).apply();
        return name;
    }

    static void clearMusic(Context context) {
        musicFile(context).delete();
        prefs(context).edit().remove(KEY_MUSIC_NAME).apply();
        stopPreview();
    }

    static boolean hasMusic(Context context) {
        return musicFile(context).exists() && musicFile(context).length() > 0;
    }

    static String musicName(Context context) {
        return prefs(context).getString(KEY_MUSIC_NAME, "");
    }

    static void preview(Context context, String sound) {
        stopPreview();
        MediaPlayer player = buildPlayer(context, sound, false);
        if (player == null) return;
        previewPlayer = player;
        player.setOnCompletionListener(completed -> stopPreview());
        player.start();
    }

    static void stopPreview() {
        if (previewPlayer == null) return;
        try {
            previewPlayer.stop();
        } catch (Exception ignored) {
            // already stopped
        }
        previewPlayer.release();
        previewPlayer = null;
    }

    static MediaPlayer buildPlayer(Context context, String sound, boolean loop) {
        try {
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build());
            if ("music".equals(sound) && hasMusic(context)) {
                player.setDataSource(musicFile(context).getAbsolutePath());
            } else {
                int raw = rawFor(sound);
                android.content.res.AssetFileDescriptor fd = context.getResources().openRawResourceFd(raw);
                player.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
                fd.close();
            }
            player.setLooping(loop);
            player.prepare();
            return player;
        } catch (Exception ignored) {
            return null;
        }
    }

    static int rawFor(String sound) {
        if ("bell".equals(sound)) return R.raw.bell;
        if ("digital".equals(sound)) return R.raw.digital;
        if ("gentle".equals(sound)) return R.raw.gentle;
        return R.raw.chime;
    }

    private static String daysToCsv(JSONArray days) {
        if (days == null || days.length() == 0) return "";
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < days.length(); i++) {
            if (builder.length() > 0) builder.append(',');
            builder.append(days.optInt(i));
        }
        return builder.toString();
    }

    /** Next matching weekday strictly after `after`. Returns 0 when the rule is once. */
    static long nextRepeat(String time, String daysCsv, long after) {
        if (time == null || !time.contains(":") || daysCsv == null || daysCsv.isEmpty()) return 0;
        String[] parts = time.split(":");
        int hours;
        int minutes;
        try {
            hours = Integer.parseInt(parts[0]);
            minutes = Integer.parseInt(parts[1]);
        } catch (Exception ignored) {
            return 0;
        }
        boolean[] allowed = new boolean[7];
        for (String piece : daysCsv.split(",")) {
            try {
                int day = Integer.parseInt(piece.trim());
                if (day >= 0 && day <= 6) allowed[day] = true;
            } catch (Exception ignored) {
                // skip a bad day token
            }
        }
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(after);
        for (int offset = 0; offset < 8; offset++) {
            Calendar candidate = (Calendar) calendar.clone();
            candidate.add(Calendar.DATE, offset);
            candidate.set(Calendar.HOUR_OF_DAY, hours);
            candidate.set(Calendar.MINUTE, minutes);
            candidate.set(Calendar.SECOND, 0);
            candidate.set(Calendar.MILLISECOND, 0);
            if (candidate.getTimeInMillis() <= after) continue;
            int javaDay = candidate.get(Calendar.DAY_OF_WEEK);
            int jsDay = javaDay - 1;
            if (allowed[jsDay]) return candidate.getTimeInMillis();
        }
        return 0;
    }
}
