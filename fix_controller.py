with open(r'E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backend\api\CarSpaManagement.Api\Controllers\JobCardsController.cs', 'r', encoding='utf-8') as f:
 content = f.read()

idx = content.find(' }\n\n\t[HttpPut("{id:guid}/services")]')
if idx == -1:
 idx2 = content.find('[HttpPut("{id:guid}/services")]')
 print("Pattern not found, trying alternatives...")
 print(f"Found HttpPut at index {idx2}")
 print(repr(content[idx2-30:idx2+10]))
else:
 print(f"Found at index {idx}")
 content = content[:idx+3] + '}\n' + content[idx+3:]
 with open(r'E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backend\api\CarSpaManagement.Api\Controllers\JobCardsController.cs', 'w', encoding='utf-8') as f:
 f.write(content)
 print('Done')
