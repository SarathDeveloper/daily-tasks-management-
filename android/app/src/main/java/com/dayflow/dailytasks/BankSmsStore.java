package com.dayflow.dailytasks;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * On-device queue for bank SMS that arrive while the WebView is not running.
 * The fingerprint must stay in step with smsFingerprint in src/lib/bankSmsParse.ts.
 */
final class BankSmsStore {
    private static final String PREFS = "dayflow_bank_sms";
    private static final String KEY_QUEUE = "queue";
    private static final int MAX_QUEUE = 80;
    private static final int MAX_BODY = 500;

    private BankSmsStore() {}

    static boolean looksLikeBankMoney(String body) {
        if (body == null) return false;
        String lower = body.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        if (lower.length() < 12 || lower.length() > 700) return false;
        boolean movement = lower.contains("debited")
                || lower.contains("credited")
                || lower.contains("spent")
                || lower.contains("withdrawn")
                || lower.contains("withdrawal")
                || lower.contains("deposited")
                || lower.contains("sent rs")
                || lower.contains("sent inr")
                || lower.contains("received rs")
                || lower.contains("received inr")
                || lower.contains("payment of")
                || lower.matches(".*\\bpaid\\b.*");
        if (!movement) return false;
        return lower.contains("rs")
                || lower.contains("inr")
                || lower.contains("rupee")
                || lower.contains("₹");
    }

    static String fingerprint(String address, String body) {
        String normalized = ((address == null ? "" : address) + "\n" + (body == null ? "" : body))
                .trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
        return "sms:" + fnv1a64(normalized);
    }

    static String normalizeBody(String body) {
        if (body == null) return "";
        String trimmed = body.trim().replaceAll("\\s+", " ");
        if (trimmed.length() <= MAX_BODY) return trimmed;
        return trimmed.substring(0, MAX_BODY);
    }

    static boolean enqueue(Context context, String address, String body, long receivedAt) {
        String stored = normalizeBody(body);
        if (!looksLikeBankMoney(stored)) return false;
        String id = fingerprint(address, stored);
        synchronized (BankSmsStore.class) {
            JSONArray queue = read(context);
            for (int i = 0; i < queue.length(); i++) {
                JSONObject existing = queue.optJSONObject(i);
                if (existing != null && id.equals(existing.optString("id"))) return false;
            }
            JSONObject item = new JSONObject();
            try {
                item.put("id", id);
                item.put("address", address == null ? "" : address);
                item.put("body", stored);
                item.put("receivedAt", receivedAt);
            } catch (JSONException error) {
                return false;
            }
            queue.put(item);
            while (queue.length() > MAX_QUEUE) queue.remove(0);
            prefs(context).edit().putString(KEY_QUEUE, queue.toString()).commit();
            return true;
        }
    }

    /** Read without removing. The web layer acks ids only after they are saved. */
    static JSONArray peek(Context context) {
        synchronized (BankSmsStore.class) {
            return read(context);
        }
    }

    static void ack(Context context, JSONArray ids) {
        if (ids == null || ids.length() == 0) return;
        Set<String> drop = new HashSet<>();
        for (int i = 0; i < ids.length(); i++) {
            String id = ids.optString(i, "");
            if (!id.isEmpty()) drop.add(id);
        }
        if (drop.isEmpty()) return;
        synchronized (BankSmsStore.class) {
            JSONArray queue = read(context);
            JSONArray keep = new JSONArray();
            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.optJSONObject(i);
                if (item == null) continue;
                if (!drop.contains(item.optString("id"))) keep.put(item);
            }
            prefs(context).edit().putString(KEY_QUEUE, keep.toString()).commit();
        }
    }

    private static JSONArray read(Context context) {
        String raw = prefs(context).getString(KEY_QUEUE, "[]");
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** FNV-1a 64-bit, same wraparound as the TypeScript parser. */
    private static String fnv1a64(String value) {
        long hash = 0xcbf29ce484222325L;
        long prime = 0x100000001b3L;
        for (int i = 0; i < value.length(); i++) {
            hash ^= value.charAt(i);
            hash *= prime;
        }
        return Long.toUnsignedString(hash, 16);
    }
}
