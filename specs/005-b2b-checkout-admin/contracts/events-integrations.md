# Events and Integration Contract

## Transactional domain fact

Successful finalization writes one `order.created` version-1 event in the same transaction as Order, lines, snapshots, quote consumption, and idempotency completion.

Trusted payload:

```json
{
  "eventId": "uuid",
  "eventType": "order.created",
  "eventVersion": 1,
  "occurredAt": "ISO-8601",
  "correlationId": "uuid",
  "orderId": "uuid",
  "orderNumber": "KF-ABC123-260913",
  "commerceSnapshotVersion": 1
}
```

The event contains references, not guest secrets or protected pricing trace. Feature 009 may later consume these facts; Feature 005 does not implement a general subscription or automation engine.

## Post-commit adapters

| Adapter | Authority and retry rule |
|---|---|
| COD | Uses the committed Order result; no external payment call. |
| Kashier | Order ID/reference and amount come from committed authoritative snapshots. Same idempotent retry resumes/regenerates the same Order checkout, never another Order. Webhook remains signature-verified and updates payment outcome only. |
| Notifications/Telegram | Run after commit from Order snapshot. Failure is logged with correlation/order ID and does not roll back the Order; retry uses stable Order/event identity. |
| Meta/analytics | Successful purchase is emitted only after committed Order creation. Quote views, validation, and reconfirmation do not emit purchase. Duplicate submission replay does not emit another purchase. |
| Bosta/Mylerz | Existing manual/operational shipment flows continue to read immutable Order snapshots. No automatic live shipment is created by checkout or automated tests. |

Provider-specific errors never expose credentials or raw provider payloads to Customers.

## Test isolation

- Normal automated tests mock all adapter entry points and network calls.
- Kashier uses a controlled test configuration; no real charge.
- Bosta/Mylerz use mock/sandbox calls only; no live shipment or pickup.
- Notifications and Telegram capture payloads locally; no real send.
- Meta and analytics assertions verify event timing/deduplication without sending production events.
- External sandbox results are reported separately from automated and manual acceptance.
