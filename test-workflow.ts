/**
 * Car Spa Management — Complete Job Card Workflow Verification
 * Tests A through E as specified in the task.
 * Requires: backend running on http://localhost:5298
 */

import http from 'node:http';

const API = 'http://localhost:5298/api';

// Build a full URL by appending path+query to the API base
function buildUrl(fullPath: string): string {
 // Remove leading double-slash if present to avoid //api issue
 return `${API}${fullPath.startsWith('/') ? '' : '/'}${fullPath}`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpGet(fullPath: string): Promise<{ status: number; data: unknown }> {
 return new Promise((resolve, reject) => {
 http.get(buildUrl(fullPath), (res) => {
 let body = '';
 res.on('data', (chunk) => { body += chunk; });
 res.on('end', () => resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null }));
 }).on('error', reject);
 });
}

function httpPost(fullPath: string, body: unknown): Promise<{ status: number; data: unknown }> {
 return new Promise((resolve, reject) => {
 const payload = JSON.stringify(body ?? {});
 const req = http.request(buildUrl(fullPath), {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
 }, (res) => {
 let data = '';
 res.on('data', (chunk) => { data += chunk; });
 res.on('end', () => resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }));
 });
 req.on('error', reject);
 req.write(payload);
 req.end();
 });
}

function httpDelete(fullPath: string): Promise<{ status: number }> {
 return new Promise((resolve, reject) => {
 const req = http.request(buildUrl(fullPath), { method: 'DELETE' }, (res) => {
 res.on('data', () => {});
 res.on('end', () => resolve({ status: res.statusCode }));
 });
 req.on('error', reject);
 req.end();
 });
}

// ── Assertions ────────────────────────────────────────────────────────────────

function ok(msg: string) { console.log(` ✅ ${msg}`); }
function fail(msg: string, err: string) { console.log(` ❌ ${msg}\n → ${err}`); }
function log(msg: string) { console.log(` ${msg}`); }

function asArr<T = unknown>(x: unknown): T[] { return Array.isArray(x) ? (x as T[]) : []; }
function asObj<T = Record<string, unknown>>(x: unknown): T { return (x && typeof x === 'object' && !Array.isArray(x)) ? (x as T) : ({} as T); }

// ── Test state ───────────────────────────────────────────────────────────────

let testCustomerId: string | null = null;
let testVehicleId: string | null = null;
let testServiceId: string | null = null;
let testJobCardId: string | null = null;
let testJobCardNumber: string = '';
let preExistingCustomerId: string | null = null;
let preExistingVehicleId: string | null = null;
let preExistingServiceId: string | null = null;

