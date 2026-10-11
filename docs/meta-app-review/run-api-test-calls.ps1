# Makes the WhatsApp Business Management API test calls Meta asks for in App Review
# (whatsapp_business_management). Uses the Trovo Business Messaging app's system user token.
# The token is requested privately at run time; it is never written to disk or printed.
#
# Run in PowerShell:   .\run-api-test-calls.ps1

$ApiVersion  = 'v25.0'
$WabaId      = '1046927407924057'   # Test WhatsApp Business Account
$PhoneNumId  = '1263387163523264'   # Test number +1 555 204 6673

$secure = Read-Host 'Paste the trovo-test system user token (input is hidden)' -AsSecureString
$token  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$headers = @{ Authorization = "Bearer $token" }
$base = "https://graph.facebook.com/$ApiVersion"

function Call-Graph($label, $method, $url, $body) {
    Write-Host "`n== $label" -ForegroundColor Cyan
    try {
        if ($body) {
            $r = Invoke-RestMethod -Method $method -Uri $url -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 10)
        } else {
            $r = Invoke-RestMethod -Method $method -Uri $url -Headers $headers
        }
        Write-Host "OK" -ForegroundColor Green
        $r | ConvertTo-Json -Depth 6 | Write-Host
    } catch {
        Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    }
}

Call-Graph '1. Get WhatsApp Business Account'  GET "$base/$WabaId`?fields=id,name,currency,timezone_id,message_template_namespace" $null
Call-Graph '2. List phone numbers'             GET "$base/$WabaId/phone_numbers`?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status" $null
Call-Graph '3. Get phone number details'       GET "$base/$PhoneNumId`?fields=id,display_phone_number,verified_name,quality_rating,platform_type,throughput" $null
Call-Graph '4. List message templates'         GET "$base/$WabaId/message_templates`?limit=10&fields=name,status,category,language" $null

$stamp = Get-Date -Format 'yyyyMMddHHmm'
$template = @{
    name       = "trovo_api_review_test_$stamp"
    language   = 'en_US'
    category   = 'UTILITY'
    components = @(
        @{
            type    = 'BODY'
            text    = 'Hello {{1}}, your service request {{2}} has been received.'
            example = @{ body_text = @(,@('Customer', 'REQ-1001')) }
        }
    )
}
Call-Graph '5. Create message template'       POST "$base/$WabaId/message_templates" $template

Write-Host "`nDone. Calls made with the Trovo Business Messaging app token." -ForegroundColor Cyan
$token = $null
