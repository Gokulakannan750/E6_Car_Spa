import os

filepath = r'E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backend\api\CarSpaManagement.Api\Application\Services\JobCardService.cs'

with open(filepath, 'r') as f:
 lines = f.readlines()

start_idx = None
end_idx = None

for i, line in enumerate(lines):
 if '// Create the sequence if it doesn' in line:
 start_idx = i
 if start_idx is not None and '// Get the next value' in line:
 end_idx = i
 break

if start_idx is not None and end_idx is not None:
 output_lines = lines[:start_idx] + lines[end_idx:]
 with open(filepath, 'w') as f:
 f.writelines(output_lines)
 print(f"Removed lines {start_idx + 1} through {end_idx}")
else:
 print(f"Not found: start={start_idx}, end={end_idx}")
 for i, line in enumerate(lines[358:385], start=359):
 print(f"{i}: {repr(line)}")
