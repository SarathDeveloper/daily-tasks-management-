package com.dayflow.dailytasks;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge for bank spends captured from messaging notifications.
 *
 * No SMS permission is declared anywhere in this app. Android reserves
 * READ_SMS/RECEIVE_SMS for the default SMS app, and Play Protect blocks
 * sideloading an APK that asks for them.
 */
@CapacitorPlugin(name = "BankSms")
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
    public void isEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", BankSmsNotificationService.isEnabled(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Intent detail = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
                detail.putExtra(
                        Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                        new android.content.ComponentName(
                                getContext(),
                                BankSmsNotificationService.class
                        ).flattenToString()
                );
                getContext().startActivity(detail.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } else {
                getContext().startActivity(
                        new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                );
            }
            call.resolve();
        } catch (Exception first) {
            try {
                getContext().startActivity(
                        new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                );
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not open notification settings");
            }
        }
    }

    /** Android 13+ hides notification access behind "Allow restricted settings". */
    @PluginMethod
    public void openAppDetails(PluginCall call) {
        try {
            Intent intent = new Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName())
            );
            getContext().startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open app settings");
        }
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
}
