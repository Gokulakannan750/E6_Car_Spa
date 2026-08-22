import os

os.chdir(r'E:\TTS\Projects\Desktop_Apps\E6_Car_spa_new\backend\api')

with open('CarSpaManagement.Api/Application/Services/JobCardService.cs', 'r') as f:
 content = f.read()

old = (
 "\t // Create the sequence if it doesn't exist (idempotent)\n"
 "\t using (var createSeq = conn.CreateCommand())\n"
 "\t {\n"
 "\t createSeq.CommandText = \"CREATE SEQUENCE IF NOT EXISTS job_card_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE\";\n"
 "\t try { await createSeq.ExecuteNonQueryAsync(cancellationToken); }\n"
 "\t catch { /* ignore if already exists */ }\n"
 "\t }\n"
 "\n"
 "\t // Get the next value\n"
 "\t using var cmd = conn.CreateCommand();\n"
 "\t cmd.CommandText = \"SELECT nextval('job_card_number_seq')\";"
)

new_text = (
 "\t using var cmd = conn.CreateCommand();\n"
 "\t cmd.CommandText = \"SELECT nextval('job_card_number_seq')\";"
)

if old in content:
 content = content.replace(old, new_text)
 with open('CarSpaManagement.Api/Application/Services/JobCardService.cs', 'w') as f:
 f.write(content)
 print('Replacement successful')
else:
 print('Pattern not found')
