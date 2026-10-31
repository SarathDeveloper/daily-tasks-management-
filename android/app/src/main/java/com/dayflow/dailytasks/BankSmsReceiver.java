package com.dayflow.dailytasks;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/**
 * Persists bank debit and credit SMS before the WebView is awake.
 * OTP and ordinary chats are dropped here and never written to disk.
 */
public class BankSmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) return;
        StringBuilder body = new StringBuilder();
        String address = "";
        long receivedAt = System.currentTimeMillis();
        for (SmsMessage message : messages) {
            if (message == null) continue;
            if (address.isEmpty() && message.getOriginatingAddress() != null) {
                address = message.getOriginatingAddress();
            }
            String part = message.getMessageBody();
            if (part != null) body.append(part);
            if (message.getTimestampMillis() > 0) receivedAt = message.getTimestampMillis();
        }
        if (body.length() == 0) return;
        if (BankSmsStore.enqueue(context, address, body.toString(), receivedAt)) {
            BankSmsPlugin.emitQueued();
        }
    }
}
