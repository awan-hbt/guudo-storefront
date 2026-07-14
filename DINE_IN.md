# Dine-in QR + always-on Bluetooth print

## Customer QR

1. Open **https://guudo.id/dine-in/qr** and print the page for table tents.
2. Or encode `https://guudo.id/dine-in` with any QR generator.
3. After deploying storefront, scan the QR → pick dishes → enter name → Send Order.

Orders are saved with `order_source = dine_in`, `payment_status = unpaid`, reference `DI-####`. Pay at the counter.

## Tablet (guudo-po Android)

1. Pair the **VSC MP-80M Pro** in Android Bluetooth settings.
2. Rebuild and install the Guudo Admin APK (`npm run build:android` in guudo-po).
3. Open Guudo Admin, **Setup Printer**, select the MP-80M Pro.
4. Enable **Auto-print** — a persistent notification **“Guudo print running”** should appear.
5. When prompted, set battery usage to **Unrestricted** / ignore battery optimization.
6. Leave the tablet plugged in during service. You can leave the app (Home / screen off); printing continues while the notification is present.

### Verify always-on print

1. Submit a test order from a phone at `/dine-in`.
2. Put Guudo Admin in the background or turn the screen off.
3. Within ~10–15s the kitchen slip should print (**DINE-IN** header + customer name).
4. Reboot the tablet: after boot, Guudo Admin / print service should restart if Auto-print was left on; send another test order.
5. Force-stopping the app stops printing (expected). Re-open and leave Auto-print on to restore.

## Staff list

- **guudo-po** admin orders: dine-in rows show a **Dine-in** badge and auto-print like storefront.
- **guudo-admin** Orders: use the **Dine-in** filter.