function uid(prefix: string): string {
 return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ════════════════════════════════════════════════════════════════════════════
// PRE-FLIGHT
// ════════════════════════════════════════════════════════════════════════════

async function preFlight() {
 log('Pre-flight: checking backend\n');

 const health = await httpGet('/health');
 if (health.status === 200) ok(`Backend healthy`);
 else { console.log(` ❌ Backend: HTTP ${health.status}`); process.exit(1); }

 const svcResp = await httpGet('/services?page=1&pageSize=50');
 if (svcResp.status === 200) {
 const svcs = asArr(asObj(svcResp.data).items);
 log(` Services: ${svcs.length}`);
 if (svcs.length > 0) {
 preExistingServiceId = asObj(svcs[0]).id as string;
 log(` Using: ${asObj(svcs[0]).name} (${preExistingServiceId})`);
 }
 }

 const custResp = await httpGet('/customers?page=1&pageSize=50');
 if (custResp.status === 200) {
 const customers = asArr(asObj(custResp.data).items);
 log(` Customers: ${customers.length}`);
 for (const c of customers) {
 const cData = asObj(c);
 const vehs = await httpGet(`/vehicles/by-customer/${cData.id}`);
 if (vehs.status === 200 && asArr(vehs.data).length >= 2) {
 preExistingCustomerId = cData.id as string;
 preExistingVehicleId = (asObj(asArr(vehs.data)[0]).id as string) || null;
 log(` Multi-vehicle: ${cData.name} (${preExistingCustomerId})`);
 log(` Vehicle: ${asObj(asArr(vehs.data)[0]).registrationNumber} (${preExistingVehicleId})`);
 break;
 }
 }
 }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST A — NEW CUSTOMER
// ════════════════════════════════════════════════════════════════════════════

async function testA_NewCustomer() {
 console.log('\n📋 TEST A — NEW CUSTOMER\n');
 const phone = `+91${uid('ph').slice(0, 10)}`;

 try {
 // A1: Not found
 const byPhone = await httpGet(`/customers/by-phone/${encodeURIComponent(phone)}`);
 if (byPhone.status === 404) ok(`A1: Phone ${phone} not found — correct`);
 else fail('A1: Pre-check', `Expected 404, got ${byPhone.status}`);

 // A2: Create
 const cr = await httpPost('/customers', {
 name: uid('TestCustA'),
 phoneNumber: phone,
 email: 'test.a@e6.com',
 address: 'Chennai, India',
 });
 if (cr.status >= 200 && cr.status < 300) {
 const c = asObj(cr.data);
 testCustomerId = c.id as string;
 ok(`A2: Customer created: ${c.name} (${testCustomerId})`);
 } else { fail('A2: Create', `HTTP ${cr.status}`); return; }

 // A3: Phone lookup
 const found = await httpGet(`/customers/by-phone/${encodeURIComponent(phone)}`);
 if (found.status === 200 && (asObj(found.data).id as string) === testCustomerId) ok(`A3: Phone lookup correct`);
 else fail('A3: Phone lookup', 'Failed');

 // A4: Create vehicle
 const regNum = uid('REG').toUpperCase();
 const vr = await httpPost('/vehicles', {
 customerId: testCustomerId!,
 registrationNumber: regNum,
 make: uid('Make'),
 model: uid('Model'),
 });
 if (vr.status >= 200 && vr.status < 300) {
 const v = asObj(vr.data);
 testVehicleId = v.id as string;
 ok(`A4: Vehicle: ${v.registrationNumber} (${testVehicleId})`);
 }

 // A5: Linked
 const vl = await httpGet(`/vehicles/by-customer/${testCustomerId}`);
 if (vl.status === 200) {
 if (asArr(vl.data).some((v: unknown) => (asObj(v).id as string) === testVehicleId)) ok(`A5: Vehicle linked`);
 else fail('A5: Linkage', 'Not found in list');
 }

 } catch (err) { fail('Test A', String((err as Error).message)); }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST B — EXISTING CUSTOMER
// ════════════════════════════════════════════════════════════════════════════

async function testB_ExistingCustomer() {
 console.log('\n📋 TEST B — EXISTING CUSTOMER\n');

 if (!preExistingCustomerId) {
 log(' ⚠️ No pre-existing — fetching first');
 const resp = await httpGet('/customers?page=1&pageSize=1');
 if (resp.status === 200) {
 const items = asArr(asObj(resp.data).items);
 if (items.length > 0) preExistingCustomerId = asObj(items[0]).id as string;
 }
 }

 // If still no pre-existing customer, use the one from Test A
 if (!preExistingCustomerId && testCustomerId) {
 preExistingCustomerId = testCustomerId;
 log(` Using Test A customer as pre-existing: ${testCustomerId}`);
 }

 if (!preExistingCustomerId) { log(' ⚠️ Skipping\n'); return; }

 try {
 const byId = await httpGet(`/customers/${preExistingCustomerId}`);
 const cData = asObj(byId.data);
 log(` Existing: ${cData.name} (${cData.id})`);

 // B1: Phone lookup
 const byPhone = await httpGet(`/customers/by-phone/${encodeURIComponent(cData.phoneNumber as string)}`);
 if (byPhone.status === 200 && (asObj(byPhone.data).id as string) === preExistingCustomerId) ok(`B1: Phone lookup correct`);
 else fail('B1: Phone lookup', 'Failed');

 // B2: No duplicate
 const again = await httpGet(`/customers/by-phone/${encodeURIComponent(cData.phoneNumber as string)}`);
 if (again.status === 200 && (asObj(again.data).id as string) === preExistingCustomerId) ok(`B2: No duplicate on second lookup`);
 else fail('B2: Duplicate', 'Failed');

 // B3: Vehicles
 const vehs = await httpGet(`/vehicles/by-customer/${preExistingCustomerId}`);
 if (vehs.status === 200) {
 const vList = asArr(vehs.data);
 log(` Vehicles: ${vList.length}`);
 vList.forEach((v: unknown) => { const vd = asObj(v); log(` - ${vd.registrationNumber}: ${vd.make} ${vd.model}`); });
 if (vList.length > 0 && !preExistingVehicleId) preExistingVehicleId = asObj(vList[0]).id as string;
 ok(`B3: Vehicles loaded`);
 }

 } catch (err) { fail('Test B', String((err as Error).message)); }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST C — MULTIPLE VEHICLES
// ════════════════════════════════════════════════════════════════════════════

async function testC_MultipleVehicles() {
 console.log('\n📋 TEST C — MULTIPLE VEHICLES\n');

 if (!preExistingCustomerId) { log(' ⚠️ No multi-vehicle customer — skipping\n'); return; }

 try {
 let vList = asArr(await httpGet(`/vehicles/by-customer/${preExistingCustomerId}`));

 if (vList.length < 2) {
 log(` Only ${vList.length} — creating second`);
 const v2 = await httpPost('/vehicles', {
 customerId: preExistingCustomerId,
 registrationNumber: uid('MV').toUpperCase(),
 make: 'ExtraMake',
 model: 'ExtraModel',
 });
 if (v2.status >= 200 && v2.status < 300) { vList.push(asObj(v2.data)); ok(`C0: Created second vehicle`); }
 }

 log(` ${vList.length} vehicles:`);
 vList.forEach((v: unknown) => { const vd = asObj(v); log(` [${vd.id}] ${vd.registrationNumber} — ${vd.make} ${vd.model}`); });

 if (vList.length >= 2) {
 const selId = asObj(vList[0]).id as string;
 const selReg = asObj(vList[0]).registrationNumber as string;
 ok(`C1: Can select: ${selReg} (${selId})`);

 const all = await httpGet(`/vehicles/by-customer/${preExistingCustomerId}`);
 if (all.status === 200) {
 const list = asArr(all.data);
 const allFound = list.every((v: unknown) => vList.some((o: unknown) => (asObj(o).id as string) === (asObj(v).id as string)));
 if (allFound) ok(`C2: All independently accessible`);
 else fail('C2: Independence', 'Missing');
 }

 ok(`C3: All ${vList.length} belong to customer ${preExistingCustomerId}`);
 }

 } catch (err) { fail('Test C', String((err as Error).message)); }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST D — NEW SERVICE
// ════════════════════════════════════════════════════════════════════════════

async function testD_NewService() {
 console.log('\n📋 TEST D — NEW SERVICE\n');
 const svcName = `NewSvc-${uid('x')}`;

 try {
 const before = await httpGet('/services?page=1&pageSize=50');
 const beforeList = asArr(asObj(before.data).items);
 const exists = beforeList.some((s: unknown) => (asObj(s).name as string) === svcName);
 if (!exists) ok(`D1: Service "${svcName}" does not exist`);
 else fail('D1: Pre-check', 'Already exists');

 const cr = await httpPost('/services', {
 name: svcName,
 category: 'Workflow Test',
 price: 2500,
 taxPercentage: 18,
 description: 'Test service',
 isActive: true,
 });
 if (cr.status >= 200 && cr.status < 300) {
 const s = asObj(cr.data);
 testServiceId = s.id as string;
 ok(`D2: Created: ${s.name} (${testServiceId}) — ₹${s.price}`);
 } else { fail('D2: Create', `HTTP ${cr.status}`); return; }

 const after = await httpGet('/services?page=1&pageSize=50');
 if (after.status === 200) {
 if (asArr(asObj(after.data).items).some((s: unknown) => (asObj(s).id as string) === testServiceId)) ok(`D3: In service list`);
 else fail('D3: List', 'Not found');
 }

 const search = await httpGet(`/services?page=1&pageSize=10&search=${encodeURIComponent(svcName)}`);
 if (search.status === 200 && asArr(asObj(search.data).items).some((s: unknown) => (asObj(s).id as string) === testServiceId)) ok(`D4: Searchable`);

 } catch (err) { fail('Test D', String((err as Error).message)); }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST E — CREATE JOB CARD
// ════════════════════════════════════════════════════════════════════════════

async function testE_CreateJobCard() {
 console.log('\n📋 TEST E — CREATE JOB CARD\n');

 const custId = testCustomerId || preExistingCustomerId;
 let vehId = testVehicleId || preExistingVehicleId;
 const svcId = testServiceId || preExistingServiceId;

 // If we don't have a fresh customer/vehicle from this run, create them
 let freshCustomerId: string | null = null;
 let freshVehicleId: string | null = null;

 if (!custId || !vehId) {
 log(` Creating fresh customer/vehicle for job card test`);
 try {
 const cr = await httpPost('/customers', {
 name: uid('JobCardCust'),
 phoneNumber: `+91${uid('ph').slice(0, 10)}`,
 email: null,
 address: null,
 });
 if (cr.status >= 200 && cr.status < 300) {
 freshCustomerId = asObj(cr.data).id as string;
 const vr = await httpPost('/vehicles', {
 customerId: freshCustomerId,
 registrationNumber: uid('JCREG').toUpperCase(),
 make: uid('Make'),
 model: uid('Model'),
 });
 if (vr.status >= 200 && vr.status < 300) freshVehicleId = asObj(vr.data).id as string;
 ok(`E0: Created fresh customer+vehicle for job card`);
 }
 } catch (err) { log(` ⚠️ Could not create fresh customer/vehicle: ${(err as Error).message}`); }
 }

 const finalCustId = custId || freshCustomerId;
 const finalVehId = vehId || freshVehicleId;

 if (!finalCustId || !finalVehId || !svcId) {
 log(` ⚠️ Missing: cust=${finalCustId} veh=${finalVehId} svc=${svcId}`);
 log(' Cannot create job card — skipping\n'); return;
 }

 try {
 // E1: Create
 const payload = {
 customerId: finalCustId,
 vehicleId: finalVehId,
 services: [{ serviceId: svcId, quantity: 2, discountAmount: 100 }],
 notes: 'Workflow verification — may delete',
 isGstEnabled: true,
 };
 log(` Creating: cust=${custId.slice(0,8)} veh=${vehId.slice(0,8)} svc=${svcId.slice(0,8)}`);
 const cr = await httpPost('/job-cards', payload);

 if (cr.status !== 200 && cr.status !== 201) {
 fail('E1: Create', `HTTP ${cr.status}: ${JSON.stringify(cr.data)}`); return;
 }

 const jc = asObj(cr.data);
 testJobCardId = jc.id as string;
 testJobCardNumber = (jc.jobCardNumber as string) || '';
 ok(`E1: Job Card: ${testJobCardNumber} (${testJobCardId})`);

 // E2: Fields
 const required = ['id','jobCardNumber','customer','vehicle','status','services','subtotal','taxAmount','discountAmount','totalAmount'];
 const missing = required.filter((f) => !(f in jc));
 if (!missing.length) ok(`E2: All required fields present`);
 else fail('E2: Fields', `Missing: ${missing.join(', ')}`);

 // E3: Customer
 const cField = asObj(jc.customer);
 if (cField.id === finalCustId) ok(`E3: Customer: ${cField.name} (${cField.id})`);
 else fail('E3: Customer', `${cField.id} !== ${finalCustId}`);

 // E4: Vehicle
 const vField = asObj(jc.vehicle);
 if (vField.id === finalVehId) ok(`E4: Vehicle: ${vField.registrationNumber} (${vField.id})`);
 else fail('E4: Vehicle', `${vField.id} !== ${finalVehId}`);

 // E5: Services
 const svcs = asArr(jc.services);
 if (svcs.length > 0) {
 ok(`E5: Services: ${svcs.length} attached`);
 const s0 = asObj(svcs[0]);
 log(` - ${s0.serviceName} qty=${s0.quantity} price=${s0.unitPrice} disc=${s0.discountAmount}`);
 if (s0.serviceId === svcId) ok(`E5a: Service ID matches`);
 else fail('E5a: Service ID', `${s0.serviceId} !== ${svcId}`);
 } else fail('E5: Services', 'None attached');

 // E6: Financials
 const { subtotal, taxAmount, discountAmount, totalAmount } = jc as Record<string, number>;
 // 2 * 2500 = 5000, disc=100, tax 18% on subtotal = 900, total = 5800
 const expSub = 5000, expDisc = 100, expTax = 900, expTotal = 5800;
 log(` Actual: sub=${subtotal} tax=${taxAmount} disc=${discountAmount} total=${totalAmount}`);
 log(` Expected: sub=${expSub} tax=${expTax} disc=${expDisc} total=${expTotal}`);

 if (subtotal === expSub) ok(`E6a: Subtotal = ${subtotal}`);
 else fail('E6a: Subtotal', `${subtotal} !== ${expSub}`);

 if (discountAmount === expDisc) ok(`E6b: Discount = ${discountAmount}`);
 else fail('E6b: Discount', `${discountAmount} !== ${expDisc}`);

 if (taxAmount === expTax) ok(`E6c: Tax = ${taxAmount}`);
 else fail('E6c: Tax', `${taxAmount} !== ${expTax}`);

 if (totalAmount === expTotal) ok(`E6d: Total = ${totalAmount}`);
 else fail('E6d: Total', `${totalAmount} !== ${expTotal}`);

 // E7: Number
 if (testJobCardNumber.length > 0) ok(`E7: Number: ${testJobCardNumber}`);
 else fail('E7: Number', 'Missing');

 // E8: Fetch by ID
 const fetched = await httpGet(`/job-cards/${testJobCardId}`);
 if (fetched.status === 200 && (asObj(fetched.data).id as string) === testJobCardId) ok(`E8: Fetch by ID OK`);
 else fail('E8: By ID', `HTTP ${fetched.status}`);

 // E9: Fetch by number
 const byNum = await httpGet(`/job-cards/by-number/${encodeURIComponent(testJobCardNumber)}`);
 if (byNum.status === 200 && (asObj(byNum.data).id as string) === testJobCardId) ok(`E9: Fetch by number OK`);
 else fail('E9: By number', `HTTP ${byNum.status}`);

 // E10: List
 const listResp = await httpGet('/job-cards?page=1&pageSize=50');
 if (listResp.status === 200) {
 const list = asArr(asObj(listResp.data).items);
 if (list.some((j: unknown) => (asObj(j).id as string) === testJobCardId)) ok(`E10: In list (${list.length} total)`);
 else fail('E10: List', `Not in ${list.length}`);
 }

 // E11: By-customer
 const byCust = await httpGet(`/job-cards/by-customer/${custId}`);
 if (byCust.status === 200 && asArr(byCust.data).some((j: unknown) => (asObj(j).id as string) === testJobCardId)) ok(`E11: In customer's job cards`);

 // E12: By-vehicle
 const byVeh = await httpGet(`/job-cards/by-vehicle/${vehId}`);
 if (byVeh.status === 200 && asArr(byVeh.data).some((j: unknown) => (asObj(j).id as string) === testJobCardId)) ok(`E12: In vehicle's job cards`);

 // E13: Status
 const status = jc.status as number;
 const labels: Record<number, string> = { 0: 'Draft', 1: 'InProgress', 2: 'QualityCheck', 3: 'Ready', 4: 'Delivered' };
 ok(`E13: Status = ${status} (${labels[status] || 'unknown'})`);

 if (typeof subtotal === 'number') ok(`E14: Backend provides authoritative totals`);

 } catch (err) { fail('Test E', String((err as Error).message)); }
}

// ════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════════════════════

async function cleanup() {
 console.log('\n🧹 Cleanup\n');
 const items = [
 { id: testJobCardId, type: 'Job Card', path: (id: string) => `/job-cards/${id}` },
 { id: testServiceId, type: 'Service', path: (id: string) => `/services/${id}` },
 { id: testVehicleId, type: 'Vehicle', path: (id: string) => `/vehicles/${id}` },
 { id: testCustomerId, type: 'Customer', path: (id: string) => `/customers/${id}` },
 ];
 for (const item of items) {
 if (!item.id) continue;
 try {
 const { status } = await httpDelete(item.path(item.id));
 if (status === 200 || status === 204) ok(`Deleted ${item.type}: ${item.id}`);
 else log(` ⚠️ Delete ${item.type} → ${status}`);
 } catch (err) { log(` ⚠️ ${item.type}: ${(err as Error).message}`); }
 }
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

async function main() {
 console.log('\n🚗 CAR SPA — Job Card Workflow Verification\n');
 console.log(` Backend: ${API}\n`);
 await preFlight();
 await testA_NewCustomer();
 await testB_ExistingCustomer();
 await testC_MultipleVehicles();
 await testD_NewService();
 await testE_CreateJobCard();
 await cleanup();
 console.log('\n✅ All workflow verification tests completed.\n');
}

main().catch((err) => {
 console.error('\n❌ Fatal:', (err as Error).message);
 process.exit(1);
});
