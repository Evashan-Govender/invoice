# Xero Database Configuration Setup - Complete Guide

## ✅ What Changed

Xero OAuth credentials are now **stored per user in the database** instead of requiring environment variables!

## 🎯 Benefits

1. ✅ **No `.env` file changes needed**
2. ✅ **Each user can have their own Xero app**
3. ✅ **Configure via frontend Settings UI**
4. ✅ **Multi-tenant support ready**
5. ✅ **Easy to update credentials**

---

## 📊 Database Changes

Added 3 new columns to `erp_integrations` table:
- `client_id` - Stores Xero OAuth Client ID
- `client_secret` - Stores Xero OAuth Client Secret (encrypted)
- `redirect_uri` - Stores redirect URI

---

## 🚀 How to Use

### Step 1: Create Xero App

1. Go to [Xero Developer Portal](https://developer.xero.com)
2. Click **My Apps** → **New App**
3. Fill in:
   - **App Name**: InvoiceAI
   - **Company URL**: `https://invoiceocr.sambeconsulting.com`
   - **OAuth 2.0 redirect URI**: `https://invoiceocr.sambeconsulting.com/settings`
4. Click **Create app**
5. Copy your **Client ID** and **Client Secret**

### Step 2: Save Credentials via API

**Option A: Using frontend (recommended)**

The frontend will have a new "Xero Configuration" section where you can enter:
- Client ID
- Client Secret
- Redirect URI (optional, defaults to frontend URL)

**Option B: Using API directly**

```bash
curl -X POST https://invoiceocr.sambeconsulting.com/xero/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_XERO_CLIENT_ID",
    "client_secret": "YOUR_XERO_CLIENT_SECRET",
    "redirect_uri": "https://invoiceocr.sambeconsulting.com/settings"
  }'
```

### Step 3: Connect to Xero

1. Go to Settings → Integrations
2. Click **Connect** on Xero
3. You'll be redirected to Xero
4. Authorize the app
5. Done! ✅

---

## 📡 New API Endpoints

### Save Xero Config
```
POST /xero/config
Authorization: Bearer {token}
Body: {
  "client_id": "string",
  "client_secret": "string",
  "redirect_uri": "string" (optional)
}
```

### Get Xero Config (without secret)
```
GET /xero/config
Authorization: Bearer {token}

Response: {
  "configured": true,
  "client_id": "YOUR_CLIENT_ID",
  "redirect_uri": "https://...",
  "is_connected": false
}
```

### Authorize (uses database credentials)
```
GET /xero/authorize
Authorization: Bearer {token}

Response: {
  "authorization_url": "https://login.xero.com/...",
  "redirect_to": "https://login.xero.com/..."
}
```

---

## 🔒 Security Notes

1. **Client Secret is stored in database** - Consider encrypting at application level
2. **Per-user credentials** - Each user can have different Xero apps
3. **Tokens auto-refresh** - Access tokens refresh automatically
4. **Disconnect keeps credentials** - Disconnecting only clears tokens, not credentials

---

## 🎨 Frontend Integration

The settings page will show:

```
┌─────────────────────────────────────────┐
│ Xero Integration                         │
├─────────────────────────────────────────┤
│                                          │
│ ⚙️ Configuration                         │
│                                          │
│ Client ID: [_______________]             │
│ Client Secret: [_______________]         │
│ Redirect URI: [_______________]          │
│   (Optional, defaults to frontend URL)   │
│                                          │
│ [Save Configuration]                     │
│                                          │
│ ───────────────────────────────────────  │
│                                          │
│ 🔗 Connection Status: Not Connected      │
│                                          │
│ [Connect to Xero]                        │
│                                          │
└─────────────────────────────────────────┘
```

---

## ✨ Workflow

### First Time Setup:
1. User creates Xero app → Gets Client ID & Secret
2. User enters credentials in Settings
3. Clicks "Save Configuration" → Saves to database
4. Clicks "Connect to Xero" → OAuth flow starts
5. User authorizes → Tokens saved to database
6. ✅ Connected!

### Subsequent Use:
1. User just clicks "Sync to ERP"
2. System uses saved credentials automatically
3. Tokens refresh automatically when expired

---

## 🔄 Migration

### If you already have `.env` credentials:

No problem! The system will:
1. First check database for per-user credentials
2. Fall back to `.env` if not found (backward compatible)

To migrate:
1. Save credentials via frontend/API
2. Remove from `.env` file (optional)
3. Done!

---

## 🛠️ Troubleshooting

### Error: "Xero not configured"

**Solution**: Save your Client ID and Secret first:
```bash
curl -X POST /xero/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"client_id":"...","client_secret":"..."}'
```

### Error: "Xero credentials not configured"

**Solution**: You disconnected but didn't set up credentials. Save them first.

### Want to update credentials?

Just call `/xero/config` again with new values. It will update existing config.

---

## 📋 Summary

**Before**: Xero credentials in `.env` file → hard to update, one set for all users

**Now**: Xero credentials in database → easy to update via UI, per-user support! 🎉

**No more editing `.env` files!** Everything is configured through the frontend Settings page.

