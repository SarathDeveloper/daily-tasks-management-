package com.dayflow.dailytasks;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayflowAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
