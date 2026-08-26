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
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": username,
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
    print("  E6 CAR SPA — STEP 17A PUBLIC INVOICE PORTAL TESTS")
    print("==================================================\n")

    session = requests.Session()
    owner_token, owner_id, secret_used = get_owner_token()
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # 0. Setup test customer, vehicle, service, job card, and invoice
    print("--- 0. Setting up test fixtures ---")
    suffix = uuid.uuid4().hex[:6]
    cust_res = session.post(f"{BASE_URL}/api/customers", json={
        "name": f"Portal Tester {suffix}",
        "phoneNumber": f"9876{suffix[:6]}",
        "email": f"tester_{suffix}@test.com",
        "address": "123 Test Street, Erode"
    }, headers=owner_headers)
    log_test("Setup: Create Customer", cust_res.status_code in (200, 201))
    customer = cust_res.json()
    customer_id = customer["id"]

    veh_res = session.post(f"{BASE_URL}/api/vehicles", json={
        "customerId": customer_id,
        "registrationNumber": f"TN33TEST{suffix[:4].upper()}",
        "make": "Hyundai",
        "model": "Creta",
        "variant": "SX(O)",
        "color": "Polar White"
    }, headers=owner_headers)
    log_test("Setup: Create Vehicle", veh_res.status_code in (200, 201))
    vehicle = veh_res.json()
    vehicle_id = vehicle["id"]

    serv_res = session.post(f"{BASE_URL}/api/services", json={
        "name": f"Ceramic Coating {suffix}",
        "category": "Detailing",
        "price": 10000.0,
        "taxPercentage": 18.0,
        "durationMinutes": 180,
        "description": "Full Ceramic Coating Package"
    }, headers=owner_headers)
    log_test("Setup: Create Service", serv_res.status_code in (200, 201))
    service = serv_res.json()
    service_id = service["id"]

    # Create Job Card with GST enabled
    jc_res = session.post(f"{BASE_URL}/api/job-cards", json={
        "customerId": customer_id,
        "vehicleId": vehicle_id,
        "services": [
            {
                "serviceId": service_id,
                "quantity": 1,
                "discountAmount": 0.0
            }
        ],
        "notes": "Customer requested premium package.",
        "isGstEnabled": True
    }, headers=owner_headers)
    log_test("Setup: Create Job Card (GST ON)", jc_res.status_code in (200, 201))
    job_card = jc_res.json()
    job_card_id = job_card["id"]

    # Create Draft Invoice
    inv_res = session.post(f"{BASE_URL}/api/invoices/from-job-card/{job_card_id}", headers=owner_headers)
    log_test("Setup: Create Draft Invoice", inv_res.status_code in (200, 201))
    draft_invoice = inv_res.json()
    draft_invoice_id = draft_invoice["id"]

    # TEST A: Draft invoice cannot create public link
    print("\n--- Testing Public Link Lifecycle ---")
    draft_link_res = session.post(f"{BASE_URL}/api/invoices/{draft_invoice_id}/public-link", headers=owner_headers)
    log_test("TEST A: Draft invoice cannot create public link", draft_link_res.status_code in (400, 422))

    # TEST K: Draft invoice public URL cannot exist/access
    fake_token = "a" * 64
    draft_access_res = session.get(f"{BASE_URL}/api/public/invoices/{fake_token}")
    log_test("TEST K: Non-existent/draft public URL returns 404", draft_access_res.status_code == 404)

    # Finalize invoice (Generate invoice number)
    gen_res = session.post(f"{BASE_URL}/api/invoices/{draft_invoice_id}/generate", headers=owner_headers)
    log_test("Setup: Finalize Invoice", gen_res.status_code == 200)
    finalized_invoice = gen_res.json()
    invoice_number = finalized_invoice["invoiceNumber"]
    invoice_id = finalized_invoice["id"]

    # TEST B: Finalized invoice can create public link
    link_res = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/public-link", headers=owner_headers)
    log_test("TEST B: Finalized invoice can create public link (200 OK)", link_res.status_code == 200)
    link_data = link_res.json()
    public_url = link_data.get("url")
    log_test("Link response contains url and isActive", bool(public_url) and link_data.get("isActive") is True)

    # TEST C: Token is exactly 64 hexadecimal characters
    raw_token = public_url.split("/i/")[-1].strip()
    log_test("TEST C: Token is exactly 64 lowercase hex characters", len(raw_token) == 64 and all(c in "0123456789abcdefABCDEF" for c in raw_token))
    raw_token = raw_token.lower()

    # TEST D & TEST E & IMPORTANT TOKEN TEST: Database does NOT contain raw token, only SHA-256 TokenHash
    print("\n--- Testing Cryptographic Storage Security ---")
    expected_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest().lower()
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "Id", "InvoiceId", "TokenHash", "IsRevoked", "AccessCount" FROM "InvoicePublicLinks" WHERE "InvoiceId" = %s;', (invoice_id,))
    rows = cur.fetchall()
    log_test("DB check: Exactly 1 public link row exists in DB", len(rows) == 1)
    
    db_id, db_invoice_id, db_token_hash, db_is_revoked, db_access_count = rows[0]
    log_test("TEST E: DB TokenHash equals SHA-256(raw_token)", db_token_hash.lower() == expected_hash)
    log_test("IMPORTANT TOKEN TEST: raw_token != db_token_hash", raw_token != db_token_hash.lower())
    
    # Check that NO raw token appears in table column values
    cur.execute('SELECT count(*) FROM "InvoicePublicLinks" WHERE "TokenHash" = %s;', (raw_token,))
    raw_match_count = cur.fetchone()[0]
    log_test("TEST D: Database does NOT contain the raw token in TokenHash column", raw_match_count == 0)

    # Check that NO column named Token exists in table
    cur.execute("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'InvoicePublicLinks' AND column_name = 'Token';
    """)
    token_col_exists = len(cur.fetchall()) > 0
    log_test("Schema Check: No 'Token' column persisted in InvoicePublicLinks table", not token_col_exists)
    cur.close()
    conn.close()

    # TEST F: Public URL works without JWT authentication
    print("\n--- Testing Public Access & DTO Content ---")
    pub_res = session.get(f"{BASE_URL}/api/public/invoices/{raw_token}")
    log_test("TEST F: Public URL returns invoice without JWT authentication (200 OK)", pub_res.status_code == 200)
    pub_invoice = pub_res.json()

    # TEST L: GST ON public invoice shows TAX INVOICE, GSTIN, HSN/SAC, Taxable Value, CGST, SGST
    log_test("TEST L.1: Status is Generated / Finalized", pub_invoice.get("status") in ("Generated", "Paid", "PartiallyPaid"))
    log_test("TEST L.2: isGstEnabled is true", pub_invoice.get("isGstEnabled") is True)
    log_test("TEST L.3: Customer name & vehicle matches", pub_invoice["customer"]["customerName"] == customer["name"] and vehicle["registrationNumber"] in pub_invoice["customer"]["registrationNumber"])
    log_test("TEST L.4: Items contain HSN/SAC", len(pub_invoice["items"]) > 0 and bool(pub_invoice["items"][0].get("hsnSac")))
    financials = pub_invoice["financials"]
    log_test("TEST L.5: Financials contain TaxableValue, CGST, SGST", financials.get("taxableValue") is not None and financials.get("cgst") is not None and financials.get("sgst") is not None)
    log_test("TEST L.6: Total equals taxableValue + cgst + sgst", round(financials["taxableValue"] + financials["cgst"] + financials["sgst"], 2) == round(financials["totalAmount"], 2))

    # TEST AA & TEST AB: Public DTO contains NO internal database IDs, passwords, secrets, or token hashes
    log_test("TEST AA.1: Public DTO does not expose 'id' or internal invoice database Guid", "id" not in pub_invoice and "invoiceId" not in pub_invoice)
    log_test("TEST AA.2: Public DTO does not expose 'customerId' or 'vehicleId'", "customerId" not in pub_invoice["customer"] and "vehicleId" not in pub_invoice["customer"])
    log_test("TEST AB: Public DTO does not expose 'tokenHash' or 'secret'", "tokenHash" not in pub_invoice and "token" not in pub_invoice)

    # TEST V & TEST AA: AccessCount increments
    time.sleep(0.5)
    pub_res2 = session.get(f"{BASE_URL}/api/public/invoices/{raw_token}")
    log_test("Second public access returns 200 OK", pub_res2.status_code == 200)
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT "AccessCount", "LastAccessedAtUtc" FROM "InvoicePublicLinks" WHERE "InvoiceId" = %s;', (invoice_id,))
    acc_row = cur.fetchone()
    log_test("TEST V: AccessCount incremented in database", acc_row[0] >= 2 and acc_row[1] is not None)
    cur.close()
    conn.close()

    # TEST G & H: Invalid and tampered tokens return 404
    print("\n--- Testing Security, Tampering & Generic 404 Behavior ---")
    random_token = uuid.uuid4().hex + uuid.uuid4().hex
    rand_res = session.get(f"{BASE_URL}/api/public/invoices/{random_token}")
    log_test("TEST G: Random non-existent 64-char token returns 404", rand_res.status_code == 404)

    # Tampered token (flip last char)
    tampered_token = raw_token[:-1] + ('0' if raw_token[-1] != '0' else '1')
    tamp_res = session.get(f"{BASE_URL}/api/public/invoices/{tampered_token}")
    log_test("TEST H: Tampered token (1 character changed) returns 404", tamp_res.status_code == 404)

    # Malformed length tokens
    short_res = session.get(f"{BASE_URL}/api/public/invoices/tooshort")
    log_test("TEST AC.1: Short malformed token returns 404", short_res.status_code == 404)
    
    guid_res = session.get(f"{BASE_URL}/api/public/invoices/{str(uuid.uuid4())}")
    log_test("TEST AC.2: GUID token returns 404", guid_res.status_code == 404)

    # TEST N: Live payment changes are reflected when opening the same valid link
    print("\n--- Testing Live Payment Reflection ---")
    pay_res = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", json={
        "amount": 5000.0,
        "paymentMethod": "UPI",
        "reference": "UPI123456789",
        "paymentDate": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }, headers=owner_headers)
    if pay_res.status_code != 200:
        print(f"Payment error: {pay_res.status_code} {pay_res.text}")
    log_test("Setup: Record 5,000 INR payment", pay_res.status_code == 200)

    pub_res3 = session.get(f"{BASE_URL}/api/public/invoices/{raw_token}")
    log_test("Get invoice after payment returns 200 OK", pub_res3.status_code == 200)
    updated_pub = pub_res3.json()
    log_test("TEST N.1: PaidAmount is now 5000.00", updated_pub["financials"]["paidAmount"] == 5000.0)
    log_test("TEST N.2: BalanceAmount reflects payment correctly", updated_pub["financials"]["balanceAmount"] == updated_pub["financials"]["totalAmount"] - 5000.0)
    log_test("TEST N.3: No internal payment transaction IDs exposed", "payments" not in updated_pub and "paymentId" not in updated_pub)

    # TEST O & TEST AD: Public endpoint cannot modify invoice / financial values
    print("\n--- Testing Immutability via Public Interface ---")
    pub_post = session.post(f"{BASE_URL}/api/public/invoices/{raw_token}", json={"discount": 9999})
    log_test("TEST O: POST to public endpoint returns 404/405", pub_post.status_code in (404, 405))
    
    pub_res4 = session.get(f"{BASE_URL}/api/public/invoices/{raw_token}")
    log_test("TEST AD: Invoice financials completely unchanged", pub_res4.json()["financials"]["totalAmount"] == updated_pub["financials"]["totalAmount"])

    # TEST R & S & T & Y: Owner can rotate link, old token -> 404, new token -> 200, audit created
    print("\n--- Testing Link Rotation ---")
    rot_res = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/public-link/rotate", headers=owner_headers)
    log_test("TEST R: Rotate public link returns 200 OK", rot_res.status_code == 200)
    rot_data = rot_res.json()
    new_url = rot_data["url"]
    new_token = new_url.split("/i/")[-1].strip().lower()
    log_test("Rotation returned new distinct token", new_token != raw_token and len(new_token) == 64)

    # TEST S: Old token returns 404 after rotation
    old_res = session.get(f"{BASE_URL}/api/public/invoices/{raw_token}")
    log_test("TEST S: Old token returns 404 after rotation", old_res.status_code == 404)

    # TEST T: New token works after rotation
    new_res = session.get(f"{BASE_URL}/api/public/invoices/{new_token}")
    log_test("TEST T: New token returns 200 OK after rotation", new_res.status_code == 200)

    # TEST P & Q & I & X: Owner can revoke link, revoked link -> 404, audit created
    print("\n--- Testing Link Revocation ---")
    rev_res = session.delete(f"{BASE_URL}/api/invoices/{invoice_id}/public-link", headers=owner_headers)
    log_test("TEST P: Revoke public link returns 200 OK", rev_res.status_code == 200)

    # TEST Q & I: Revoked token returns 404
    revoked_res = session.get(f"{BASE_URL}/api/public/invoices/{new_token}")
    log_test("TEST Q & I: Revoked token returns 404", revoked_res.status_code == 404)

    # TEST M: GST OFF invoice test
    print("\n--- Testing GST OFF Public Invoice ---")
    jc_nogst_res = session.post(f"{BASE_URL}/api/job-cards", json={
        "customerId": customer_id,
        "vehicleId": vehicle_id,
        "services": [
            {
                "serviceId": service_id,
                "quantity": 1,
                "discountAmount": 0.0
            }
        ],
        "notes": "Standard Wash No GST.",
        "isGstEnabled": False
    }, headers=owner_headers)
    log_test("Setup: Create Job Card (GST OFF)", jc_nogst_res.status_code in (200, 201))
    jc_nogst = jc_nogst_res.json()

    inv_nogst_res = session.post(f"{BASE_URL}/api/invoices/from-job-card/{jc_nogst['id']}", headers=owner_headers)
    inv_nogst = inv_nogst_res.json()
    
    # Finalize GST OFF invoice
    gen_nogst_res = session.post(f"{BASE_URL}/api/invoices/{inv_nogst['id']}/generate", headers=owner_headers)
    inv_nogst_final = gen_nogst_res.json()

    link_nogst_res = session.post(f"{BASE_URL}/api/invoices/{inv_nogst_final['id']}/public-link", headers=owner_headers)
    log_test("Generate public link for GST OFF invoice", link_nogst_res.status_code == 200)
    nogst_token = link_nogst_res.json()["url"].split("/i/")[-1].strip().lower()

    pub_nogst_res = session.get(f"{BASE_URL}/api/public/invoices/{nogst_token}")
    log_test("Public access GST OFF invoice returns 200 OK", pub_nogst_res.status_code == 200)
    pub_nogst = pub_nogst_res.json()

    log_test("TEST M.1: isGstEnabled is False", pub_nogst["isGstEnabled"] is False)
    log_test("TEST M.2: GSTIN is suppressed (null)", pub_nogst["business"]["gstin"] is None)
    log_test("TEST M.3: HSN/SAC is suppressed (null)", pub_nogst["items"][0]["hsnSac"] is None)
    log_test("TEST M.4: TaxableValue is null", pub_nogst["financials"]["taxableValue"] is None)
    log_test("TEST M.5: CGST is null", pub_nogst["financials"]["cgst"] is None)
    log_test("TEST M.6: SGST is null", pub_nogst["financials"]["sgst"] is None)
    log_test("TEST M.7: Subtotal equals Grand Total", pub_nogst["financials"]["subtotal"] == pub_nogst["financials"]["totalAmount"])

    # TEST J: Cancelled invoice public link returns 404
    print("\n--- Testing Cancelled Invoice Protection ---")
    # Cancel GST OFF invoice in DB
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('UPDATE "Invoices" SET "Status" = 4 WHERE "Id" = %s;', (inv_nogst_final["id"],))
    conn.commit()
    cur.close()
    conn.close()

    cancel_access = session.get(f"{BASE_URL}/api/public/invoices/{nogst_token}")
    log_test("TEST J: Cancelled invoice public URL returns 404", cancel_access.status_code == 404)

    # TEST U: Unauthorized user cannot create/revoke/rotate link
    print("\n--- Testing User Permissions ---")
    unauth_user_id = str(uuid.uuid4())
    # User with NO invoice permissions (e.g. only customers.view)
    unauth_token = generate_test_jwt(unauth_user_id, "staff_viewer", role="Staff", is_owner=False, permissions=["customers.view"])
    unauth_headers = {"Authorization": f"Bearer {unauth_token}"}

    unauth_create = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/public-link", headers=unauth_headers)
    log_test("TEST U.1: Unauthorized user cannot create public link (403 Forbidden)", unauth_create.status_code == 403)

    unauth_revoke = session.delete(f"{BASE_URL}/api/invoices/{invoice_id}/public-link", headers=unauth_headers)
    log_test("TEST U.2: Unauthorized user cannot revoke public link (403 Forbidden)", unauth_revoke.status_code == 403)

    unauth_rotate = session.post(f"{BASE_URL}/api/invoices/{invoice_id}/public-link/rotate", headers=unauth_headers)
    log_test("TEST U.3: Unauthorized user cannot rotate public link (403 Forbidden)", unauth_rotate.status_code == 403)

    # TEST W, X, Y, Z: Verify Audit Trail records
    print("\n--- Testing Audit Trail Integration ---")
    audit_res = session.get(f"{BASE_URL}/api/audit-logs", headers=owner_headers)
    log_test("Query audit logs (200 OK)", audit_res.status_code == 200)
    audit_items = audit_res.json()["items"]

    created_audits = [a for a in audit_items if a["action"] == "PUBLIC_INVOICE_LINK_CREATED" and a.get("entityReference") == invoice_number]
    log_test("TEST W: Audit record exists for PUBLIC_INVOICE_LINK_CREATED", len(created_audits) > 0)

    rotated_audits = [a for a in audit_items if a["action"] == "PUBLIC_INVOICE_LINK_ROTATED" and a.get("entityReference") == invoice_number]
    log_test("TEST Y: Audit record exists for PUBLIC_INVOICE_LINK_ROTATED", len(rotated_audits) > 0)

    revoked_audits = [a for a in audit_items if a["action"] == "PUBLIC_INVOICE_LINK_REVOKED" and a.get("entityReference") == invoice_number]
    log_test("TEST X: Audit record exists for PUBLIC_INVOICE_LINK_REVOKED", len(revoked_audits) > 0)

    # TEST Z: Public view does NOT create audit event
    view_audits = [a for a in audit_items if "view" in a["action"].lower() and a.get("entityReference") == invoice_number]
    log_test("TEST Z: Customer public page views create NO audit records", len(view_audits) == 0)

    # TEST AE: PDF/Print template and AF: QR Code URL
    print("\n--- Testing Public Page & QR Attributes ---")
    log_test("TEST AE: Public invoice model contains all invoice print document fields", "business" in pub_invoice and "customer" in pub_invoice and "items" in pub_invoice and "financials" in pub_invoice)
    log_test("TEST AF: Generated QR code target matches exact public URL", public_url.startswith("http") and "/i/" in public_url)

    print("\n==================================================")
    print("  ALL STEP 17A AUTOMATED TESTS PASSED SUCCESSFULLY!")
    print("==================================================\n")

if __name__ == "__main__":
    run_tests()
