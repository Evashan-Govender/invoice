# Xero Token Persistence and Auto-Refresh

## Overview

Xero OAuth connections **DO persist across system restarts**. The tokens are stored in the database, not in memory or local storage.

## How It Works

### Token Storage
- **Access Token**: Stored in `erp_integrations.access_token` (expires in 30 minutes)
- **Refresh Token**: Stored in `erp_integrations.refresh_token` (long-lived, used to get new access tokens)
- **Token Expiry**: Stored in `erp_integrations.token_expiry` (timestamp when access token expires)
- **Tenant ID**: Stored in `erp_integrations.tenant_id` (Xero organization ID)
- **Client Credentials**: Stored in `erp_integrations.client_id` and `client_secret`

### Token Lifecycle

1. **Initial Connection** (`/xero/callback`)
   - User authorizes via Xero OAuth
   - Backend receives authorization code
   - Exchanges code for access token + refresh token
   - Stores both tokens in database with expiry time

2. **After System Restart**
   - Tokens remain in database
   - Access token may be expired (30-minute lifetime)
   - Refresh token is still valid (long-lived)

3. **Automatic Token Refresh** (NEW - Just Implemented)
   - Before syncing, system checks if token is expired or expiring soon (within 5 minutes)
   - If expired, automatically uses refresh token to get new access token
   - Updates database with new tokens
   - Proceeds with sync operation

## Why Connection Might Appear Lost

### Before the Fix
If the system restarted and more than 30 minutes passed:
- Access token would be expired
- System would try to sync with expired token
- Xero API would reject the request
- User would see "connection lost" error

### After the Fix
The sync endpoint now:
1. Checks token expiry before attempting sync
2. Automatically refreshes if expired or expiring soon
3. Updates database with new tokens
4. Proceeds with sync seamlessly

## Manual Token Refresh

Users can also manually refresh tokens via:
```
POST /xero/refresh
```

This is useful if:
- Token refresh fails during sync
- User wants to proactively refresh before expiry
- Troubleshooting connection issues

## Connection Status

Check connection status via:
```
GET /xero/status
```

Returns:
- `connected`: true/false
- `is_expired`: true/false
- `tenant_id`: Xero organization ID
- `tenant_name`: Organization name
- `last_sync`: Last successful sync timestamp

## Best Practices

1. **Refresh Tokens Are Critical**: Never delete refresh tokens - they allow automatic reconnection
2. **Token Expiry Buffer**: System refreshes 5 minutes before expiry to avoid race conditions
3. **Error Handling**: If refresh fails, user is prompted to reconnect via Settings
4. **Database Persistence**: All tokens stored in PostgreSQL, survive restarts

## Troubleshooting

### Connection Lost After Restart
**Cause**: Access token expired, automatic refresh failed
**Solution**: 
1. Check if refresh token exists in database
2. Try manual refresh via `/xero/refresh`
3. If refresh fails, reconnect via Settings

### Token Refresh Fails
**Possible Causes**:
- Refresh token expired (rare, but possible after ~60 days of inactivity)
- Xero app credentials changed
- User revoked access in Xero
**Solution**: Reconnect via Settings → Xero → Connect

### Sync Fails with 401 Error
**Cause**: Token expired and refresh failed
**Solution**: System will show error message prompting user to reconnect

## Implementation Details

### Files Modified
- `backend/app/routers/integrations.py`: Added automatic token refresh logic
- `frontend/src/components/ERPSyncButton.tsx`: Changed to show error modal instead of redirect

### Token Refresh Logic
```python
# Check if token expired or expiring soon (within 5 minutes)
if integration.token_expiry < datetime.utcnow() + timedelta(minutes=5):
    # Refresh token automatically
    response = requests.post(XERO_TOKEN_URL, ...)
    integration.access_token = new_token
    integration.token_expiry = new_expiry
    db.commit()
```

## Summary

✅ **Xero connections persist across restarts** - tokens stored in database
✅ **Automatic token refresh** - system refreshes expired tokens before sync
✅ **Graceful error handling** - prompts user to reconnect if refresh fails
✅ **No manual intervention needed** - works seamlessly for users
