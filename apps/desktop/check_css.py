import re

css = open('renderer/dist-renderer/assets/index-2KCXjviW.css').read()
utils = set()
for m in re.finditer(r'\.([a-zA-Z0-9_-]+)(?=\{)', css):
 utils.add(m.group(1))

classes = ['space-y-5','space-y-4','py-2.5','gap-2','hover:bg-blue-700','hover:underline','focus:ring-2','focus:ring-blue-500','focus:border-transparent','disabled:bg-blue-400','disabled:cursor-not-allowed','bg-white/10','border-white/30','placeholder-gray-400']
print("=== Previously missing ===")
missing = 0
for c in classes:
 if c in utils:
 print(" PRESENT: ."+c)
 else:
 missing += 1
 print(" MISSING: ."+c)
print("All present:", missing == 0)

core = ['flex','w-full','max-w-sm','min-h-screen','bg-gray-50','bg-blue-600','text-white','rounded-xl']
print("\n=== Core utilities ===")
for c in core:
 if c in utils:
 print(" OK: ."+c)
 else:
 print(" MISSING: ."+c)
