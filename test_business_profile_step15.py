import requests
import json
import time
import hmac
import hashlib
import base64
import uuid
import io

BASE_URL = "http://localhost:5298/api"
DEV_SECRET = "E6CarSpa_Dev_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"
FALLBACK_SECRET = "E6CarSpa_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"

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

def get_auth_token():
    temp_id = str(uuid.uuid4())
    for secret in [DEV_SECRET, FALLBACK_SECRET]:
        temp_token = generate_test_jwt(temp_id, "admin", role="Owner", is_owner=True, secret_key=secret)
        try:
            r = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {temp_token}"}, timeout=5)
            if r.status_code == 200:
                users = r.json()
                if users:
                    real_user = users[0]
                    return generate_test_jwt(real_user["id"], real_user["username"], role="Owner", is_owner=True, secret_key=secret), real_user["id"], secret
                return temp_token, temp_id, secret
        except Exception:
            continue
    raise RuntimeError("Could not connect to API server on http://localhost:5298/api")

def run_tests():
    print("==================================================")
    print("=== STARTING STEP 15A BUSINESS PROFILE TESTS ===")
    print("==================================================")

    # Health check
    for i in range(10):
        try:
            r_health = requests.get("http://localhost:5298/api/health", timeout=3)
            if r_health.status_code == 200:
                print(f"[*] API health check OK (status {r_health.status_code})")
                break
        except Exception:
            time.sleep(1)

    token, owner_user_id, active_secret = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"[*] Owner authenticated successfully (User ID: {owner_user_id})")

    # ── TEST A: Business Profile Can Be Retrieved ──────────────────────────
    print("\n--- TEST A: Business Profile Can Be Retrieved ---")
    r = requests.get(f"{BASE_URL}/settings/business", headers=headers)
    assert r.status_code == 200, f"TEST A Failed: Expected 200, got {r.status_code}: {r.text}"
    profile = r.json()
    assert profile["businessName"] == "E6 Car Spa", f"Expected 'E6 Car Spa', got '{profile['businessName']}'"
    assert "36, Geetha Nagar" in profile["addressLine1"]
    assert profile["city"] == "Erode"
    assert profile["state"] == "Tamil Nadu"
    assert profile["postalCode"] == "638011"
    assert "+91 9578749449" in profile["phone"]
    assert profile["email"] == "e6carspaerd@gmail.com"
    print(f"[PASS] TEST A: Verified default profile retrieved: {profile['businessName']}, {profile['addressLine1']}, {profile['city']}, PIN {profile['postalCode']}")

    # ── TEST B & C: Owner Can Update Profile & Details Persist ─────────────
    print("\n--- TEST B & C: Owner Updates Profile & Changes Persist ---")
    update_payload = {
        "businessName": "E6 Car Spa Premium Detailing",
        "addressLine1": "36, Geetha Nagar Main Road",
        "addressLine2": "Behind Sakthi Mahal, Perundurai Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": None,
        "logoPath": profile.get("logoPath"),
        "invoicePrefix": "INV"
    }
    r_up = requests.put(f"{BASE_URL}/settings/business", json=update_payload, headers=headers)
    assert r_up.status_code == 200, f"TEST B Failed: Expected 200, got {r_up.status_code}: {r_up.text}"
    up_profile = r_up.json()
    assert up_profile["businessName"] == "E6 Car Spa Premium Detailing"
    assert up_profile["gstin"] is None

    # Fetch again to verify persistence
    r_get = requests.get(f"{BASE_URL}/settings/business", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()["businessName"] == "E6 Car Spa Premium Detailing"
    print("[PASS] TEST B & C: Profile successfully updated and persisted in database")

    # ── TEST D: GSTIN Can Remain Empty ─────────────────────────────────────
    print("\n--- TEST D: GSTIN Can Remain Empty ---")
    empty_gstin_payload = {
        "businessName": "E6 Car Spa",
        "addressLine1": "36, Geetha Nagar Main Road",
        "addressLine2": "Behind Sakthi Mahal, Perundurai Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": "   ", # Whitespace string should be normalized to null
        "invoicePrefix": "INV"
    }
    r_empty_gst = requests.put(f"{BASE_URL}/settings/business", json=empty_gstin_payload, headers=headers)
    assert r_empty_gst.status_code == 200, f"TEST D Failed: Expected 200, got {r_empty_gst.status_code}: {r_empty_gst.text}"
    assert r_empty_gst.json()["gstin"] is None, f"Expected null GSTIN, got {r_empty_gst.json()['gstin']}"
    print("[PASS] TEST D: Empty/whitespace GSTIN allowed and stored as null")

    # ── TEST E: GSTIN Validation (Valid Saved, Invalid Rejected) ───────────
    print("\n--- TEST E: GSTIN Normalization & Format Validation ---")
    # 1. Invalid GSTIN rejected (400)
    r_inv_gst = requests.put(f"{BASE_URL}/settings/business", json={
        "businessName": "E6 Car Spa",
        "addressLine1": "36, Geetha Nagar Main Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": "INVALID123" # Invalid format
    }, headers=headers)
    assert r_inv_gst.status_code in (400, 422), f"TEST E Failed: Expected 400 for invalid GSTIN, got {r_inv_gst.status_code}: {r_inv_gst.text}"
    print("[PASS] TEST E (1): Invalid GSTIN rejected with 400 Bad Request")

    # 2. Valid GSTIN accepted & normalized to uppercase
    valid_gstin = "33aaaaa0000a1z5" # lowercase input
    r_val_gst = requests.put(f"{BASE_URL}/settings/business", json={
        "businessName": "E6 Car Spa",
        "addressLine1": "36, Geetha Nagar Main Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": valid_gstin
    }, headers=headers)
    assert r_val_gst.status_code == 200, f"TEST E Failed: Expected 200 for valid GSTIN, got {r_val_gst.status_code}: {r_val_gst.text}"
    assert r_val_gst.json()["gstin"] == "33AAAAA0000A1Z5", f"Expected uppercase GSTIN '33AAAAA0000A1Z5', got '{r_val_gst.json()['gstin']}'"
    print(f"[PASS] TEST E (2): Valid GSTIN accepted and normalized to uppercase: {r_val_gst.json()['gstin']}")

    # Reset GSTIN to null
    requests.put(f"{BASE_URL}/settings/business", json={
        "businessName": "E6 Car Spa",
        "addressLine1": "36, Geetha Nagar Main Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": None
    }, headers=headers)

    # ── TEST F: Unauthorized User Receives 403 Forbidden ────────────────────
    print("\n--- TEST F: Role & Permission Access Control ---")
    ts = int(time.time())
    staff_user = f"staff_settings_{ts}"
    test_pwd = "TestPass123!"

    r_st = requests.post(f"{BASE_URL}/users", json={
        "username": staff_user,
        "fullName": f"Staff User {ts}",
        "role": "Staff",
        "password": test_pwd,
        "confirmPassword": test_pwd,
        "permissionCodes": ["settings.view"] # Has view only, NO settings.business
    }, headers=headers)
    assert r_st.status_code in (200, 201)
    st_data = r_st.json()
    st_token = generate_test_jwt(st_data["id"], staff_user, role="Staff", is_owner=False, permissions=["settings.view"], secret_key=active_secret)
    st_headers = {"Authorization": f"Bearer {st_token}", "Content-Type": "application/json"}

    # Staff can GET profile with settings.view
    r_st_get = requests.get(f"{BASE_URL}/settings/business", headers=st_headers)
    assert r_st_get.status_code == 200, f"Expected 200 with settings.view, got {r_st_get.status_code}"
    print("[PASS] Staff with settings.view can view business profile (200 OK)")

    # Staff tries PUT without settings.business -> 403 Forbidden
    r_st_put = requests.put(f"{BASE_URL}/settings/business", json={
        "businessName": "Hacked Spa",
        "addressLine1": "Fake St",
        "city": "Nowhere",
        "state": "State",
        "postalCode": "123456",
        "phone": "1234567890",
        "email": "hack@spa.com"
    }, headers=st_headers)
    assert r_st_put.status_code == 403, f"Expected 403 Forbidden, got {r_st_put.status_code}"
    print("[PASS] Staff without settings.business blocked from modifying settings (403 Forbidden)")

    # ── TEST G: Logo Upload, Preview & Removal ──────────────────────────────
    print("\n--- TEST G: Logo Upload, Validation, and Safe Removal ---")
    auth_multipart = {"Authorization": f"Bearer {token}"}

    # 1. Invalid file extension rejected
    fake_txt = io.BytesIO(b"not an image")
    r_bad_ext = requests.post(f"{BASE_URL}/settings/business/logo", files={"file": ("malicious.exe", fake_txt, "application/octet-stream")}, headers=auth_multipart)
    assert r_bad_ext.status_code == 400, f"Expected 400 for invalid file type, got {r_bad_ext.status_code}"
    print("[PASS] TEST G (1): Executable/invalid file type rejected with 400 Bad Request")

    # 2. Valid PNG logo upload
    # Create minimal 1x1 PNG bytes
    png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    png_file = io.BytesIO(png_bytes)
    r_logo = requests.post(f"{BASE_URL}/settings/business/logo", files={"file": ("test_logo.png", png_file, "image/png")}, headers=auth_multipart)
    assert r_logo.status_code == 200, f"Logo upload failed: {r_logo.status_code}: {r_logo.text}"
    logo_res = r_logo.json()
    assert "logoUrl" in logo_res
    uploaded_logo_url = logo_res["logoUrl"]
    assert uploaded_logo_url.startswith("/uploads/logos/logo_")
    print(f"[PASS] TEST G (2): Uploaded logo successfully. URL: {uploaded_logo_url}")

    # 3. Verify static file serving
    r_static = requests.get(f"http://localhost:5298{uploaded_logo_url}")
    assert r_static.status_code == 200, f"Static logo file not served: {r_static.status_code}"
    print(f"[PASS] TEST G (3): Static file served successfully (HTTP 200, {len(r_static.content)} bytes)")

    # 4. Remove Logo (DELETE)
    r_rm = requests.delete(f"{BASE_URL}/settings/business/logo", headers=headers)
    assert r_rm.status_code == 200, f"Delete logo failed: {r_rm.text}"
    assert r_rm.json()["logoPath"] is None
    print("[PASS] TEST G (4): Logo removed via DELETE /api/settings/business/logo")

    # ── TEST H, I, J, K: Existing Invoice & Payment System Intact ───────────
    # Fetch existing services
    r_services = requests.get(f"{BASE_URL}/services?isActive=true", headers=headers)
    svc_list = r_services.json().get("items", r_services.json()) if isinstance(r_services.json(), dict) else r_services.json()
    svc = next((s for s in svc_list if s.get("price") == 500.0), None)
    if not svc:
        r_new_svc = requests.post(f"{BASE_URL}/services", json={
            "name": "Step 15 Basic Wash",
            "price": 500.0,
            "category": "Washing",
            "taxPercentage": 18.0,
            "durationMinutes": 30
        }, headers=headers)
        svc = r_new_svc.json()
    
    # Fetch existing customer & vehicle
    r_cust = requests.get(f"{BASE_URL}/customers", headers=headers)
    cust_list = r_cust.json().get("items", r_cust.json()) if isinstance(r_cust.json(), dict) else r_cust.json()
    cust_id = cust_list[0]["id"]
    r_veh = requests.get(f"{BASE_URL}/vehicles/by-customer/{cust_id}", headers=headers)
    veh_list = r_veh.json().get("items", r_veh.json()) if isinstance(r_veh.json(), dict) else r_veh.json()
    veh_id = veh_list[0]["id"]

    # 1. Create Job Card
    r_jc = requests.post(f"{BASE_URL}/job-cards", json={
        "customerId": cust_id,
        "vehicleId": veh_id,
        "notes": "Step15 Integrity Check",
        "services": [
            {"serviceId": svc["id"], "serviceName": svc["name"], "unitPrice": 2000.0, "quantity": 1, "taxPercentage": 18.0, "discountAmount": 200.0}
        ]
    }, headers=headers)
    assert r_jc.status_code == 201, f"Job card failed: {r_jc.text}"
    jc_id = r_jc.json()["id"]

    # 2. Create Invoice
    r_inv = requests.post(f"{BASE_URL}/invoices/from-job-card/{jc_id}", headers=headers)
    assert r_inv.status_code == 201, f"Draft invoice failed: {r_inv.text}"
    inv_id = r_inv.json()["id"]

    # 3. Update Invoice Discount & GST toggle (TEST H & I)
    r_inv_up = requests.put(f"{BASE_URL}/invoices/{inv_id}", json={
        "discount": 300.0,
        "isGstEnabled": True
    }, headers=headers)
    assert r_inv_up.status_code == 200
    inv_data = r_inv_up.json()
    assert inv_data["subtotal"] == 500.0
    assert inv_data["discount"] == 300.0
    assert inv_data["taxableAmount"] == 200.0
    assert inv_data["gstAmount"] == 36.0 # 18% of 200
    assert inv_data["totalAmount"] == 236.0
    assert inv_data["balanceAmount"] == 236.0
    print(f"[PASS] TEST H, I: Invoice calculations & GST toggle intact: Subtotal={inv_data['subtotal']}, Disc={inv_data['discount']}, GST={inv_data['gstAmount']}, Total={inv_data['totalAmount']}")

    # 4. Generate Invoice (TEST J)
    r_gen = requests.post(f"{BASE_URL}/invoices/{inv_id}/generate", headers=headers)
    assert r_gen.status_code == 200
    gen_inv = r_gen.json()
    assert gen_inv["invoiceNumber"] is not None
    assert gen_inv["status"] in ("Generated", 6)
    print(f"[PASS] TEST J: Invoice finalization & numbering intact: {gen_inv['invoiceNumber']}")

    # 5. Record Payment (TEST K)
    r_pay = requests.post(f"{BASE_URL}/invoices/{inv_id}/payments", json={
        "amount": 200.0,
        "paymentMethod": "Card",
        "reference": "CARD-REF-15"
    }, headers=headers)
    assert r_pay.status_code == 200
    r_check_inv = requests.get(f"{BASE_URL}/invoices/{inv_id}", headers=headers)
    assert r_check_inv.json()["paidAmount"] == 200.0
    assert r_check_inv.json()["balanceAmount"] == 36.0
    print(f"[PASS] TEST K: Payment recording & balance calculation intact: Paid=200.0, Balance=36.0")

    print("\n==================================================")
    print(">>> ALL STEP 15A BUSINESS PROFILE TESTS PASSED (100%) <<<")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
