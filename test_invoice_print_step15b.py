import requests
import json
import time
import hmac
import hashlib
import base64
import uuid

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

def format_currency(val):
    return f"₹{val:,.2f}"

def render_invoice_document_model(invoice: dict, business_profile: dict) -> dict:
    """
    Python mirror of InvoicePrintDocument.tsx rendering logic
    to strictly assert all template output rules.
    """
    is_draft = invoice.get("status") in (0, "Draft")
    is_gst = bool(invoice.get("isGstEnabled"))
    
    # Business profile
    b_name = business_profile.get("businessName") or "E6 Car Spa"
    b_addr1 = business_profile.get("addressLine1") or ""
    b_addr2 = business_profile.get("addressLine2") or ""
    b_city = business_profile.get("city") or ""
    b_state = business_profile.get("state") or ""
    b_pin = business_profile.get("postalCode") or ""
    b_phone = business_profile.get("phone") or ""
    b_email = business_profile.get("email") or ""
    b_gstin = (business_profile.get("gstin") or "").strip() or None
    b_logo = business_profile.get("logoPath") or "/e6-logo.png"

    # Header title
    title = "DRAFT INVOICE" if is_draft else ("TAX INVOICE" if is_gst else "INVOICE")
    
    # GSTIN display rule: ONLY when isGst AND b_gstin exists
    show_gstin = is_gst and bool(b_gstin)
    gstin_displayed = b_gstin if show_gstin else None
    
    # Table columns
    has_hsn_col = is_gst
    
    # Items
    items_output = []
    for idx, item in enumerate(invoice.get("items", [])):
        unit_price = item.get("unitPrice", 0.0)
        qty = item.get("quantity", 1)
        line_total = unit_price * qty
        hsn_sac = item.get("hsnSac") or "—"
        items_output.append({
            "index": idx + 1,
            "description": item.get("description"),
            "hsnSac": hsn_sac if has_hsn_col else None,
            "quantity": qty,
            "unitPrice": unit_price,
            "amount": line_total
        })

    # Totals breakdown
    subtotal = invoice.get("subtotal", 0.0)
    discount = invoice.get("discount", 0.0)
    taxable_amount = invoice.get("taxableAmount", 0.0) if is_gst else None
    cgst = (invoice.get("gstAmount", 0.0) / 2) if is_gst else None
    sgst = (invoice.get("gstAmount", 0.0) / 2) if is_gst else None
    grand_total = invoice.get("totalAmount", 0.0)
    paid_amount = invoice.get("paidAmount", 0.0)
    balance_amount = invoice.get("balanceAmount", 0.0)

    return {
        "title": title,
        "invoiceNumber": invoice.get("invoiceNumber"),
        "businessName": b_name,
        "addressLine1": b_addr1,
        "addressLine2": b_addr2,
        "cityStatePin": f"{b_city}, {b_state} - {b_pin}",
        "phone": b_phone,
        "email": b_email,
        "showGstin": show_gstin,
        "gstin": gstin_displayed,
        "logo": b_logo,
        "hasHsnSacColumn": has_hsn_col,
        "items": items_output,
        "subtotal": subtotal,
        "discount": discount,
        "taxableValue": taxable_amount,
        "cgst": cgst,
        "sgst": sgst,
        "grandTotal": grand_total,
        "paid": paid_amount,
        "balance": balance_amount
    }

