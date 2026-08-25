import json
import sys
import requests
import uuid
import datetime
import time
import hmac
import hashlib
import base64
import psycopg2

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5298"
DEV_SECRET = "E6CarSpa_Dev_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"
FALLBACK_SECRET = "E6CarSpa_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "E6CarSpaNew",
    "user": "postgres",
    "password": "Gokulakannan750"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def generate_test_jwt(user_id: str, username: str, role: str = "Owner", is_owner: bool = True, permissions: list = None, secret_key: str = DEV_SECRET):
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": user_id,
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": user_id,
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/name": username,
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
        "role": role,
        "isOwner": "true" if is_owner else "false",
        "nbf": now - 10,
        "exp": now + 86400,
        "iat": now - 10,
        "iss": "E6CarSpa",
        "aud": "E6CarSpaDesktop"
    }
    if permissions:
        payload["permission"] = permissions

    h_b64 = b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    p_b64 = b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    message = f"{h_b64}.{p_b64}".encode('utf-8')
    sig = hmac.new(secret_key.encode('utf-8'), message, hashlib.sha256).digest()
    sig_b64 = b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{sig_b64}"

def get_owner_token():
    temp_id = str(uuid.uuid4())
    for secret in [DEV_SECRET, FALLBACK_SECRET]:
        temp_token = generate_test_jwt(temp_id, "admin", role="Owner", is_owner=True, secret_key=secret)
        try:
            r = requests.get(f"{BASE_URL}/api/users", headers={"Authorization": f"Bearer {temp_token}"}, timeout=5)
            if r.status_code == 200:
                users = r.json()
                if users:
                    real_user = next((u for u in users if u.get("role") == "Owner"), users[0])
                    return generate_test_jwt(real_user["id"], real_user["username"], role="Owner", is_owner=True, secret_key=secret), real_user["id"], secret
                return temp_token, temp_id, secret
        except Exception:
            continue
    raise RuntimeError("Could not connect to API server on http://localhost:5298")

def log_test(name, success, msg=""):
    status = "[PASS]" if success else "[FAIL]"
    print(f"{status} {name} {f'- {msg}' if msg else ''}")
    if not success:
        sys.exit(1)

def run_tests():
    print("\n==================================================")
    print("  E6 CAR SPA — STEP 18A AUTOMATIC WHATSAPP INTEGRATION TESTS")
    print("==================================================\n")

    # Backup existing configuration so automated test does not destroy user's real Meta credentials
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "IsEnabled", "PhoneNumberId", "BusinessAccountId", "GraphApiVersion", "AccessTokenEncrypted", "InvoiceNotificationsEnabled", "PaymentCompletedNotificationsEnabled", "InvoiceTemplateName", "InvoiceTemplateLanguage", "PaymentCompletedTemplateName", "PaymentCompletedTemplateLanguage" FROM "WhatsAppConfigurations" WHERE "SingletonKey" = 1;')
    config_backup = cur.fetchone()
    cur.close()
    conn.close()

    try:
        _run_tests_internal(config_backup)
    finally:
        if config_backup:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('''
                UPDATE "WhatsAppConfigurations"
                SET "IsEnabled" = %s, "PhoneNumberId" = %s, "BusinessAccountId" = %s, "GraphApiVersion" = %s,
                    "AccessTokenEncrypted" = %s, "InvoiceNotificationsEnabled" = %s, "PaymentCompletedNotificationsEnabled" = %s,
                    "InvoiceTemplateName" = %s, "InvoiceTemplateLanguage" = %s, "PaymentCompletedTemplateName" = %s,
                    "PaymentCompletedTemplateLanguage" = %s
                WHERE "SingletonKey" = 1;
            ''', config_backup)
            conn.commit()
            cur.close()
            conn.close()
            print("[INFO] Restored previous WhatsApp configuration from database backup.")

