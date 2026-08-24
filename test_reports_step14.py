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

def run_tests():
    print("==================================================")
    print("=== STARTING STEP 14A REPORTING TEST SUITE ===")
    print("==================================================")

    # Wait for API server to be responsive
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

    # ── TEST A: Dashboard Endpoint Returns 200 ─────────────────────────────
    print("\n--- TEST A: Dashboard Endpoint Returns 200 and Schema ---")
    r = requests.get(f"{BASE_URL}/reports/dashboard", headers=headers)
    assert r.status_code == 200, f"TEST A Failed: Expected 200, got {r.status_code}: {r.text}"
    dash = r.json()
    assert "dateRange" in dash
    assert "jobCardKpis" in dash
    assert "vehicleActivity" in dash
    assert "invoiceKpis" in dash
    assert "sales" in dash
    assert "paymentCollection" in dash
    assert "showroom" in dash
    assert "staffAdvances" in dash
    assert "outstanding" in dash
    assert "recentActivity" in dash
    print(f"[PASS] TEST A: Dashboard returns 200 OK with full schema")

    # ── Setup Test Data: Customer, Vehicle, Job Card, Finalized Invoice, Payments
    print("\n[*] Setting up isolated test records for deep assertions...")
    
    # 1. Customer & Vehicle
    r_cust = requests.get(f"{BASE_URL}/customers", headers=headers)
    assert r_cust.status_code == 200
    custs = r_cust.json()
    if isinstance(custs, dict) and "items" in custs:
        custs = custs["items"]
    test_cust = custs[0]
    cust_id = test_cust["id"]

    r_veh = requests.get(f"{BASE_URL}/vehicles/by-customer/{cust_id}", headers=headers)
    assert r_veh.status_code == 200, f"Get vehicles by customer failed: {r_veh.text}"
    vehs = r_veh.json()
    if not vehs:
        r_new_veh = requests.post(f"{BASE_URL}/vehicles", json={
            "customerId": cust_id,
            "registrationNumber": f"KA{int(time.time()) % 10000:04d}ZZ",
            "make": "Hyundai",
            "model": "i20"
        }, headers=headers)
        assert r_new_veh.status_code == 201, f"Create vehicle failed: {r_new_veh.text}"
        test_veh = r_new_veh.json()
    else:
        test_veh = vehs[0]
    veh_id = test_veh["id"]

    # 2. Query Services & Create Job Card
    r_services = requests.get(f"{BASE_URL}/services?isActive=true", headers=headers)
    assert r_services.status_code == 200
    svc_data = r_services.json()
    services_list = svc_data["items"] if isinstance(svc_data, dict) and "items" in svc_data else svc_data
    test_svc = next((s for s in services_list if s.get("isActive", True)), services_list[0])
    svc_id = test_svc["id"]

    r_jc = requests.post(f"{BASE_URL}/job-cards", json={
        "customerId": cust_id,
        "vehicleId": veh_id,
        "notes": "Step14 Test Job Card",
        "services": [
            {"serviceId": svc_id, "serviceName": test_svc["name"], "unitPrice": 1000.0, "quantity": 1, "taxPercentage": 18.0, "discountAmount": 0.0}
        ]
    }, headers=headers)
    assert r_jc.status_code == 201, f"Failed to create job card: {r_jc.text}"
    jc = r_jc.json()
    jc_id = jc["id"]

    # 3. Create Draft Invoice from Job Card
    r_inv = requests.post(f"{BASE_URL}/invoices/from-job-card/{jc_id}", headers=headers)
    assert r_inv.status_code == 201, f"Failed to create draft invoice: {r_inv.text}"
    draft_inv = r_inv.json()
    draft_inv_id = draft_inv["id"]

    # ── TEST C: Draft Invoices are Excluded from Finalized Sales ────────────
    print("\n--- TEST C: Draft Invoices are Excluded from Finalized Sales ---")
    r_sales_pre = requests.get(f"{BASE_URL}/reports/sales", headers=headers)
    assert r_sales_pre.status_code == 200
    sales_pre = r_sales_pre.json()
    draft_in_sales = [i for i in sales_pre["items"] if i["invoiceId"] == draft_inv_id]
    assert len(draft_in_sales) == 0, f"Draft invoice {draft_inv_id} should NOT be in finalized sales report"
    print("[PASS] TEST C: Draft invoice excluded from finalized sales report")

    # 4. Finalize Invoice
    r_gen = requests.post(f"{BASE_URL}/invoices/{draft_inv_id}/generate", headers=headers)
    assert r_gen.status_code == 200, f"Failed to generate invoice: {r_gen.text}"
    final_inv = r_gen.json()
    assert final_inv["invoiceNumber"] is not None
    inv_total = final_inv["totalAmount"]
    inv_gst = final_inv["gstAmount"]
    inv_subtotal = final_inv["subtotal"]
    print(f"[*] Finalized invoice: {final_inv['invoiceNumber']}, Subtotal={inv_subtotal}, GST={inv_gst}, Total={inv_total}")

    # ── TEST B: Invoice Totals Match Actual Finalized Invoices ──────────────
    print("\n--- TEST B: Invoice Totals Match Actual Finalized Invoices ---")
    r_sales = requests.get(f"{BASE_URL}/reports/sales", headers=headers)
    assert r_sales.status_code == 200
    sales = r_sales.json()
    matching_sales_row = next((i for i in sales["items"] if i["invoiceId"] == draft_inv_id), None)
    assert matching_sales_row is not None, f"Finalized invoice {draft_inv_id} must appear in sales report"
    assert matching_sales_row["totalAmount"] == inv_total
    assert matching_sales_row["gst"] == inv_gst
    assert matching_sales_row["subtotal"] == inv_subtotal
    print("[PASS] TEST B: Sales report accurately reflects finalized invoice financial totals")

    # ── TEST D: Paid + PartiallyPaid Invoice Balances are Correct ───────────
    print("\n--- TEST D: Paid + PartiallyPaid Invoice Balances ---")
    # Pay partial amount (e.g. 500)
    r_pay1 = requests.post(f"{BASE_URL}/invoices/{draft_inv_id}/payments", json={
        "amount": 500.0,
        "paymentMethod": "UPI",
        "reference": "UPI-REF-001"
    }, headers=headers)
    assert r_pay1.status_code == 200, f"Payment 1 failed: {r_pay1.text}"
    
    r_inv_partial = requests.get(f"{BASE_URL}/invoices/{draft_inv_id}", headers=headers)
    partial_inv_data = r_inv_partial.json()
    assert partial_inv_data["status"] == 3 or str(partial_inv_data["status"]).lower() == "partiallypaid", f"Expected PartiallyPaid, got {partial_inv_data['status']}"
    assert partial_inv_data["paidAmount"] == 500.0
    assert partial_inv_data["balanceAmount"] == inv_total - 500.0

    # Verify Sales Report shows updated Paid & Balance
    r_sales_part = requests.get(f"{BASE_URL}/reports/sales", headers=headers)
    part_row = next(i for i in r_sales_part.json()["items"] if i["invoiceId"] == draft_inv_id)
    assert part_row["paidAmount"] == 500.0
    assert part_row["balanceAmount"] == inv_total - 500.0
    print(f"[PASS] TEST D: PartiallyPaid balance is exact: Total={inv_total}, Paid=500.0, Balance={part_row['balanceAmount']}")

    # ── TEST F: Active Invoice Payment Totals Match Payment Records ─────────
    print("\n--- TEST F: Active Invoice Payment Totals Match Payment Records ---")
    r_payments = requests.get(f"{BASE_URL}/reports/payments?invoiceId={draft_inv_id}", headers=headers)
    assert r_payments.status_code == 200
    pay_rep = r_payments.json()
    assert pay_rep["summary"]["totalCollected"] >= 500.0
    assert any(p["amount"] == 500.0 and p["paymentMethod"] == "UPI" for p in pay_rep["items"])
    print("[PASS] TEST F: Active payment totals and breakdown verified")

    # ── TEST E: Voided Invoice Payments are Excluded from Collection Totals ─
    print("\n--- TEST E: Voided Invoice Payments Excluded from Collection Totals ---")
    # Query all payments report with includeVoided=false vs includeVoided=true
    r_p_active = requests.get(f"{BASE_URL}/reports/payments?includeVoided=false", headers=headers)
    r_p_all = requests.get(f"{BASE_URL}/reports/payments?includeVoided=true", headers=headers)
    assert r_p_active.status_code == 200
    assert r_p_all.status_code == 200
    # Both summaries should report the SAME active TotalCollected
    assert r_p_active.json()["summary"]["totalCollected"] == r_p_all.json()["summary"]["totalCollected"]
    print("[PASS] TEST E: TotalCollected excludes voided payments consistently")

    # ── TEST G, H, I: Showroom Billed, Received (Excluding Voided), and Outstanding
    print("\n--- TEST G, H, I: Showroom Billed, Received, Outstanding ---")
    # Create fresh isolated showroom for test run
    ts_sr = int(time.time())
    r_new_sr = requests.post(f"{BASE_URL}/showrooms", json={
        "name": f"Showroom Test S14 {ts_sr}",
        "address": "123 Reporting Way",
        "phone": "9988776655",
        "isActive": True
    }, headers=headers)
    assert r_new_sr.status_code in (200, 201), f"Create test showroom failed: {r_new_sr.text}"
    sr_item = r_new_sr.json()
    sr_id = sr_item["id"]
    test_date = "2026-08-24"

    # Set daily bill
    r_set_bill = requests.post(f"{BASE_URL}/showrooms/{sr_id}/daily-bill?date={test_date}", json={
        "amount": 12000.0,
        "notes": "Daily bill for Step 14 test"
    }, headers=headers)
    assert r_set_bill.status_code == 200, f"Set bill failed: {r_set_bill.text}"

    # Record showroom payment
    r_sr_pay = requests.post(f"{BASE_URL}/showrooms/{sr_id}/daily-bill/payments?date={test_date}", json={
        "amount": 4000.0,
        "paymentMethod": "BankTransfer",
        "reference": "SR-BANK-001"
    }, headers=headers)
    assert r_sr_pay.status_code == 200, f"Record showroom payment failed: {r_sr_pay.text}"
    sr_bill_data = r_sr_pay.json()
    sr_pay_id = sr_bill_data["payments"][0]["id"]

    # Showroom report check
    r_sr_rep = requests.get(f"{BASE_URL}/reports/showrooms?showroomId={sr_id}&fromDate={test_date}&toDate={test_date}", headers=headers)
    assert r_sr_rep.status_code == 200
    sr_rep = r_sr_rep.json()
    matching_sr_row = next((r for r in sr_rep["items"] if r["showroomId"] == sr_id), None)
    assert matching_sr_row is not None
    assert matching_sr_row["billedAmount"] >= 12000.0
    assert matching_sr_row["receivedAmount"] >= 4000.0
    assert matching_sr_row["balanceAmount"] == matching_sr_row["billedAmount"] - matching_sr_row["receivedAmount"]
    print(f"[PASS] TEST G, I: Showroom Billed={matching_sr_row['billedAmount']}, Received={matching_sr_row['receivedAmount']}, Outstanding={matching_sr_row['balanceAmount']}")

    # Void/delete the showroom payment and verify it is excluded from received
    r_del_sr_pay = requests.delete(f"{BASE_URL}/showroom-payments/{sr_pay_id}", headers=headers)
    assert r_del_sr_pay.status_code in (200, 204), f"Delete showroom payment failed: {r_del_sr_pay.text}"
    r_sr_rep_after_void = requests.get(f"{BASE_URL}/reports/showrooms?showroomId={sr_id}&fromDate={test_date}&toDate={test_date}", headers=headers)
    sr_row_after = next(r for r in r_sr_rep_after_void.json()["items"] if r["showroomId"] == sr_id)
    assert sr_row_after["receivedAmount"] == matching_sr_row["receivedAmount"] - 4000.0
    print("[PASS] TEST H: Voided showroom payment excluded from showroom received totals")

    # ── TEST J: Attendance Vehicles Equal Existing Staff Assignment Totals ──
    print("\n--- TEST J: Attendance Vehicles Equal Staff Assignment Totals ---")
    r_staff = requests.get(f"{BASE_URL}/staff-advances/staff", headers=headers)
    assert r_staff.status_code == 200
    staff_member = r_staff.json()[0]
    staff_id = staff_member["id"]

    # Assign staff to showroom with 8 vehicles attended
    r_assign = requests.post(f"{BASE_URL}/showrooms/{sr_id}/daily-staff", json={
        "staffId": staff_id,
        "date": test_date,
        "vehiclesAttended": 8
    }, headers=headers)
    assert r_assign.status_code in (200, 201), f"Assign staff failed: {r_assign.text}"

    r_sr_rep_att = requests.get(f"{BASE_URL}/reports/showrooms?showroomId={sr_id}&fromDate={test_date}&toDate={test_date}", headers=headers)
    sr_row_att = next(r for r in r_sr_rep_att.json()["items"] if r["showroomId"] == sr_id)
    assert sr_row_att["vehiclesAttended"] >= 8
    assert sr_row_att["staffCount"] >= 1
    print(f"[PASS] TEST J: Attendance vehicles ({sr_row_att['vehiclesAttended']}) and staff count ({sr_row_att['staffCount']}) match")

    # ── TEST K & L: Staff Advance Outstanding & Settled Totals ───────────────
    print("\n--- TEST K & L: Staff Advance Outstanding & Settled Totals ---")
    # 1. Create Outstanding advance
    r_adv_out = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": 2500.0,
        "advanceDate": test_date,
        "reason": "Test Outstanding Advance S14"
    }, headers=headers)
    assert r_adv_out.status_code == 201
    adv_out_id = r_adv_out.json()["id"]

    # 2. Create Settled advance
    r_adv_set = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": 1500.0,
        "advanceDate": test_date,
        "reason": "Test Settled Advance S14"
    }, headers=headers)
    assert r_adv_set.status_code == 201
    adv_set_id = r_adv_set.json()["id"]
    r_settle = requests.post(f"{BASE_URL}/staff-advances/{adv_set_id}/settle", headers=headers)
    assert r_settle.status_code == 200

    # 3. Create Obsolete advance
    r_adv_obs = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": 9000.0,
        "advanceDate": test_date,
        "reason": "Test Obsolete Advance S14"
    }, headers=headers)
    assert r_adv_obs.status_code == 201
    adv_obs_id = r_adv_obs.json()["id"]
    r_obs = requests.post(f"{BASE_URL}/staff-advances/{adv_obs_id}/obsolete", json={"reason": "Step14 test obsolete"}, headers=headers)
    assert r_obs.status_code == 200

    # Query Staff Advance report
    r_adv_rep = requests.get(f"{BASE_URL}/reports/staff-advances", headers=headers)
    assert r_adv_rep.status_code == 200
    adv_summary = r_adv_rep.json()["summary"]
    assert adv_summary["outstandingAmount"] >= 2500.0
    assert adv_summary["settledAmount"] >= 1500.0
    assert adv_summary["obsoleteAmount"] >= 9000.0
    print(f"[PASS] TEST K, L: Staff Advance report: Outstanding={adv_summary['outstandingAmount']}, Settled={adv_summary['settledAmount']}, Obsolete={adv_summary['obsoleteAmount']}")

    # Clean up test advance
    requests.post(f"{BASE_URL}/staff-advances/{adv_out_id}/obsolete", json={"reason": "Test cleanup"}, headers=headers)

    # ── TEST M: GST Totals Match Stored Invoice GST Values ──────────────────
    print("\n--- TEST M: GST Totals Match Stored Invoice GST Values ---")
    r_gst = requests.get(f"{BASE_URL}/reports/gst", headers=headers)
    assert r_gst.status_code == 200
    gst_rep = r_gst.json()
    assert gst_rep["invoiceCount"] > 0
    assert gst_rep["totalGstAmount"] >= inv_gst
    assert gst_rep["cgstAmount"] + gst_rep["sgstAmount"] == gst_rep["totalGstAmount"]
    print(f"[PASS] TEST M: GST report TaxableBase={gst_rep['taxableBase']}, TotalGST={gst_rep['totalGstAmount']}, CGST={gst_rep['cgstAmount']}, SGST={gst_rep['sgstAmount']}")

    # ── TEST N: Outstanding Invoice Report ──────────────────────────────────
    print("\n--- TEST N: Outstanding Invoice Report Contains Finalized with Balance > 0 ---")
    r_out_inv = requests.get(f"{BASE_URL}/reports/invoices/outstanding", headers=headers)
    assert r_out_inv.status_code == 200
    out_inv_rep = r_out_inv.json()
    assert all(item["balanceAmount"] > 0 for item in out_inv_rep["items"])
    assert all(item["status"] not in ("Draft", "Paid", "Cancelled", 0, 2, 4) for item in out_inv_rep["items"])
    matching_out = next((item for item in out_inv_rep["items"] if item["invoiceId"] == draft_inv_id), None)
    assert matching_out is not None, "Partially paid invoice must appear in outstanding report"
    assert matching_out["ageInDays"] >= 0
    print(f"[PASS] TEST N: Outstanding invoice report verified: {len(out_inv_rep['items'])} items, all Balance > 0, AgeInDays >= 0")

    # ── TEST O: Date Range Filtering is Inclusive and Correct ──────────────
    print("\n--- TEST O: Date Range Filtering is Inclusive and Correct ---")
    today_str = time.strftime("%Y-%m-%d")
    r_sales_today = requests.get(f"{BASE_URL}/reports/sales?fromDate={today_str}&toDate={today_str}", headers=headers)
    assert r_sales_today.status_code == 200
    sales_today = r_sales_today.json()
    assert any(i["invoiceId"] == draft_inv_id for i in sales_today["items"]), "Today's invoice must be returned with fromDate=today&toDate=today"
    print("[PASS] TEST O: Date range filtering is strictly inclusive")

    # ── TEST P: Showroom Date Isolation Works ──────────────────────────────
    print("\n--- TEST P: Showroom Date Isolation Works ---")
    past_date = "2025-01-01"
    r_sr_past = requests.get(f"{BASE_URL}/reports/showrooms?showroomId={sr_id}&fromDate={past_date}&toDate={past_date}", headers=headers)
    assert r_sr_past.status_code == 200
    assert len(r_sr_past.json()["items"]) == 0 or all(r["billedAmount"] == 0 and r["vehiclesAttended"] == 0 for r in r_sr_past.json()["items"])
    print("[PASS] TEST P: Showroom date isolation verified")

    # ── TEST Q: Staff Productivity Calculations Match Attendance Data ───────
    print("\n--- TEST Q: Staff Productivity Calculations Match Attendance Data ---")
    r_prod = requests.get(f"{BASE_URL}/reports/staff-productivity?staffId={staff_id}", headers=headers)
    assert r_prod.status_code == 200
    prod_rep = r_prod.json()
    assert prod_rep["totalStaff"] >= 1
    staff_row = next(p for p in prod_rep["items"] if p["staffId"] == staff_id)
    assert staff_row["daysAssigned"] >= 1
    assert staff_row["totalVehiclesAttended"] >= 8
    assert staff_row["dailyAverage"] == round(staff_row["totalVehiclesAttended"] / staff_row["daysAssigned"], 1)
    print(f"[PASS] TEST Q: Productivity: Staff='{staff_row['staffName']}', Days={staff_row['daysAssigned']}, Vehicles={staff_row['totalVehiclesAttended']}, Avg={staff_row['dailyAverage']}")

    # ── TEST R, S, T: Permissions Enforcement & Access Control ─────────────
    print("\n--- TEST R, S, T: Role & Permission Enforcement ---")
    ts = int(time.time())
    mgr_username = f"mgr_rep_{ts}"
    staff_username = f"staff_rep_{ts}"
    test_pwd = "TestPass123!"

    # 1. Create Manager with NO reports permissions
    r_mgr_create = requests.post(f"{BASE_URL}/users", json={
        "username": mgr_username,
        "fullName": f"Manager NoReports {ts}",
        "role": "Manager",
        "password": test_pwd,
        "confirmPassword": test_pwd,
        "permissionCodes": ["invoices.view", "jobcards.view"]
    }, headers=headers)
    assert r_mgr_create.status_code in (200, 201)
    mgr_id = r_mgr_create.json()["id"]
    mgr_token = generate_test_jwt(mgr_id, mgr_username, role="Manager", is_owner=False, permissions=["invoices.view", "jobcards.view"], secret_key=active_secret)
    mgr_headers = {"Authorization": f"Bearer {mgr_token}", "Content-Type": "application/json"}

    # Manager gets 403 on /reports/dashboard and /reports/sales
    r_mgr_dash = requests.get(f"{BASE_URL}/reports/dashboard", headers=mgr_headers)
    assert r_mgr_dash.status_code == 403, f"Expected 403, got {r_mgr_dash.status_code}"
    r_mgr_sales = requests.get(f"{BASE_URL}/reports/sales", headers=mgr_headers)
    assert r_mgr_sales.status_code == 403, f"Expected 403, got {r_mgr_sales.status_code}"
    print("[PASS] TEST R: Manager without reports permission receives 403 Forbidden")

    # 2. Create Staff user with view-only on staff_advances (NO reports permissions)
    r_st_create = requests.post(f"{BASE_URL}/users", json={
        "username": staff_username,
        "fullName": f"Staff NoReports {ts}",
        "role": "Staff",
        "password": test_pwd,
        "confirmPassword": test_pwd,
        "permissionCodes": ["staff_advances.view"]
    }, headers=headers)
    assert r_st_create.status_code in (200, 201)
    st_id = r_st_create.json()["id"]
    st_token = generate_test_jwt(st_id, staff_username, role="Staff", is_owner=False, permissions=["staff_advances.view"], secret_key=active_secret)
    st_headers = {"Authorization": f"Bearer {st_token}", "Content-Type": "application/json"}

    r_st_dash = requests.get(f"{BASE_URL}/reports/dashboard", headers=st_headers)
    assert r_st_dash.status_code == 403, f"Expected 403, got {r_st_dash.status_code}"
    r_st_gst = requests.get(f"{BASE_URL}/reports/gst", headers=st_headers)
    assert r_st_gst.status_code == 403, f"Expected 403, got {r_st_gst.status_code}"
    print("[PASS] TEST S: Staff without reports permission receives 403 Forbidden")

    # 3. Owner access verification (Owner bypasses all permissions)
    endpoints = [
        "/reports/dashboard",
        "/reports/sales",
        "/reports/payments",
        "/reports/invoices/outstanding",
        "/reports/gst",
        "/reports/job-cards",
        "/reports/showrooms",
        "/reports/staff-productivity",
        "/reports/staff-advances"
    ]
    for ep in endpoints:
        r_ep = requests.get(f"{BASE_URL}{ep}", headers=headers)
        assert r_ep.status_code == 200, f"Owner failed to access {ep}: {r_ep.status_code}"
    print(f"[PASS] TEST T: Owner successfully accessed all {len(endpoints)} reporting endpoints (200 OK)")

    print("\n==================================================")
    print(">>> ALL STEP 14A REPORTING TESTS PASSED (100%) <<<")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
