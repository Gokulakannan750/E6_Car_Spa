import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:5298"

def req(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as res:
            res_body = res.read().decode("utf-8")
            return res.status, json.loads(res_body) if res_body else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        return e.code, json.loads(err_body) if err_body else None

def run_tests():
    print("=== STARTING SHOWROOM MODULE E2E TEST ===")
    
    # 1. Health check
    status, health = req("/api/health")
    print(f"Health Check: status={status}")
    assert status == 200, "Backend health check failed"

    # 2. Get Staff list
    status, staff_list = req("/api/staff-advances/staff")
    print(f"Fetch Staff List: status={status}, count={len(staff_list) if staff_list else 0}")
    assert status == 200 and len(staff_list) >= 2, "Need at least 2 staff members"
    staff1 = staff_list[0]
    staff2 = staff_list[1]
    print(f"Using Staff 1: {staff1['name']} ({staff1['id']})")
    print(f"Using Staff 2: {staff2['name']} ({staff2['id']})")

    # 3. Create Showroom 1: Erode Showroom
    erode_payload = {
        "name": "Erode Showroom (Test)",
        "address": "12, Brough Road, Erode, Tamil Nadu",
        "phone": "0424-2223344",
        "isActive": True
    }
    status, erode_sr = req("/api/showrooms", method="POST", data=erode_payload)
    print(f"Create Erode Showroom: status={status}, id={erode_sr.get('id') if erode_sr else None}")
    assert status == 201, f"Failed to create Erode Showroom: {erode_sr}"
    erode_id = erode_sr["id"]

    # 4. Create Showroom 2: Salem Showroom
    salem_payload = {
        "name": "Salem Showroom (Test)",
        "address": "45, Meyyanur Road, Salem, Tamil Nadu",
        "phone": "0427-2445566",
        "isActive": True
    }
    status, salem_sr = req("/api/showrooms", method="POST", data=salem_payload)
    print(f"Create Salem Showroom: status={status}, id={salem_sr.get('id') if salem_sr else None}")
    assert status == 201, f"Failed to create Salem Showroom: {salem_sr}"
    salem_id = salem_sr["id"]

    # 5. List Showrooms
    status, all_sr = req("/api/showrooms")
    print(f"Get All Showrooms: status={status}, total={len(all_sr)}")
    assert status == 200, "Failed to get showrooms"

    # 6. Assign Staff 1 to Erode Showroom on 2026-08-23 with 8 vehicles
    assign1_data = {
        "staffId": staff1["id"],
        "date": "2026-08-23T00:00:00Z",
        "vehiclesAttended": 8
    }
    status, assign1 = req(f"/api/showrooms/{erode_id}/daily-staff", method="POST", data=assign1_data)
    print(f"Assign Staff 1 (8 vehicles): status={status}, id={assign1.get('id') if assign1 else None}")
    assert status == 200, f"Failed to assign staff 1: {assign1}"
    assign1_id = assign1["id"]

    # 7. Assign Staff 2 to Erode Showroom on 2026-08-23 with 6 vehicles
    assign2_data = {
        "staffId": staff2["id"],
        "date": "2026-08-23T00:00:00Z",
        "vehiclesAttended": 6
    }
    status, assign2 = req(f"/api/showrooms/{erode_id}/daily-staff", method="POST", data=assign2_data)
    print(f"Assign Staff 2 (6 vehicles): status={status}, id={assign2.get('id') if assign2 else None}")
    assert status == 200, f"Failed to assign staff 2: {assign2}"
    assign2_id = assign2["id"]

    # 8. Query Daily Staff for Erode Showroom on 2026-08-23
    status, daily_resp = req(f"/api/showrooms/{erode_id}/daily-staff?date=2026-08-23")
    print(f"Get Daily Staff: status={status}, totalVehicles={daily_resp.get('totalVehiclesAttended')}")
    assert status == 200, "Failed to get daily staff"
    assert daily_resp["totalVehiclesAttended"] == 14, f"Expected 14 total vehicles, got {daily_resp['totalVehiclesAttended']}"
    assert len(daily_resp["staffAssignments"]) == 2, f"Expected 2 assignments, got {len(daily_resp['staffAssignments'])}"

    # 9. Test DUPLICATE prevention: Re-assign Staff 1 to Erode Showroom on 2026-08-23
    status, dup_resp = req(f"/api/showrooms/{erode_id}/daily-staff", method="POST", data=assign1_data)
    print(f"Duplicate Assignment Attempt: status={status} (Expected 409 Conflict), response={dup_resp}")
    assert status == 409, f"Expected 409 Conflict on duplicate assignment, got {status}"

    # 10. Test CROSS-SHOWROOM on DIFFERENT DATE: Assign Staff 1 to Salem Showroom on 2026-08-24
    salem_assign_data = {
        "staffId": staff1["id"],
        "date": "2026-08-24T00:00:00Z",
        "vehiclesAttended": 12
    }
    status, salem_assign = req(f"/api/showrooms/{salem_id}/daily-staff", method="POST", data=salem_assign_data)
    print(f"Assign Staff 1 to Salem on 2026-08-24 (12 vehicles): status={status}")
    assert status == 200, f"Expected cross-showroom assignment on different date to succeed, got {status}"

    # 11. Update Staff 1 vehicle count from 8 to 10
    status, update_resp = req(f"/api/showroom-staff-assignments/{assign1_id}", method="PUT", data={"vehiclesAttended": 10})
    print(f"Update Staff 1 vehicles to 10: status={status}, vehiclesAttended={update_resp.get('vehiclesAttended') if update_resp else None}")
    assert status == 200 and update_resp["vehiclesAttended"] == 10, f"Failed to update vehicle count: {update_resp}"

    # 12. Verify updated Total Vehicles Attended = 10 + 6 = 16
    status, daily_resp2 = req(f"/api/showrooms/{erode_id}/daily-staff?date=2026-08-23")
    print(f"Recalculated Daily Total: status={status}, totalVehicles={daily_resp2.get('totalVehiclesAttended')}")
    assert status == 200 and daily_resp2["totalVehiclesAttended"] == 16, f"Expected 16, got {daily_resp2.get('totalVehiclesAttended')}"

    # 13. Remove Staff 2 assignment
    status, _ = req(f"/api/showroom-staff-assignments/{assign2_id}", method="DELETE")
    print(f"Remove Staff 2 Assignment: status={status} (Expected 204)")
    assert status == 204, f"Failed to delete assignment: status={status}"

    # 14. Verify updated Total Vehicles Attended = 10
    status, daily_resp3 = req(f"/api/showrooms/{erode_id}/daily-staff?date=2026-08-23")
    print(f"Total after Staff 2 removal: totalVehicles={daily_resp3.get('totalVehiclesAttended')}, count={len(daily_resp3['staffAssignments'])}")
    assert daily_resp3["totalVehiclesAttended"] == 10 and len(daily_resp3["staffAssignments"]) == 1

    # 15. Toggle Showroom Active
    status, _ = req(f"/api/showrooms/{erode_id}/toggle-active", method="PATCH")
    print(f"Toggle Active Showroom: status={status}")
    assert status == 204, f"Failed to toggle active: status={status}"

    # 16. Soft-delete Test Showrooms
    status, _ = req(f"/api/showrooms/{erode_id}", method="DELETE")
    print(f"Soft delete Erode Showroom: status={status}")
    assert status == 204, "Failed to delete showroom"

    status, _ = req(f"/api/showrooms/{salem_id}", method="DELETE")
    print(f"Soft delete Salem Showroom: status={status}")
    assert status == 204, "Failed to delete showroom"

    print("=== ALL 16 TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
