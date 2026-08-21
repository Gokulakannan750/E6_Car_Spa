import os

files = [
 'apps/desktop/renderer/src/lib/api.ts',
 'apps/desktop/renderer/src/components/CustomerHistoryDialog.tsx',
 'apps/desktop/renderer/src/features/customers/CustomersPage.tsx',
 'apps/desktop/renderer/src/features/job-cards/JobCardsPage.tsx',
 'apps/desktop/renderer/src/features/job-cards/JobCardDetails.tsx',
 'apps/desktop/renderer/src/features/catalogue/CataloguePage.tsx',
 'apps/desktop/renderer/src/features/quotations-invoices/InvoiceEditor.tsx',
]

for f in files:
 if not os.path.exists(f):
 print(f'File not found: {f}')
 continue
 with open(f, 'r', encoding='utf-8') as fh:
 content = fh.read()

 if ' || i || m || p || o || r || t' in content or ' || c || o || n || s || t' in content:
 print(f'Fixing corruption in {f}')
 content = content.replace(' || ', '')
 with open(f, 'w', encoding='utf-8') as fh:
 fh.write(content)
 print(f'Fixed {f}')
 else:
 print(f'Skipping {f} (not corrupted)')
