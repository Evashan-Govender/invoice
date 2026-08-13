# Power Automate OneDrive invoice ingestion

The backend accepts Power Automate requests only when the request includes the
secret `X-Integration-Key` header. Set the same long random value in the
backend environment as `POWER_AUTOMATE_INTEGRATION_KEY`. Store it in Power
Automate as a secret; do not put it in a file, URL query string, or an email.

There is deliberately no endpoint that lists all user emails or returns user
IDs/tokens. Such an endpoint would make user enumeration and account targeting
easier. Instead, the flow verifies just the email it is about to use.

## Flow

1. Use **When a file is created** in the relevant OneDrive folder.
2. Use **Get file content** with the trigger's file identifier.
3. Choose the target email. If each user uploads into their own OneDrive,
   `Created By Email` is appropriate. For a shared mailbox/folder, use a
   trusted mapping based on the folder name or metadata instead--the creator
   will be the service account, not the invoice owner.
4. Add an **HTTP** action to check the email:

   ```text
   Method: GET
   URI: https://YOUR_API_HOST/auth/verify-user?email=@{<target-email>}
   Headers:
     X-Integration-Key: <Power Automate secret>
   ```

5. Add a condition: `body('Verify_user')?['exists']` is equal to `true`.
   On the **No** branch, log or notify an administrator and do not upload.
6. On the **Yes** branch, add an **HTTP** action:

   ```text
   Method: POST
   URI: https://YOUR_API_HOST/invoices/webhook/json
   Headers:
     Content-Type: application/json
     X-Integration-Key: <Power Automate secret>
   Body:
   {
     "filename": "@{triggerOutputs()?['body/name']}",
     "file_content": "@{body('Get_file_content')?['$content']}",
     "user_email": "@{<target-email>}"
   }
   ```

The endpoint accepts PDF, JPG, JPEG, PNG, GIF, WEBP, BMP, and TIFF files up to
25 MB. A successful request returns the new invoice ID. It writes the file to
`uploads/<user-id>/`, creates the invoice with that same `user_id`, and the
normal dashboard will show it only to that account.

Use HTTPS for the deployed API. The standard Power Automate HTTP action is a
Premium connector.
