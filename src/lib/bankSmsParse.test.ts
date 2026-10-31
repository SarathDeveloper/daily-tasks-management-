import { describe, expect, it } from 'vitest';
import { nowTimeString, todayString } from './ledger';
import { parseBankSms, smsFingerprint, type RawBankSms } from './bankSmsParse';

const at = Date.parse('2026-10-31T09:15:00+05:30');

function sms(body: string, address = 'VK-HDFCBK'): RawBankSms {
  return { address, body, receivedAt: at };
}

describe('parseBankSms', () => {
  it('reads a debit and ignores the available balance', () => {
    const parsed = parseBankSms(
      sms('INR 1,250.00 debited from A/c **1234 on 31-10-26 to SWIGGY. Avl Bal INR 8,432.10')
    );
    expect(parsed).toMatchObject({
      type: 'expense',
      amount: 1250,
      date: '2026-10-31',
      lastFour: '1234',
      merchant: 'SWIGGY',
      paymentMethod: 'bank_transfer',
    });
  });

  it('reads a credit with a named month', () => {
    const parsed = parseBankSms(
      sms('Your a/c XX5678 is credited with Rs.5000.00 on 31-Oct-26. Avl Bal Rs.12000.00', 'AD-SBIINB')
    );
    expect(parsed).toMatchObject({
      type: 'income',
      amount: 5000,
      date: '2026-10-31',
      lastFour: '5678',
      paymentMethod: 'bank_transfer',
    });
  });

  it('reads a GPay UPI debit', () => {
    const parsed = parseBankSms(
      sms('Sent Rs.200.00 from HDFC Bank A/c XX1234 to merchant@okaxis via GPay on 31-10-26')
    );
    expect(parsed).toMatchObject({
      type: 'expense',
      amount: 200,
      lastFour: '1234',
      merchant: 'merchant@okaxis',
      paymentMethod: 'gpay',
      date: '2026-10-31',
    });
  });

  it('reads a PhonePe debit', () => {
    const parsed = parseBankSms(sms('Rs.75.00 debited from A/c **4321 for PhonePe payment to STORE'));
    expect(parsed).toMatchObject({
      type: 'expense',
      amount: 75,
      lastFour: '4321',
      merchant: 'STORE',
      paymentMethod: 'phonepe',
    });
  });

  it('reads a card spend at a merchant', () => {
    const parsed = parseBankSms(
      sms('INR 250.00 spent using ICICI Bank Card XX1234 on 31-Oct-26 at SWIGGY. Avl Lmt INR 10000.00')
    );
    expect(parsed).toMatchObject({
      type: 'expense',
      amount: 250,
      lastFour: '1234',
      merchant: 'SWIGGY',
      date: '2026-10-31',
      paymentMethod: 'bank_transfer',
    });
  });

  it('reads a UPI payment that says paid instead of debited', () => {
    const parsed = parseBankSms(sms('You paid ₹80 to CAFE on 31-10-26'));
    expect(parsed).toMatchObject({
      type: 'expense',
      amount: 80,
      merchant: 'CAFE',
      date: '2026-10-31',
      paymentMethod: 'bank_transfer',
    });
    expect(
      parseBankSms(sms('Payment of Rs.250 to SWIGGY on 31-10-26. Ref 123456'))
    ).toMatchObject({
      type: 'expense',
      amount: 250,
      merchant: 'SWIGGY',
    });
  });

  it('drops bill reminders and prepaid notices that are not spends', () => {
    expect(parseBankSms(sms('Payment of Rs.500 is due on 05-11-26. Please pay.'))).toBeNull();
    expect(parseBankSms(sms('INR 500.00 will be debited from A/c XX1234 on 05-11-26'))).toBeNull();
    expect(parseBankSms(sms('Your prepaid plan costs Rs.199. Recharge now.'))).toBeNull();
  });

  it('drops OTP messages and ordinary chats', () => {
    expect(parseBankSms(sms('123456 is your OTP for txn. Do not share it with anyone.'))).toBeNull();
    expect(parseBankSms(sms('Your one time password is 998877. Do not share.'))).toBeNull();
    expect(parseBankSms(sms('Hey, can you send the report tonight?'))).toBeNull();
  });

  it('uses the SMS timestamp when the text has no date', () => {
    const parsed = parseBankSms(sms('Rs.40.00 debited from A/c XX9999 to CAFE'));
    const received = new Date(at);
    expect(parsed?.date).toBe(todayString(received));
    expect(parsed?.time).toBe(nowTimeString(received));
  });

  it('keeps a stable fingerprint for the same text', () => {
    const body = 'INR 10.00 debited from A/c **1234';
    expect(smsFingerprint(' VK-HDFCBK ', body)).toBe(smsFingerprint('vk-hdfcbk', body));
    expect(smsFingerprint('VK-HDFCBK', body)).toMatch(/^sms:[0-9a-f]+$/);
  });
});