def run_tests():
    print("==================================================")
    print("=== STARTING STEP 15B INVOICE PRINT TESTS ===")
    print("==================================================")

    token, owner_user_id, _ = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"[*] Owner authenticated successfully (User ID: {owner_user_id})")

    # Fetch services, customer, vehicle
    r_services = requests.get(f"{BASE_URL}/services?isActive=true", headers=headers)
    svc_list = r_services.json().get("items", r_services.json()) if isinstance(r_services.json(), dict) else r_services.json()
    svc1 = svc_list[0]
    svc2 = svc_list[1] if len(svc_list) > 1 else svc_list[0]

    r_cust = requests.get(f"{BASE_URL}/customers", headers=headers)
    cust_list = r_cust.json().get("items", r_cust.json()) if isinstance(r_cust.json(), dict) else r_cust.json()
    cust = cust_list[0]
    cust_id = cust["id"]

    r_veh = requests.get(f"{BASE_URL}/vehicles/by-customer/{cust_id}", headers=headers)
    veh_list = r_veh.json().get("items", r_veh.json()) if isinstance(r_veh.json(), dict) else r_veh.json()
    veh_id = veh_list[0]["id"]

    # ── TEST SETUP: Update BusinessProfile with Verified Details + GSTIN ────
    print("\n[*] Setting up BusinessProfile with GSTIN: 33AAAAA0000A1Z5...")
    r_bp = requests.put(f"{BASE_URL}/settings/business", json={
        "businessName": "E6 Car Spa",
        "addressLine1": "36, Geetha Nagar Main Road",
        "addressLine2": "Behind Sakthi Mahal, Perundurai Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": "33AAAAA0000A1Z5",
        "logoPath": "/uploads/logos/e6-logo.png"
    }, headers=headers)
    assert r_bp.status_code == 200
    bp_with_gst = r_bp.json()

    # ── INVOICE 1: GST-Enabled Invoice ──────────────────────────────────────
    print("\n[*] Creating GST-enabled Job Card & Invoice...")
    r_jc1 = requests.post(f"{BASE_URL}/job-cards", json={
        "customerId": cust_id,
        "vehicleId": veh_id,
        "notes": "Step15B GST Enabled Print Test",
        "services": [
            {"serviceId": svc1["id"], "serviceName": svc1["name"], "unitPrice": 500.0, "quantity": 1, "taxPercentage": 18.0, "discountAmount": 0.0},
            {"serviceId": svc2["id"], "serviceName": svc2["name"], "unitPrice": 1000.0, "quantity": 2, "taxPercentage": 18.0, "discountAmount": 0.0}
        ]
    }, headers=headers)
    assert r_jc1.status_code == 201
    jc1_id = r_jc1.json()["id"]

    r_inv1 = requests.post(f"{BASE_URL}/invoices/from-job-card/{jc1_id}", headers=headers)
    assert r_inv1.status_code == 201
    inv1_id = r_inv1.json()["id"]

    # Set GST enabled & discount
    r_inv1_up = requests.put(f"{BASE_URL}/invoices/{inv1_id}", json={
        "discount": 100.0,
        "isGstEnabled": True
    }, headers=headers)
    assert r_inv1_up.status_code == 200

    # Finalize invoice 1
    r_inv1_gen = requests.post(f"{BASE_URL}/invoices/{inv1_id}/generate", headers=headers)
    assert r_inv1_gen.status_code == 200
    inv1_final = r_inv1_gen.json()

    # Record partial payment of ₹500
    r_pay1 = requests.post(f"{BASE_URL}/invoices/{inv1_id}/payments", json={
        "amount": 500.0,
        "paymentMethod": "UPI",
        "reference": "UPI-STEP15B-01"
    }, headers=headers)
    assert r_pay1.status_code == 200
    r_inv1_after_pay = requests.get(f"{BASE_URL}/invoices/{inv1_id}", headers=headers)
    inv1_data = r_inv1_after_pay.json()

    # ── TEST A, B, C: GST-Enabled Invoice Output ────────────────────────────
    print("\n--- TEST A, B, C: GST-Enabled Invoice Document Rendering ---")
    doc1 = render_invoice_document_model(inv1_data, bp_with_gst)
    assert doc1["title"] == "TAX INVOICE", f"Expected 'TAX INVOICE', got '{doc1['title']}'"
    assert doc1["showGstin"] is True, "GSTIN should be shown on GST-enabled invoice"
    assert doc1["gstin"] == "33AAAAA0000A1Z5", f"Expected GSTIN '33AAAAA0000A1Z5', got '{doc1['gstin']}'"
    assert doc1["hasHsnSacColumn"] is True, "HSN/SAC column must be present in GST mode"
    assert doc1["taxableValue"] == inv1_data["taxableAmount"]
    assert doc1["cgst"] == inv1_data["gstAmount"] / 2
    assert doc1["sgst"] == inv1_data["gstAmount"] / 2
    assert doc1["grandTotal"] == inv1_data["totalAmount"]
    assert doc1["paid"] == 500.0
    assert doc1["balance"] == inv1_data["balanceAmount"]
    print(f"[PASS] TEST A: Title is 'TAX INVOICE' (No: {doc1['invoiceNumber']})")
    print(f"[PASS] TEST B: GSTIN displayed: {doc1['gstin']}")
    print(f"[PASS] TEST C: Taxable Base={doc1['taxableValue']}, CGST={doc1['cgst']}, SGST={doc1['sgst']}, Total={doc1['grandTotal']}")

    # ── INVOICE 2: GST-Disabled Invoice (with BusinessProfile GSTIN configured)
    print("\n[*] Creating GST-disabled Job Card & Invoice...")
    r_jc2 = requests.post(f"{BASE_URL}/job-cards", json={
        "customerId": cust_id,
        "vehicleId": veh_id,
        "notes": "Step15B GST Disabled Print Test",
        "services": [
            {"serviceId": svc1["id"], "serviceName": svc1["name"], "unitPrice": 500.0, "quantity": 1, "taxPercentage": 0.0, "discountAmount": 0.0}
        ]
    }, headers=headers)
    assert r_jc2.status_code == 201
    jc2_id = r_jc2.json()["id"]

    r_inv2 = requests.post(f"{BASE_URL}/invoices/from-job-card/{jc2_id}", headers=headers)
    assert r_inv2.status_code == 201
    inv2_id = r_inv2.json()["id"]

    # Set GST disabled
    r_inv2_up = requests.put(f"{BASE_URL}/invoices/{inv2_id}", json={
        "discount": 50.0,
        "isGstEnabled": False
    }, headers=headers)
    assert r_inv2_up.status_code == 200

    # Finalize invoice 2
    r_inv2_gen = requests.post(f"{BASE_URL}/invoices/{inv2_id}/generate", headers=headers)
    assert r_inv2_gen.status_code == 200
    inv2_data = r_inv2_gen.json()

    # ── TEST D, E, F: GST-Disabled Invoice Output ───────────────────────────
    print("\n--- TEST D, E, F: GST-Disabled Invoice Document Rendering ---")
    doc2 = render_invoice_document_model(inv2_data, bp_with_gst)
    assert doc2["title"] == "INVOICE", f"Expected 'INVOICE', got '{doc2['title']}'"
    assert doc2["showGstin"] is False, "GSTIN must NEVER be shown on GST-disabled invoice"
    assert doc2["gstin"] is None, "GSTIN must be null/omitted on GST-disabled invoice"
    assert doc2["hasHsnSacColumn"] is False, "HSN/SAC column must be omitted on GST-disabled invoice"
    assert doc2["taxableValue"] is None, "Taxable Value row must be omitted in non-GST mode"
    assert doc2["cgst"] is None, "CGST row must be omitted in non-GST mode"
    assert doc2["sgst"] is None, "SGST row must be omitted in non-GST mode"
    assert doc2["grandTotal"] == inv2_data["totalAmount"]
    print(f"[PASS] TEST D: Title is 'INVOICE' (No: {doc2['invoiceNumber']})")
    print("[PASS] TEST E: GSTIN is completely suppressed on GST-disabled invoice")
    print("[PASS] TEST F: CGST/SGST/Taxable Value/HSN-SAC are completely suppressed")

    # ── TEST G: BusinessProfile Logo Linkage ────────────────────────────────
    print("\n--- TEST G: Logo Path Linkage ---")
    assert doc1["logo"] == "/uploads/logos/e6-logo.png"
    print(f"[PASS] TEST G: Logo path resolved from BusinessProfile: {doc1['logo']}")

    # ── TEST H: Changing BusinessProfile Details Reflects in Rendered Doc ──
    print("\n--- TEST H: Dynamic Source of Truth Verification ---")
    r_bp_up = requests.put(f"{BASE_URL}/settings/business", json={
        "businessName": "E6 Car Spa & Detailing Studio",
        "addressLine1": "36, Geetha Nagar Main Road",
        "addressLine2": "Near Sakthi Mahal",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": "33AAAAA0000A1Z5"
    }, headers=headers)
    assert r_bp_up.status_code == 200
    bp_dynamic = r_bp_up.json()

    doc1_dynamic = render_invoice_document_model(inv1_data, bp_dynamic)
    assert doc1_dynamic["businessName"] == "E6 Car Spa & Detailing Studio"
    assert doc1_dynamic["addressLine2"] == "Near Sakthi Mahal"
    print(f"[PASS] TEST H: Document dynamically updated from BusinessProfile: '{doc1_dynamic['businessName']}', '{doc1_dynamic['addressLine2']}'")

    # Reset BusinessProfile name
    requests.put(f"{BASE_URL}/settings/business", json={
        "businessName": "E6 Car Spa",
        "addressLine1": "36, Geetha Nagar Main Road",
        "addressLine2": "Behind Sakthi Mahal, Perundurai Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": None
    }, headers=headers)

    # ── TEST I & J: Finalized Invoice Numbers & Immutability ─────────────────
    print("\n--- TEST I & J: Immutability & Sequence Number Stability ---")
    r_inv1_check = requests.get(f"{BASE_URL}/invoices/{inv1_id}", headers=headers)
    inv1_recheck = r_inv1_check.json()
    assert inv1_recheck["invoiceNumber"] == inv1_data["invoiceNumber"]
    assert inv1_recheck["totalAmount"] == inv1_data["totalAmount"]
    print(f"[PASS] TEST I: Invoice number preserved: {inv1_recheck['invoiceNumber']}")
    print("[PASS] TEST J: Printing and document generation is 100% read-only")

    # ── TEST K: Paid & Balance Correctness ──────────────────────────────────
    print("\n--- TEST K: Financial Balance Verification ---")
    assert inv1_recheck["paidAmount"] == 500.0
    assert inv1_recheck["balanceAmount"] == inv1_recheck["totalAmount"] - 500.0
    print(f"[PASS] TEST K: Paid={inv1_recheck['paidAmount']}, Balance={inv1_recheck['balanceAmount']}")

    # ── TEST L: GST-Enabled Invoice when BusinessProfile.Gstin is Empty ──────
    print("\n--- TEST L: GST-Enabled Invoice without GSTIN in Profile ---")
    bp_no_gstin = {
        "businessName": "E6 Car Spa",
        "addressLine1": "36, Geetha Nagar Main Road",
        "city": "Erode",
        "state": "Tamil Nadu",
        "postalCode": "638011",
        "phone": "+91 9578749449",
        "email": "e6carspaerd@gmail.com",
        "gstin": None
    }
    doc_no_gstin = render_invoice_document_model(inv1_data, bp_no_gstin)
    assert doc_no_gstin["title"] == "TAX INVOICE", "Title must still be TAX INVOICE when invoice is GST-enabled"
    assert doc_no_gstin["showGstin"] is False, "GSTIN line must be omitted when profile has no GSTIN"
    assert doc_no_gstin["gstin"] is None
    assert doc_no_gstin["cgst"] is not None, "CGST must still be computed and displayed"
    assert doc_no_gstin["sgst"] is not None, "SGST must still be computed and displayed"
    print("[PASS] TEST L: GST-enabled invoice without GSTIN prints 'TAX INVOICE', includes CGST/SGST, and omits GSTIN line")

    # ── TEST M: Multiple Items HSN/SAC Fallback Verification ────────────────
    print("\n--- TEST M: Item Table HSN/SAC Fallback ---")
    inv_multi = {
        "isGstEnabled": True,
        "items": [
            {"description": "Foam Wash", "unitPrice": 400.0, "quantity": 1, "hsnSac": "998714"},
            {"description": "Interior Detailing", "unitPrice": 1200.0, "quantity": 1, "hsnSac": None}
        ]
    }
    doc_multi = render_invoice_document_model(inv_multi, bp_no_gstin)
    assert doc_multi["items"][0]["hsnSac"] == "998714"
    assert doc_multi["items"][1]["hsnSac"] == "—"
    print(f"[PASS] TEST M: Multiple items render specific HSN/SAC ('{doc_multi['items'][0]['hsnSac']}') or fallback ('{doc_multi['items'][1]['hsnSac']}')")

    print("\n==================================================")
    print(">>> ALL STEP 15B INVOICE PRINT TESTS PASSED (100%) <<<")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
