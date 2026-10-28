package com.ksan.dailytasks;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.io.IOException;

@CapacitorPlugin(name = "DayflowAlarm")
public class DayflowAlarmPlugin extends Plugin {
    private static DayflowAlarmPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void emit(String type, String id, String kind, long at, int snoozeMinutes) {
        DayflowAlarmPlugin plugin = instance;
        if (plugin == null) return;
        JSObject event = new JSObject();
        event.put("type", type);
        event.put("id", id);
        event.put("kind", kind);
        event.put("at", at);
        event.put("snoozeMinutes", snoozeMinutes);
        plugin.notifyListeners("alarmEvent", event);
    }

    @PluginMethod
    public void pickMusic(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(call, intent, "musicResult");
    }

    @ActivityCallback
    private void musicResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("cancelled");
            return;
        }
        try {
            String name = AlarmScheduler.copyMusic(getContext(), uri);
            JSObject payload = new JSObject();
            payload.put("name", name);
            call.resolve(payload);
        } catch (IOException error) {
            call.reject("too-large".equals(error.getMessage()) ? "too-large" : "Could not copy the song");
        }
    }

    @PluginMethod
    public void clearMusic(PluginCall call) {
        AlarmScheduler.clearMusic(getContext());
        call.resolve();
    }

    @PluginMethod
    public void hasMusic(PluginCall call) {
        JSObject payload = new JSObject();
        boolean has = AlarmScheduler.hasMusic(getContext());
        payload.put("has", has);
        payload.put("name", has ? AlarmScheduler.musicName(getContext()) : "");
        call.resolve(payload);
    }

    @PluginMethod
    public void preview(PluginCall call) {
        AlarmScheduler.preview(getContext(), call.getString("sound", "chime"));
        call.resolve();
    }

    @PluginMethod
    public void stopPreview(PluginCall call) {
        AlarmScheduler.stopPreview();
        call.resolve();
    }

    @PluginMethod
    public void sync(PluginCall call) {
        try {
            JSArray plans = call.getArray("plans");
            AlarmScheduler.replace(getContext(), plans == null ? new JSONArray() : plans);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not update alarms", error);
        }
    }

    @PluginMethod
    public void consumeEvents(PluginCall call) {
        JSONArray drained = AlarmScheduler.drainEvents(getContext());
        JSObject payload = new JSObject();
        try {
            payload.put("events", new JSArray(drained.toString()));
        } catch (Exception error) {
            payload.put("events", new JSArray());
        }
        call.resolve(payload);
    }
}
