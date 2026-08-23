import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:5298/api'

def req(method, path, data=None):
    url = f"{BASE}{path}"
    headers = {'Content-Type': 'application/json'}
    body = json.dumps(data).encode('utf-8') if data else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as resp:
            content = resp.read().decode('utf-8')
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {'raw': err_body}

print("=== STEP 12: JOB CARD -> INVOICE WORKFLOW STATUS TEST SUITE ===")

# 1. Fetch customers and services to create fresh test job cards
_, custs = req('GET', '/customers')
customer_id = custs['items'][0]['id']

_, vehs = req('GET', f"/vehicles/by-customer/{customer_id}")
vehicle_id = vehs[0]['id']

_, svcs = req('GET', '/services')
active_svcs = [s for s in svcs['items'] if s.get('isActive', True)]
service_id = active_svcs[0]['id']

print(f"Customer: {customer_id}, Vehicle: {vehicle_id}, Service: {active_svcs[0]['name']} ({service_id})")

# Create Job Card 1 (State A: No Invoice)
print("\n--- TEST A: Create Job Card without invoice (State A) ---")
st, jc1 = req('POST', '/job-cards', {
    'customerId': customer_id,
    'vehicleId': vehicle_id,
    'services': [{'serviceId': service_id, 'quantity': 1, 'discountAmount': 0}],
    'notes': 'Test JC 1 - No Invoice'
})
print("POST /job-cards response:", st, jc1)
print(f"Created JC1: {jc1.get('jobCardNumber')} ({jc1.get('id')})")
assert jc1['invoiceId'] is None
assert jc1['invoiceNumber'] is None
assert jc1['invoiceStatus'] is None

# Query Job Cards list and check JC1
st, list_res = req('GET', f"/job-cards?search={jc1['jobCardNumber']}")
jc1_list = list_res['items'][0]
print(f"List JC1: invoiceId={jc1_list.get('invoiceId')}, invoiceNumber={jc1_list.get('invoiceNumber')}, invoiceStatus={jc1_list.get('invoiceStatus')}")
assert jc1_list['invoiceId'] is None
print(">> State A verified: Button = 'Convert to Invoice'")

# Create Job Card 2 (State B: Draft Invoice)
print("\n--- TEST B: Convert Job Card to Draft Invoice (State B) ---")
st, jc2 = req('POST', '/job-cards', {
    'customerId': customer_id,
    'vehicleId': vehicle_id,
    'services': [{'serviceId': service_id, 'quantity': 1, 'discountAmount': 0}],
    'notes': 'Test JC 2 - Draft Invoice'
})
print(f"Created JC2: {jc2['jobCardNumber']} ({jc2['id']})")

# Convert to invoice
st, inv2 = req('POST', f"/invoices/from-job-card/{jc2['id']}")
print(f"Converted to Invoice: Id={inv2['id']}, Status={inv2['status']}, Number={inv2['invoiceNumber']}")
assert inv2['invoiceNumber'] is None

# Query Job Cards list and check JC2
st, list_res = req('GET', f"/job-cards?search={jc2['jobCardNumber']}")
jc2_list = list_res['items'][0]
print(f"List JC2: invoiceId={jc2_list.get('invoiceId')}, invoiceNumber={jc2_list.get('invoiceNumber')}, invoiceStatus={jc2_list.get('invoiceStatus')}")
assert jc2_list['invoiceId'] == inv2['id']
assert jc2_list['invoiceNumber'] is None
assert jc2_list['invoiceStatus'] in ('Draft', '0')
print(">> State B verified: Button = 'Invoice Drafted'")

# Create Job Card 3 (State C: Finalized Invoice)
print("\n--- TEST C: Convert and Finalize Invoice (State C) ---")
st, jc3 = req('POST', '/job-cards', {
    'customerId': customer_id,
    'vehicleId': vehicle_id,
    'services': [{'serviceId': service_id, 'quantity': 1, 'discountAmount': 0}],
    'notes': 'Test JC 3 - Finalized Invoice'
})
print(f"Created JC3: {jc3['jobCardNumber']} ({jc3['id']})")

st, inv3 = req('POST', f"/invoices/from-job-card/{jc3['id']}")
st, finalized3 = req('POST', f"/invoices/{inv3['id']}/generate")
print(f"Finalized Invoice: Id={finalized3['id']}, Number={finalized3['invoiceNumber']}, Status={finalized3['status']}")
assert finalized3['invoiceNumber'] is not None

# Query Job Cards list and check JC3
st, list_res = req('GET', f"/job-cards?search={jc3['jobCardNumber']}")
jc3_list = list_res['items'][0]
print(f"List JC3: invoiceId={jc3_list.get('invoiceId')}, invoiceNumber={jc3_list.get('invoiceNumber')}, invoiceStatus={jc3_list.get('invoiceStatus')}")
assert jc3_list['invoiceId'] == finalized3['id']
assert jc3_list['invoiceNumber'] == finalized3['invoiceNumber']
assert jc3_list['invoiceStatus'] in ('Generated', '6')
print(">> State C verified: Button = 'Invoice Generated'")

# TEST D: Duplicate conversion prevention & HTTP 409
print("\n--- TEST D: Prevent duplicate invoice creation ---")
st, err = req('POST', f"/invoices/from-job-card/{jc3['id']}")
print(f"Duplicate convert status: {st} (Expected: 409 Conflict), Detail: {err}")
assert st == 409

# TEST G: Multiple Job Cards simultaneously
print("\n--- TEST G: Multiple Job Cards in list ---")
st, all_jcs = req('GET', '/job-cards?pageSize=10')
for j in all_jcs['items']:
    inv_id = j.get('invoiceId')
    inv_num = j.get('invoiceNumber')
    inv_st = j.get('invoiceStatus')
    
    if not inv_id:
        btn = "Convert to Invoice (Primary Blue)"
    elif (inv_st == 'Draft' or inv_st == '0' or not inv_st) and not inv_num:
        btn = "Invoice Drafted (Amber)"
    else:
        btn = f"Invoice Generated (Green, #{inv_num})"
    
    print(f"  * {j['jobCardNumber']}: Status={j['status']} -> {btn}")

print("\n>>> ALL STEP 12 TESTS PASSED PERFECTLY! <<<")
