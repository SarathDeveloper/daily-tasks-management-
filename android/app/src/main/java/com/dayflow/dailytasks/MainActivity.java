package com.dayflow.dailytasks;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayflowAlarmPlugin.class);
        registerPlugin(BankSmsPlugin.class);
        registerPlugin(DayflowWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
