package com.dayflow.dailytasks;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** Home-screen card with today's and this month's spending. Rendering lives in {@link DayflowWidgets}. */
public class DayflowSpendWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        DayflowWidgets.renderSpend(context, manager, appWidgetIds);
    }
}
