
$body = @{
    email    = "admin@gym.com"
    password = "password123"
} | ConvertTo-Json

try {
    # 1. Login
    $loginRes = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
    $token = $loginRes.token
    Write-Host "Login Successful."

    # 2. Get All Payments to find a valid ID
    $headers = @{ Authorization = "Bearer $token" }
    $all = Invoke-RestMethod -Uri "http://localhost:5000/api/payments" -Method Get -Headers $headers
    
    if ($all.Count -gt 0) {
        $id = $all[0].id
        Write-Host "Found Payment ID: $id"

        # 3. Get Detail
        $detail = Invoke-RestMethod -Uri "http://localhost:5000/api/payments/$id" -Method Get -Headers $headers
        Write-Host "Detail Retrieved:"
        Write-Host "Amount: $($detail.amount)"
        Write-Host "Items Count: $($detail.items.Count)"
        if ($detail.items.Count -gt 0) {
            Write-Host "First Item Name: $($detail.items[0].name)"
        }
        else {
            Write-Host "WARNING: Items array is empty!"
        }
    }
    else {
        Write-Host "No payments found in list."
    }

}
catch {
    Write-Error $_
}