def _run_tests_internal(config_backup):
    session = requests.Session()
    owner_token, owner_id, secret_used = get_owner_token()
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # -------------------------------------------------------------
    # 1. WhatsApp Configuration & Token Security (TEST A, B, Y, Z)
    # -------------------------------------------------------------
    print("--- 1. Testing WhatsApp Configuration & Token Security ---")
    raw_dev_token = "EAABtest_token_secret_value_1234567890abcdef"
    
    update_res = session.put(f"{BASE_URL}/api/settings/whatsapp", json={
        "isEnabled": True,
        "phoneNumberId": "1263387163523264",
        "businessAccountId": "1046927407924057",
        "graphApiVersion": "v25.0",
        "accessToken": raw_dev_token,
        "invoiceNotificationsEnabled": True,
        "paymentCompletedNotificationsEnabled": True,
        "invoiceTemplateName": "e6_carspa_invoice_generated",
        "invoiceTemplateLanguage": "en_US",
        "paymentCompletedTemplateName": "e6_carspa_payment_completed",
        "paymentCompletedTemplateLanguage": "en_US"
    }, headers=owner_headers)
    log_test("TEST A: WhatsApp configuration can be saved (200 OK)", update_res.status_code == 200)
    config_data = update_res.json()

    # TEST B & Z: Access token is NOT returned in API responses
    log_test("TEST B.1: Response has hasAccessToken == true", config_data.get("hasAccessToken") is True)
    log_test("TEST B.2: Raw access token is NOT in PUT response", "accessToken" not in config_data and raw_dev_token not in json.dumps(config_data))

    get_res = session.get(f"{BASE_URL}/api/settings/whatsapp", headers=owner_headers)
    log_test("GET /api/settings/whatsapp returns 200 OK", get_res.status_code == 200)
    get_config = get_res.json()
    log_test("TEST Z: Access token is NOT in GET response", "accessToken" not in get_config and raw_dev_token not in json.dumps(get_config))

    # Verify at rest encryption in database
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "AccessTokenEncrypted", "PhoneNumberId", "BusinessAccountId" FROM "WhatsAppConfigurations";')
    row = cur.fetchone()
    log_test("DB Verification: WhatsAppConfigurations row exists", row is not None)
    db_encrypted_token, db_phone_id, db_waba_id = row
    log_test("TEST B.3: DB AccessTokenEncrypted is NOT plaintext", db_encrypted_token != raw_dev_token and len(db_encrypted_token) > 20)
    log_test("DB Verification: Phone and WABA IDs match", db_phone_id == "1263387163523264" and db_waba_id == "1046927407924057")
    cur.close()
    conn.close()

    # -------------------------------------------------------------
    # 2. Connection Testing (TEST C, D)
    # -------------------------------------------------------------
    print("\n--- 2. Testing WhatsApp Connection Endpoint ---")
    test_res_bad = session.post(f"{BASE_URL}/api/settings/whatsapp/test", json={
        "phoneNumberId": "invalid_phone_id_999",
        "accessToken": "invalid_access_token_xyz"
    }, headers=owner_headers)
    log_test("TEST D: Invalid credentials handled gracefully (200 OK with isSuccess=false)", test_res_bad.status_code == 200)
    test_data_bad = test_res_bad.json()
    log_test("TEST D.2: Connection response has isSuccess == false", test_data_bad.get("isSuccess") is False and "failed" in test_data_bad.get("message", "").lower())

    # -------------------------------------------------------------
    # 3. Customer, Vehicle, Service, Job Card Setup
    # -------------------------------------------------------------
    print("\n--- 3. Setting up Test Fixtures ---")
    suffix = uuid.uuid4().hex[:6]
    rand_digits = f"{int(time.time() * 1000) % 1000000:06d}"
    phone_raw = f"+91 9876{rand_digits}"
    expected_normalized = f"919876{rand_digits}"

    cust_res = session.post(f"{BASE_URL}/api/customers", json={
        "name": f"Gokul Tester {suffix}",
        "phoneNumber": phone_raw, # Formatted Indian number with spaces and +91
        "email": f"tester_{suffix}@e6carspa.com",
        "address": "Perundurai Road, Erode"
    }, headers=owner_headers)
    log_test("Setup: Create Customer with +91 format", cust_res.status_code in (200, 201), cust_res.text if cust_res.status_code not in (200, 201) else "")
    customer = cust_res.json()
    customer_id = customer["id"]

    veh_res = session.post(f"{BASE_URL}/api/vehicles", json={
        "customerId": customer_id,
        "registrationNumber": f"TN33WA{suffix[:4].upper()}",
        "make": "BMW",
        "model": "330i",
        "color": "Portimao Blue"
    }, headers=owner_headers)
    log_test("Setup: Create Vehicle", veh_res.status_code in (200, 201))
    vehicle = veh_res.json()
    vehicle_id = vehicle["id"]

    serv_res = session.post(f"{BASE_URL}/api/services", json={
        "name": f"Deep Interior Spa {suffix}",
        "category": "Detailing",
        "price": 5000.0,
        "taxPercentage": 18.0,
        "durationMinutes": 120
    }, headers=owner_headers)
    log_test("Setup: Create Service", serv_res.status_code in (200, 201))
    service = serv_res.json()

    jc_res = session.post(f"{BASE_URL}/api/job-cards", json={
        "customerId": customer_id,
        "vehicleId": vehicle_id,
        "services": [{"serviceId": service["id"], "quantity": 2, "discountAmount": 0.0}],
        "isGstEnabled": True
    }, headers=owner_headers)
    log_test("Setup: Create Job Card", jc_res.status_code in (200, 201))
    job_card = jc_res.json()

    draft_inv_res = session.post(f"{BASE_URL}/api/invoices/from-job-card/{job_card['id']}", headers=owner_headers)
    log_test("Setup: Create Draft Invoice", draft_inv_res.status_code in (200, 201))
    draft_invoice = draft_inv_res.json()
    invoice_id = draft_invoice["id"]

    # TEST G: Draft invoice has NO WhatsApp message created
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT count(*) FROM "WhatsAppMessages" WHERE "InvoiceId" = %s;', (invoice_id,))
    draft_msg_count = cur.fetchone()[0]
    log_test("TEST G: Draft invoice does NOT have any WhatsApp messages queued", draft_msg_count == 0)
    cur.close()
    conn.close()

    # -------------------------------------------------------------
    # 4. Invoice Finalization Trigger (TEST E, F, H, I, J, K)
    # -------------------------------------------------------------
    print("\n--- 4. Testing Invoice Finalization Trigger (Event 1) ---")
    gen_res = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/generate", headers=owner_headers)
    log_test("TEST F: Invoice finalization succeeds (200 OK)", gen_res.status_code == 200, f"Status: {gen_res.status_code}, Body: {gen_res.text}")
    finalized_inv = gen_res.json()
    invoice_number = finalized_inv["invoiceNumber"]

    time.sleep(0.5)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "Id", "MessageType", "RecipientPhone", "Status", "TemplateParametersJson" FROM "WhatsAppMessages" WHERE "InvoiceId" = %s AND "MessageType" = 0;', (invoice_id,))
    finalized_msgs = cur.fetchall()
    log_test("TEST E: Exactly one INVOICE_FINALIZED message was queued", len(finalized_msgs) == 1)

    msg_id, msg_type, recipient_phone, msg_status, params_json = finalized_msgs[0]
    log_test(f"TEST Phone Normalization: '{phone_raw}' normalized to '{expected_normalized}'", recipient_phone == expected_normalized)
    
    params = json.loads(params_json)
    log_test("TEST H: Message contains customer name", params.get("customerName") == customer["name"])
    log_test("TEST I: Message contains correct invoice number", params.get("invoiceNumber") == invoice_number)
    log_test("TEST J: Message contains formatted amount", "11,800.00" in params.get("totalAmount", "") or "11800" in params.get("totalAmount", ""))
    log_test("TEST K: Message contains secure public invoice URL", "/i/" in params.get("publicUrl", "") or "/invoices" in params.get("publicUrl", ""))
    cur.close()
    conn.close()

    # -------------------------------------------------------------
    # 5. Idempotency on Repeated Finalization (TEST P)
    # -------------------------------------------------------------
    print("\n--- 5. Testing Invoice Finalization Idempotency ---")
    # Repeated call to generate or queue notification
    repeat_gen = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/generate", headers=owner_headers)
    log_test("Repeated generate call handled cleanly", repeat_gen.status_code in (200, 400, 409))

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT count(*) FROM "WhatsAppMessages" WHERE "InvoiceId" = %s AND "MessageType" = 0;', (invoice_id,))
    count_after_repeat = cur.fetchone()[0]
    log_test("TEST P: Database enforces exactly ONE INVOICE_FINALIZED message per invoice", count_after_repeat == 1)
    cur.close()
    conn.close()

    # -------------------------------------------------------------
    # 6. Payment Transition Trigger (TEST L, M, N, O)
    # -------------------------------------------------------------
    print("\n--- 6. Testing Payment Triggers (Event 2) ---")
    # Partial payment 1: Pay 5,000 out of 11,800 (Balance = 6,800 > 0)
    pay1_res = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", json={
        "amount": 5000.0,
        "paymentMethod": "UPI",
        "reference": "UPI_PARTIAL_1",
        "paymentDate": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }, headers=owner_headers)
    log_test("Record partial payment 1 (INR 5,000)", pay1_res.status_code == 200)

    time.sleep(0.5)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT count(*) FROM "WhatsAppMessages" WHERE "InvoiceId" = %s AND "MessageType" = 1;', (invoice_id,))
    paid_msgs_count = cur.fetchone()[0]
    log_test("TEST L: Partial payment leaving balance > 0 does NOT create PAYMENT_COMPLETED message", paid_msgs_count == 0)
    cur.close()
    conn.close()

    # Final payment 2: Pay remaining 6,800 (Balance becomes 0 -> Paid status)
    pay2_res = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", json={
        "amount": 6800.0,
        "paymentMethod": "Cash",
        "reference": "CASH_FINAL_2",
        "paymentDate": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }, headers=owner_headers)
    log_test("Record remaining payment 2 (INR 6,800)", pay2_res.status_code == 200)

    time.sleep(0.5)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "Id", "RecipientPhone", "Status", "TemplateParametersJson" FROM "WhatsAppMessages" WHERE "InvoiceId" = %s AND "MessageType" = 1;', (invoice_id,))
    paid_msgs = cur.fetchall()
    log_test("TEST M: Transition to Paid creates PAYMENT_COMPLETED message", len(paid_msgs) == 1)

    _, pay_phone, _, pay_params_json = paid_msgs[0]
    pay_params = json.loads(pay_params_json)
    log_test("TEST N.1: Payment completed message contains customer name", pay_params.get("customerName") == customer["name"])
    log_test("TEST N.2: Message contains invoice number", pay_params.get("invoiceNumber") == invoice_number)
    log_test("TEST N.3: Message contains triggering payment received (6,800)", "6,800.00" in pay_params.get("paymentReceived", "") or "6800" in pay_params.get("paymentReceived", ""))
    log_test("TEST N.4: Message contains total paid (11,800)", "11,800.00" in pay_params.get("totalPaid", "") or "11800" in pay_params.get("totalPaid", ""))
    log_test("TEST N.5: Message contains Balance 0.00", pay_params.get("balance") in ("0.00", "0"))
    log_test("TEST N.6: Message contains public URL link", bool(pay_params.get("publicUrl")))
    cur.close()
    conn.close()

    # TEST O: Further payment on already Paid invoice rejected / cannot create duplicate notification
    print("\n--- 7. Testing Paid Transition Idempotency ---")
    pay3_res = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", json={
        "amount": 100.0,
        "paymentMethod": "Cash",
        "paymentDate": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }, headers=owner_headers)
    log_test("Payment exceeding balance is rejected by business rule", pay3_res.status_code in (400, 409))

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT count(*) FROM "WhatsAppMessages" WHERE "InvoiceId" = %s AND "MessageType" = 1;', (invoice_id,))
    total_paid_msgs = cur.fetchone()[0]
    log_test("TEST O: Exactly ONE PAYMENT_COMPLETED notification exists (no duplicate)", total_paid_msgs == 1)
    cur.close()
    conn.close()

    # -------------------------------------------------------------
    # 8. Transaction Safety & Graceful Failure (TEST Q, R, S, T)
    # -------------------------------------------------------------
    print("\n--- 8. Testing Transaction Isolation & Invalid Phone Handling ---")
    # Create customer with INVALID phone number
    rand_short = f"{int(time.time() * 1000) % 1000:03d}"
    inv_cust_res = session.post(f"{BASE_URL}/api/customers", json={
        "name": f"Invalid Phone User {suffix}",
        "phoneNumber": f"12{rand_short}", # Invalid short phone (5 digits < 10)
        "email": f"badphone_{suffix}@test.com"
    }, headers=owner_headers)
    log_test("Setup: Create customer with invalid phone", inv_cust_res.status_code in (200, 201))
    inv_cust = inv_cust_res.json()

    inv_veh_res = session.post(f"{BASE_URL}/api/vehicles", json={
        "customerId": inv_cust["id"],
        "registrationNumber": f"TN33BAD{suffix[:4].upper()}",
        "make": "Maruti",
        "model": "Swift"
    }, headers=owner_headers)
    inv_veh = inv_veh_res.json()

    inv_jc_res = session.post(f"{BASE_URL}/api/job-cards", json={
        "customerId": inv_cust["id"],
        "vehicleId": inv_veh["id"],
        "services": [{"serviceId": service["id"], "quantity": 1, "discountAmount": 0.0}]
    }, headers=owner_headers)
    inv_jc = inv_jc_res.json()

    inv_draft_res = session.post(f"{BASE_URL}/api/invoices/from-job-card/{inv_jc['id']}", headers=owner_headers)
    inv_draft = inv_draft_res.json()
    bad_inv_id = inv_draft["id"]

    # Finalize invoice with invalid customer phone
    bad_gen_res = session.post(f"{BASE_URL}/api/invoices/{bad_inv_id}/generate", headers=owner_headers)
    log_test("TEST Q & S: Invoice finalization succeeds even with invalid customer phone (200 OK)", bad_gen_res.status_code == 200)

    time.sleep(0.5)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "Status", "ErrorMessage" FROM "WhatsAppMessages" WHERE "InvoiceId" = %s AND "MessageType" = 0;', (bad_inv_id,))
    bad_phone_row = cur.fetchone()
    log_test("TEST S.1: WhatsApp message row created for invalid phone", bad_phone_row is not None)
    log_test("TEST S.2: WhatsApp message Status is Skipped (Status=3)", bad_phone_row[0] == 3)
    log_test("TEST S.3: ErrorMessage indicates invalid phone", "invalid" in bad_phone_row[1].lower() or "unavailable" in bad_phone_row[1].lower())
    cur.close()
    conn.close()

    # Pay full invoice with invalid phone
    bad_pay_res = session.post(f"{BASE_URL}/api/invoices/{bad_inv_id}/payments", json={
        "amount": 5900.0,
        "paymentMethod": "Cash",
        "paymentDate": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }, headers=owner_headers)
    log_test("TEST R & S: Payment recording succeeds even with invalid customer phone (200 OK)", bad_pay_res.status_code == 200)

    time.sleep(0.5)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "Status", "ErrorMessage" FROM "WhatsAppMessages" WHERE "InvoiceId" = %s AND "MessageType" = 1;', (bad_inv_id,))
    bad_pay_row = cur.fetchone()
    log_test("TEST S.4: Payment WhatsApp message Status is Skipped (Status=3)", bad_pay_row is not None and bad_pay_row[0] == 3)
    cur.close()
    conn.close()

    # -------------------------------------------------------------
    # 9. WhatsApp Status Endpoint & UI Safety (TEST AA)
    # -------------------------------------------------------------
    print("\n--- 9. Testing WhatsApp Invoice Status API & No Manual Send Button ---")
    status_res = session.get(f"{BASE_URL}/api/invoices/{invoice_id}/whatsapp-status", headers=owner_headers)
    log_test("GET /api/invoices/{id}/whatsapp-status returns 200 OK", status_res.status_code == 200)
    status_list = status_res.json()
    log_test("Status list returns both InvoiceFinalized and PaymentCompleted statuses", len(status_list) >= 2)
    log_test("TEST AA: No manual send endpoint exists (POST /api/invoices/{id}/whatsapp-send is 404/405)", session.post(f"{BASE_URL}/api/invoices/{invoice_id}/whatsapp-send", headers=owner_headers).status_code in (404, 405))

    # -------------------------------------------------------------
    # 10. Audit Trail Security (TEST W, X, Y)
    # -------------------------------------------------------------
    print("\n--- 10. Testing Audit Trail Security ---")
    audit_res = session.get(f"{BASE_URL}/api/audit-logs", headers=owner_headers)
    log_test("Query audit logs (200 OK)", audit_res.status_code == 200)
    audit_items = audit_res.json()["items"]

    config_audits = [a for a in audit_items if a["action"] == "WHATSAPP_CONFIG_UPDATED"]
    log_test("TEST W.1: Audit log recorded for WHATSAPP_CONFIG_UPDATED", len(config_audits) > 0)

    # TEST Y: Check that access token never appears in any audit log text
    all_audit_text = json.dumps(audit_items)
    log_test("TEST Y: Raw access token NEVER appears in any audit log", raw_dev_token not in all_audit_text)

    print("\n==================================================")
    print("  ALL STEP 18A AUTOMATED TESTS PASSED (100%)!")
    print("==================================================\n")

if __name__ == "__main__":
    run_tests()
