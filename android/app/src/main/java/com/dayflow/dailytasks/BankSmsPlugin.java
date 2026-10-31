package com.dayflow.dailytasks;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
        name = "BankSms",
        permissions = {
                @Permission(
                        strings = {
                                Manifest.permission.RECEIVE_SMS,
                                Manifest.permission.READ_SMS
                        },
                        alias = "sms"
                )
        }
)
public class BankSmsPlugin extends Plugin {
    private static BankSmsPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void emitQueued() {
        BankSmsPlugin plugin = instance;
        if (plugin == null) return;
        try {
            plugin.notifyListeners("smsQueued", new JSObject());
        } catch (Exception ignored) {
            // The WebView will drain the queue the next time it opens.
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasSmsPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasSmsPermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasSmsPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void peekQueue(PluginCall call) {
        JSObject payload = new JSObject();
        try {
            payload.put("messages", new JSArray(BankSmsStore.peek(getContext()).toString()));
        } catch (Exception error) {
            payload.put("messages", new JSArray());
        }
        call.resolve(payload);
    }

    @PluginMethod
    public void ackQueue(PluginCall call) {
        try {
            BankSmsStore.ack(getContext(), call.getArray("ids"));
        } catch (Exception ignored) {
            // A later peek will try the same messages again.
        }
        call.resolve();
    }

    @PluginMethod
    public void scanRecent(PluginCall call) {
        if (!hasSmsPermission()) {
            call.reject("permission");
            return;
        }
        Integer requested = call.getInt("days", 30);
        int days = requested == null ? 30 : requested;
        if (days < 1) days = 1;
        if (days > 90) days = 90;
        long since = System.currentTimeMillis() - days * 24L * 60L * 60L * 1000L;
        JSONArray messages = new JSONArray();
        Uri uri = Uri.parse("content://sms/inbox");
        String[] projection = new String[]{"address", "body", "date"};
        Cursor cursor = getContext().getContentResolver().query(
                uri,
                projection,
                "date >= ?",
                new String[]{Long.toString(since)},
                "date DESC"
        );
        if (cursor == null) {
            call.reject("Could not read SMS");
            return;
        }
        try (Cursor rows = cursor) {
            int addressIdx = rows.getColumnIndex("address");
            int bodyIdx = rows.getColumnIndex("body");
            int dateIdx = rows.getColumnIndex("date");
            int seen = 0;
            while (rows.moveToNext() && seen < 2000 && messages.length() < 200) {
                seen++;
                String body = bodyIdx >= 0 ? rows.getString(bodyIdx) : null;
                String stored = BankSmsStore.normalizeBody(body);
                if (!BankSmsStore.looksLikeBankMoney(stored)) continue;
                String address = addressIdx >= 0 ? rows.getString(addressIdx) : "";
                long receivedAt = dateIdx >= 0 ? rows.getLong(dateIdx) : System.currentTimeMillis();
                JSONObject item = new JSONObject();
                item.put("id", BankSmsStore.fingerprint(address, stored));
                item.put("address", address == null ? "" : address);
                item.put("body", stored);
                item.put("receivedAt", receivedAt);
                messages.put(item);
            }
        } catch (SecurityException error) {
            call.reject("permission");
            return;
        } catch (Exception error) {
            call.reject("Could not read SMS");
            return;
        }
        JSObject payload = new JSObject();
        try {
            payload.put("messages", new JSArray(messages.toString()));
        } catch (Exception error) {
            payload.put("messages", new JSArray());
        }
        call.resolve(payload);
    }

    private boolean hasSmsPermission() {
        if (getPermissionState("sms") == PermissionState.GRANTED) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
    }
}
