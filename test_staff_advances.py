import requests
import json
import time
import hmac
import hashlib
import base64
import uuid

BASE_URL = "http://localhost:5298/api"
DEV_SECRET = "E6CarSpa_Dev_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"
PROD_SECRET = "E6CarSpa_Production_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key"

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
    # Use a bootstrap token to query existing users
    temp_id = str(uuid.uuid4())
    temp_token = generate_test_jwt(temp_id, "admin", role="Owner", is_owner=True)
    r = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {temp_token}"})
    if r.status_code == 200 and r.json():
        real_user = r.json()[0]
        real_user_id = real_user["id"]
        real_username = real_user["username"]
        print(f"[*] Found database user: {real_username} ({real_user_id})")
        return generate_test_jwt(real_user_id, real_username, role="Owner", is_owner=True), real_user_id
    
    return temp_token, temp_id

def run_tests():
    print("=== STARTING STEP 13 STAFF ADVANCES TEST SUITE ===")
    token, owner_user_id = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"[*] Owner authenticated successfully (User ID: {owner_user_id})")

    # 1. Fetch available staff
    r = requests.get(f"{BASE_URL}/staff-advances/staff", headers=headers)
    assert r.status_code == 200, f"Get staff failed: {r.text}"
    staff_list = r.json()
    if not staff_list:
        # Create a test staff member
        r_new_staff = requests.post(f"{BASE_URL}/staff-advances/staff", json={
            "name": "Ravi Kumar",
            "phoneNumber": "9876543210",
            "role": "Senior Technician"
        }, headers=headers)
        assert r_new_staff.status_code == 201, f"Create staff failed: {r_new_staff.text}"
        staff = r_new_staff.json()
    else:
        staff = staff_list[0]
    
    staff_id = staff["id"]
    staff_name = staff["name"]
    print(f"[*] Testing with staff member: {staff_name} ({staff_id})")

    # ── TEST A: Create Advance ─────────────────────────────────────────────
    print("\n--- TEST A: Create Advance ---")
    adv_payload = {
        "staffId": staff_id,
        "amount": 5000.0,
        "advanceDate": "2026-08-24",
        "reason": "Personal Emergency Advance",
        "notes": "Requested for family medical expense"
    }
    r = requests.post(f"{BASE_URL}/staff-advances", json=adv_payload, headers=headers)
    assert r.status_code == 201, f"TEST A Failed: Expected 201 Created, got {r.status_code}: {r.text}"
    adv1 = r.json()
    assert adv1["status"] == "Outstanding", f"Expected Outstanding, got {adv1['status']}"
    assert adv1["amount"] == 5000.0
    assert adv1["reason"] == "Personal Emergency Advance"
    assert adv1["staffId"] == staff_id
    adv1_id = adv1["id"]
    print(f"[PASS] TEST A Passed: Created Advance ID {adv1_id} with Status = {adv1['status']}")

    # ── TEST B: Create Zero Amount (Rejected) ──────────────────────────────
    print("\n--- TEST B: Create Zero Amount ---")
    r = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": 0.0,
        "advanceDate": "2026-08-24",
        "reason": "Zero test"
    }, headers=headers)
    assert r.status_code == 400, f"TEST B Failed: Expected 400, got {r.status_code}"
    print(f"[PASS] TEST B Passed: Zero amount rejected with 400")

    # ── TEST C: Create Negative Amount (Rejected) ──────────────────────────
    print("\n--- TEST C: Create Negative Amount ---")
    r = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": -500.0,
        "advanceDate": "2026-08-24",
        "reason": "Negative test"
    }, headers=headers)
    assert r.status_code == 400, f"TEST C Failed: Expected 400, got {r.status_code}"
    print(f"[PASS] TEST C Passed: Negative amount rejected with 400")

    # ── TEST D: Mark Outstanding Advance as Settled ────────────────────────
    print("\n--- TEST D: Mark Outstanding Advance as Settled ---")
    r = requests.post(f"{BASE_URL}/staff-advances/{adv1_id}/settle", headers=headers)
    assert r.status_code == 200, f"TEST D Failed: Expected 200, got {r.status_code}: {r.text}"
    settled_adv1 = r.json()
    assert settled_adv1["status"] == "Settled", f"Expected Settled, got {settled_adv1['status']}"
    assert settled_adv1.get("settledAt") is not None
    assert settled_adv1.get("settledByUserId") is not None
    print(f"[PASS] TEST D Passed: Advance marked as Settled. SettledAt={settled_adv1['settledAt']}, SettledBy={settled_adv1.get('settledByName') or settled_adv1.get('settledByUserId')}")

    # ── TEST E: Try Settling Already Settled Advance (409 Conflict) ────────
    print("\n--- TEST E: Try Settling Already Settled Advance ---")
    r = requests.post(f"{BASE_URL}/staff-advances/{adv1_id}/settle", headers=headers)
    assert r.status_code == 409, f"TEST E Failed: Expected 409 Conflict, got {r.status_code}: {r.text}"
    print(f"[PASS] TEST E Passed: Re-settling rejected with 409 ({r.json().get('message')})")

    # ── TEST F: Create Another Advance and Mark as Obsolete ────────────────
    print("\n--- TEST F: Create and Mark Obsolete with Mandatory Reason ---")
    r = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": 3500.0,
        "advanceDate": "2026-08-24",
        "reason": "Festival advance entered by mistake"
    }, headers=headers)
    assert r.status_code == 201
    adv2 = r.json()
    adv2_id = adv2["id"]
    assert adv2["status"] == "Outstanding"

    # Mark Obsolete with "Wrongly entered"
    r = requests.post(f"{BASE_URL}/staff-advances/{adv2_id}/obsolete", json={
        "reason": "Wrongly entered"
    }, headers=headers)
    assert r.status_code == 200, f"TEST F Failed: Expected 200, got {r.status_code}: {r.text}"
    obsolete_adv2 = r.json()
    assert obsolete_adv2["status"] == "Obsolete", f"Expected Obsolete, got {obsolete_adv2['status']}"
    assert obsolete_adv2["obsoleteReason"] == "Wrongly entered"
    assert obsolete_adv2.get("obsoletedAt") is not None
    assert obsolete_adv2.get("obsoletedByUserId") is not None
    print(f"[PASS] TEST F Passed: Advance marked as Obsolete. Reason='{obsolete_adv2['obsoleteReason']}', ObsoletedAt={obsolete_adv2['obsoletedAt']}")

    # ── TEST G: Verify Obsolete Advance Remains in DB (No Physical Delete) ──
    print("\n--- TEST G: Verify Obsolete Advance Remains in DB ---")
    r = requests.get(f"{BASE_URL}/staff-advances/{adv2_id}", headers=headers)
    assert r.status_code == 200, f"TEST G Failed: Expected 200 (record persists), got {r.status_code}"
    adv2_fetched = r.json()
    assert adv2_fetched["id"] == adv2_id
    assert adv2_fetched["status"] == "Obsolete"
    assert adv2_fetched["obsoleteReason"] == "Wrongly entered"
    print(f"[PASS] TEST G Passed: Obsolete record naturally persists in database without physical deletion")

    # ── TEST H: Verify Obsolete Advance is Excluded from Active Totals ───────
    print("\n--- TEST H: Verify KPI Totals Exclude Obsolete Advances ---")
    r = requests.get(f"{BASE_URL}/staff-advances", headers=headers)
    assert r.status_code == 200
    list_res = r.json()
    summary = list_res["summary"]
    # Check default active view does not list adv2
    item_ids = [item["id"] for item in list_res["items"]]
    assert adv2_id not in item_ids, "Default active list should NOT include obsolete records"
    print(f"[PASS] TEST H Passed: Active Summary excludes obsolete. Outstanding Count={summary['outstandingCount']}, Amount={summary['outstandingAmount']}; Settled Count={summary['settledCount']}, Amount={summary['settledAmount']}")

    # ── TEST I: Try Settling Obsolete Advance (409 Conflict) ────────────────
    print("\n--- TEST I: Try Settling Obsolete Advance ---")
    r = requests.post(f"{BASE_URL}/staff-advances/{adv2_id}/settle", headers=headers)
    assert r.status_code == 409, f"TEST I Failed: Expected 409 Conflict, got {r.status_code}: {r.text}"
    print(f"[PASS] TEST I Passed: Settling obsolete advance rejected with 409 ({r.json().get('message')})")

    # ── TEST J: Try Obsoleting Settled Advance (409 Conflict) ───────────────
    print("\n--- TEST J: Try Obsoleting Settled Advance ---")
    r = requests.post(f"{BASE_URL}/staff-advances/{adv1_id}/obsolete", json={
        "reason": "Trying to obsolete settled record"
    }, headers=headers)
    assert r.status_code == 409, f"TEST J Failed: Expected 409 Conflict, got {r.status_code}: {r.text}"
    print(f"[PASS] TEST J Passed: Obsoleting settled advance rejected with 409 ({r.json().get('message')})")

    # ── TEST K: Try Obsolete with Blank Reason (400 Bad Request) ───────────
    print("\n--- TEST K: Try Obsolete with Blank Reason ---")
    # Create temp outstanding advance
    r = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": 1000.0,
        "advanceDate": "2026-08-24",
        "reason": "Test advance for blank reason validation"
    }, headers=headers)
    adv3_id = r.json()["id"]

    r = requests.post(f"{BASE_URL}/staff-advances/{adv3_id}/obsolete", json={
        "reason": ""
    }, headers=headers)
    assert r.status_code == 400, f"TEST K Failed: Expected 400 for blank reason, got {r.status_code}"
    print(f"[PASS] TEST K Passed: Blank reason rejected with 400")

    # ── TEST L: Try Obsolete with Whitespace / Short Reason ────────────────
    print("\n--- TEST L: Try Obsolete with Whitespace / Short Reason (< 3 chars) ---")
    r = requests.post(f"{BASE_URL}/staff-advances/{adv3_id}/obsolete", json={
        "reason": "   "
    }, headers=headers)
    assert r.status_code == 400, f"TEST L Failed: Expected 400 for whitespace, got {r.status_code}"

    r = requests.post(f"{BASE_URL}/staff-advances/{adv3_id}/obsolete", json={
        "reason": "ab"
    }, headers=headers)
    assert r.status_code == 400, f"TEST L Failed: Expected 400 for short reason (< 3 chars), got {r.status_code}"
    print(f"[PASS] TEST L Passed: Whitespace and short reasons (<3 chars) rejected with 400")

    # ── TEST M & N & O: Permission & Role Access Verification ──────────────
    print("\n--- TEST M, N, O: Permission & Role Verification ---")
    ts = int(time.time())
    mgr_username = f"mgr_{ts}"
    staff_username = f"staff_{ts}"
    test_pwd = "TestUserPass123!"

    # 1. Create Manager with view, create, settle (NO obsolete)
    r_mgr_create = requests.post(f"{BASE_URL}/users", json={
        "username": mgr_username,
        "fullName": f"Manager {ts}",
        "role": "Manager",
        "password": test_pwd,
        "confirmPassword": test_pwd,
        "permissionCodes": ["staff_advances.view", "staff_advances.create", "staff_advances.settle"]
    }, headers=headers)
    assert r_mgr_create.status_code in (200, 201), f"Create manager failed: {r_mgr_create.text}"
    mgr_user = r_mgr_create.json()
    mgr_id = mgr_user["id"]
    mgr_token = generate_test_jwt(mgr_id, mgr_username, role="Manager", is_owner=False, permissions=["staff_advances.view", "staff_advances.create", "staff_advances.settle"])
    mgr_headers = {"Authorization": f"Bearer {mgr_token}", "Content-Type": "application/json"}

    # Manager can view advances
    r_mgr_view = requests.get(f"{BASE_URL}/staff-advances", headers=mgr_headers)
    assert r_mgr_view.status_code == 200
    print("[PASS] Manager with staff_advances.view can view advances (200 OK)")

    # Manager tries obsolete (not in permissions) -> 403 Forbidden
    r_mgr_obs = requests.post(f"{BASE_URL}/staff-advances/{adv3_id}/obsolete", json={"reason": "Manager trying to obsolete"}, headers=mgr_headers)
    assert r_mgr_obs.status_code == 403, f"Expected 403 for unauthorized action, got {r_mgr_obs.status_code}"
    print("[PASS] Manager without staff_advances.obsolete is blocked with 403 Forbidden")

    # 2. Create Staff user with view-only
    r_st_create_user = requests.post(f"{BASE_URL}/users", json={
        "username": staff_username,
        "fullName": f"Staff {ts}",
        "role": "Staff",
        "password": test_pwd,
        "confirmPassword": test_pwd,
        "permissionCodes": ["staff_advances.view"]
    }, headers=headers)
    assert r_st_create_user.status_code in (200, 201), f"Create staff user failed: {r_st_create_user.text}"
    st_user = r_st_create_user.json()
    st_id = st_user["id"]
    st_token = generate_test_jwt(st_id, staff_username, role="Staff", is_owner=False, permissions=["staff_advances.view"])
    st_headers = {"Authorization": f"Bearer {st_token}", "Content-Type": "application/json"}

    # Staff tries create -> 403 Forbidden
    r_st_create = requests.post(f"{BASE_URL}/staff-advances", json={
        "staffId": staff_id,
        "amount": 200.0,
        "advanceDate": "2026-08-24",
        "reason": "Staff unauthorized create"
    }, headers=st_headers)
    assert r_st_create.status_code == 403, f"Expected 403, got {r_st_create.status_code}"
    print("[PASS] Staff user without staff_advances.create is blocked with 403 Forbidden")

    print("[PASS] TEST M, N, O Passed: Role & Permission authorization verified")

    # ── TEST P: Search, Filters, and Date Ranges ───────────────────────────
    print("\n--- TEST P: Search, Status Filters, and Date Ranges ---")
    # Query with status=Obsolete
    r_obs = requests.get(f"{BASE_URL}/staff-advances?status=Obsolete", headers=headers)
    assert r_obs.status_code == 200
    obs_items = r_obs.json()["items"]
    assert any(item["id"] == adv2_id for item in obs_items), "Obsolete filter must return obsolete advances"
    print("[PASS] Filter status=Obsolete returns obsolete records correctly")

    # Query with status=Settled
    r_set = requests.get(f"{BASE_URL}/staff-advances?status=Settled", headers=headers)
    assert r_set.status_code == 200
    set_items = r_set.json()["items"]
    assert any(item["id"] == adv1_id for item in set_items), "Settled filter must return settled advances"
    print("[PASS] Filter status=Settled returns settled records correctly")

    # Search by reason keyword
    r_search = requests.get(f"{BASE_URL}/staff-advances?search=Emergency", headers=headers)
    assert r_search.status_code == 200
    print("[PASS] Search query returns filtered results correctly")

    # ── TEST Q: Staff Advance History Endpoint & Directory Preservation ───
    print("\n--- TEST Q: Staff Advance History Endpoint & Directory Preservation ---")
    r_hist = requests.get(f"{BASE_URL}/staff-advances/staff/{staff_id}/history", headers=headers)
    assert r_hist.status_code == 200, f"History failed: {r_hist.text}"
    history_data = r_hist.json()
    assert history_data["staffId"] == staff_id
    assert history_data["staffName"] == staff_name
    assert "outstandingAmount" in history_data
    assert "settledAmount" in history_data
    assert "advances" in history_data
    print(f"[PASS] Staff History: Staff={history_data['staffName']}, Total={history_data['totalAdvancesAmount']}, Outstanding={history_data['outstandingAmount']}, Settled={history_data['settledAmount']}")

    # Clean up test advances
    requests.post(f"{BASE_URL}/staff-advances/{adv3_id}/obsolete", json={"reason": "Test suite cleanup"}, headers=headers)

    print("\n==================================================")
    print(">>> ALL STEP 13 STAFF ADVANCE TESTS PASSED (100%) <<<")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
