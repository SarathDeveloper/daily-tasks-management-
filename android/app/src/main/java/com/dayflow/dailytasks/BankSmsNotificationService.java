package com.dayflow.dailytasks;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Reads bank debit and credit texts out of the SMS app's notification.
 *
 * Only SMS apps are read: chat apps (WhatsApp, Telegram, ...) are ignored even
 * though their notifications are also tagged as messages. OTP texts are
 * dropped before anything is stored.
 *
 * Play Protect's enhanced fraud protection blocks installing an APK that
 * declares this listener when it is sideloaded from a browser, chat app or
 * file manager. Install over USB (npm run apk:install) instead.
 */
public class BankSmsNotificationService extends NotificationListenerService {
    /** Known SMS apps. The phone's default SMS app is accepted too, whatever its package. */
    private static final Set<String> MESSAGING_PACKAGES = new HashSet<>();

    static {
        MESSAGING_PACKAGES.add("com.google.android.apps.messaging");
        MESSAGING_PACKAGES.add("com.samsung.android.messaging");
        MESSAGING_PACKAGES.add("com.samsung.android.app.messaging");
        MESSAGING_PACKAGES.add("com.android.mms");
        MESSAGING_PACKAGES.add("com.android.messaging");
        MESSAGING_PACKAGES.add("com.oneplus.mms");
        MESSAGING_PACKAGES.add("com.miui.smsextra");
        MESSAGING_PACKAGES.add("com.mi.global.smsextra");
        MESSAGING_PACKAGES.add("com.vivo.messaging");
        MESSAGING_PACKAGES.add("com.oppo.mms");
        MESSAGING_PACKAGES.add("com.coloros.mms");
        MESSAGING_PACKAGES.add("com.realme.messages");
        MESSAGING_PACKAGES.add("com.google.android.apps.messaging.rcs");
    }

    static boolean isSmsApp(Context context, String packageName) {
        if (packageName == null) return false;
        if (MESSAGING_PACKAGES.contains(packageName.toLowerCase(Locale.ROOT))) return true;
        try {
            // Needs no permission; covers OEM SMS apps missing from the list.
            return packageName.equals(Telephony.Sms.getDefaultSmsPackage(context));
        } catch (Exception ignored) {
            return false;
        }
    }

    static boolean isEnabled(Context context) {
        String enabled = android.provider.Settings.Secure.getString(
                context.getContentResolver(),
                "enabled_notification_listeners"
        );
        if (enabled == null || enabled.isEmpty()) return false;
        ComponentName component = new ComponentName(context, BankSmsNotificationService.class);
        String flat = component.flattenToString();
        for (String entry : enabled.split(":")) {
            if (entry == null) continue;
            if (entry.equalsIgnoreCase(flat)) return true;
        }
        return false;
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        BankSmsPlugin.emitQueued();
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        // Android stops the listener after an app update until it is rebound.
        try {
            requestRebind(new ComponentName(this, BankSmsNotificationService.class));
        } catch (Exception ignored) {
            // The user must re-enable notification access.
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;
        Notification notification = sbn.getNotification();
        if (!isSmsApp(this, sbn.getPackageName())) return;
        // SMS apps also show personal texts, so a bank-shaped reference is required.
        boolean requireAccountSignal = true;
        Bundle extras = notification.extras;
        if (extras == null) return;
        String fallbackTitle = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        long postedAt = notification.when > 0 ? notification.when : sbn.getPostTime();
        boolean queued = false;
        Set<String> seen = new HashSet<>();
        queued |= ingestMessages(
                extras.getParcelableArray(Notification.EXTRA_MESSAGES),
                fallbackTitle,
                postedAt,
                seen,
                requireAccountSignal
        );
        queued |= ingestMessages(
                extras.getParcelableArray(Notification.EXTRA_HISTORIC_MESSAGES),
                fallbackTitle,
                postedAt,
                seen,
                requireAccountSignal
        );
        if (!queued) {
            String big = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            String plain = text(extras.getCharSequence(Notification.EXTRA_TEXT));
            String body = plain.isEmpty() ? big : plain;
            queued = enqueue(fallbackTitle, body, postedAt, seen, requireAccountSignal);
        }
        if (queued) BankSmsPlugin.emitQueued();
    }

    private boolean ingestMessages(
            android.os.Parcelable[] messages,
            String fallbackTitle,
            long postedAt,
            Set<String> seen,
            boolean requireAccountSignal
    ) {
        if (messages == null) return false;
        boolean queued = false;
        for (android.os.Parcelable entry : messages) {
            if (!(entry instanceof Bundle)) continue;
            Bundle message = (Bundle) entry;
            String body = text(message.getCharSequence("text"));
            if (body.isEmpty()) continue;
            CharSequence sender = message.getCharSequence("sender");
            String address = sender == null ? fallbackTitle : text(sender);
            if (address.isEmpty()) address = fallbackTitle;
            long at = message.getLong("time", postedAt);
            queued |= enqueue(address, body, at, seen, requireAccountSignal);
        }
        return queued;
    }

    private boolean enqueue(
            String address,
            String body,
            long at,
            Set<String> seen,
            boolean requireAccountSignal
    ) {
        String normalized = BankSmsStore.normalizeBody(body);
        if (normalized.isEmpty()) return false;
        if (requireAccountSignal && !BankSmsStore.hasAccountSignal(normalized)) return false;
        String key = (address == null ? "" : address) + "\n" + normalized;
        if (!seen.add(key)) return false;
        return BankSmsStore.enqueue(getApplicationContext(), address, normalized, at);
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString().replaceAll("\\s+", " ").trim();
    }
}
