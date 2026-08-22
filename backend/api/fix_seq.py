with open('CarSpaManagement.Api/Application/Services/JobCardService.cs', 'r') as f:
	content = f.read()

old = '''\ttry
\t{
\t\tusing var cmd = conn.CreateCommand();'''

new = '''\ttry
\t{
\t\tusing (var createCmd = conn.CreateCommand())
\t\t{
\t\t\tcreateCmd.CommandText = "CREATE SEQUENCE IF NOT EXISTS job_card_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE";
\t\t\tawait createCmd.ExecuteNonQueryAsync(cancellationToken);
\t\t}

\t\tusing var cmd = conn.CreateCommand();'''

if old in content:
	content = content.replace(old, new, 1)
	with open('CarSpaManagement.Api/Application/Services/JobCardService.cs', 'w') as f:
		f.write(content)
	print('Done')
else:
	print('Pattern not found')
