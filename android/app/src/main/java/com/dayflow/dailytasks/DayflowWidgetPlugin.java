package com.dayflow.dailytasks;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the widget snapshot from the WebView. */
@CapacitorPlugin(name = "DayflowWidget")
public class DayflowWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null) {
            call.reject("snapshot is required");
            return;
        }
        DayflowWidgets.save(getContext(), snapshot);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        DayflowWidgets.clear(getContext());
        call.resolve();
    }
}
