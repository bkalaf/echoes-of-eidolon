# Local configuration example

Copy this directory to `.local`, keep the configured credential directory at `.local/secrets`, and place one development value in each correspondingly named secret file. Never add `.local` or real secret values to Git.

The fourteen empty runtime files are names, not placeholders for invented values:

- `database_url`
- `postgres_password`
- `better_auth_secret`
- `better_auth_url`
- `resend_api_key`
- `resend_sender_address`
- `support_recipient_address`
- `owner_bootstrap_secret`
- `stripe_secret_key`
- `stripe_webhook_secret`
- `digitalocean_spaces_access_key_id`
- `digitalocean_spaces_drive_url`
- `digitalocean_spaces_key_name`
- `digitalocean_spaces_secret`

Use owner-supplied development values. Restrict the populated directory and files to your local user.
