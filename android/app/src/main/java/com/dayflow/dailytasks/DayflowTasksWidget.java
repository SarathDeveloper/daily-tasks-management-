package com.dayflow.dailytasks;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** Home-screen list of today's tasks. Rendering lives in {@link DayflowWidgets}. */
public class DayflowTasksWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        DayflowWidgets.renderTasks(context, manager, appWidgetIds);
    }
}
