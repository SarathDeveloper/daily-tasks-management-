package com.dayflow.dailytasks;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Home-screen widgets. The WebView owns the data, so it pushes a small JSON
 * snapshot (today's tasks and spending) whenever that data changes; the
 * widgets only render the last snapshot. A snapshot from an earlier day is
 * shown as stale instead of pretending yesterday's list is today's.
 */
final class DayflowWidgets {
    private static final String PREFS = "dayflow_widgets";
    private static final String KEY_SNAPSHOT = "snapshot";
    private static final int[] TASK_ROWS = {
            R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3, R.id.widget_task_4, R.id.widget_task_5,
    };

    private DayflowWidgets() {}

    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SNAPSHOT, json).apply();
        refreshAll(context);
    }

    static void clear(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_SNAPSHOT).apply();
        refreshAll(context);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        renderTasks(context, manager, manager.getAppWidgetIds(new ComponentName(context, DayflowTasksWidget.class)));
        renderSpend(context, manager, manager.getAppWidgetIds(new ComponentName(context, DayflowSpendWidget.class)));
    }

    private static JSONObject snapshot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_SNAPSHOT, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String money(double rupees) {
        NumberFormat format = NumberFormat.getCurrencyInstance(new Locale("en", "IN"));
        format.setMaximumFractionDigits(rupees == Math.rint(rupees) ? 0 : 2);
        return format.format(rupees);
    }

    static void renderTasks(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        JSONObject data = snapshot(context);
        boolean fresh = data != null && today().equals(data.optString("date"));

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_tasks);
        views.setOnClickPendingIntent(R.id.widget_tasks_root, openApp(context));
        for (int row : TASK_ROWS) views.setViewVisibility(row, View.GONE);

        if (!fresh) {
            views.setTextViewText(R.id.widget_tasks_count, "");
            views.setTextViewText(R.id.widget_tasks_empty, "Open Dayflow to load today's tasks");
            views.setViewVisibility(R.id.widget_tasks_empty, View.VISIBLE);
        } else {
            int remaining = data.optInt("remaining");
            int total = data.optInt("total");
            views.setTextViewText(
                    R.id.widget_tasks_count, total == 0 ? "" : (total - remaining) + "/" + total + " done");
            JSONArray tasks = data.optJSONArray("tasks");
            int shown = 0;
            if (tasks != null) {
                for (int i = 0; i < tasks.length() && shown < TASK_ROWS.length; i++) {
                    JSONObject task = tasks.optJSONObject(i);
                    if (task == null) continue;
                    String time = task.optString("time", "");
                    String mark = task.optBoolean("done") ? "✓ " : "○ ";
                    String line = mark + (time.isEmpty() ? "" : time + "  ") + task.optString("title");
                    views.setTextViewText(TASK_ROWS[shown], line);
                    views.setViewVisibility(TASK_ROWS[shown], View.VISIBLE);
                    shown++;
                }
            }
            boolean empty = shown == 0;
            views.setTextViewText(R.id.widget_tasks_empty, total == 0 ? "Nothing planned today" : "All done for today");
            views.setViewVisibility(R.id.widget_tasks_empty, empty ? View.VISIBLE : View.GONE);
        }
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    static void renderSpend(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        JSONObject data = snapshot(context);
        String today = today();
        boolean fresh = data != null && today.equals(data.optString("date"));
        boolean sameMonth = data != null && data.optString("date").startsWith(today.substring(0, 7));

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_spend);
        views.setOnClickPendingIntent(R.id.widget_spend_root, openApp(context));
        if (data == null) {
            views.setTextViewText(R.id.widget_spend_today, "—");
            views.setTextViewText(R.id.widget_spend_month, "Open Dayflow to load spending");
            views.setTextViewText(R.id.widget_spend_budget, "");
        } else {
            // A new day has spent nothing yet as far as the widget knows.
            views.setTextViewText(R.id.widget_spend_today, money(fresh ? data.optDouble("spentToday", 0) : 0));
            views.setTextViewText(
                    R.id.widget_spend_month,
                    sameMonth
                            ? money(data.optDouble("spentMonth", 0)) + " this month"
                            : "Open Dayflow to load this month");
            double budget = data.optDouble("monthBudget", 0);
            if (sameMonth && budget > 0) {
                long pct = Math.round(data.optDouble("spentMonth", 0) / budget * 100);
                views.setTextViewText(R.id.widget_spend_budget, pct + "% of " + money(budget) + " budget");
            } else {
                views.setTextViewText(R.id.widget_spend_budget, "");
            }
        }
        for (int id : ids) manager.updateAppWidget(id, views);
    }
}
