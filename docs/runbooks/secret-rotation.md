# Secret Rotation Runbook

This document describes how to rotate each secret used by Meridian in production.

## Stripe

1. Generate a new secret key in the Stripe Dashboard (Developers > API Keys).
2. Update `STRIPE_SECRET_KEY` in Netlify environment variables.
3. For webhook signing secrets: create a new webhook endpoint or rotate the
   signing secret in Stripe Dashboard (Developers > Webhooks > endpoint > Signing secret).
4. Update `STRIPE_WEBHOOK_SECRET` in Netlify environment variables.
5. Trigger a redeploy. Verify a test webhook event is received successfully.

## Resend

1. Generate a new API key in the Resend Dashboard (API Keys).
2. Update `RESEND_API_KEY` in Netlify environment variables.
3. Update `RESEND_WEBHOOK_SECRET` if webhook verification is enabled.
4. Trigger a redeploy. Send a test email to verify delivery.

## Inngest

1. Generate new signing key and event key in the Inngest Dashboard.
2. Update `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` in Netlify.
3. Trigger a redeploy. Run a manual Inngest event to verify functions fire.

## Glofox

1. Request a new API token from Glofox support or the partner portal.
2. Update `GLOFOX_API_TOKEN` and `GLOFOX_API_KEY` in Netlify.
3. Trigger a redeploy. Run a manual sync to verify data flows.

## Email Unsubscribe Secret

1. Generate a new random 32-byte hex secret: `openssl rand -hex 32`
2. Update `UNSUBSCRIBE_HMAC_SECRET` in Netlify environment variables.
3. Trigger a redeploy. Note: existing unsubscribe links in sent emails will
   break after rotation. Consider a grace period with dual-validation if needed.

## Supabase Service Role Key

1. Go to Supabase Dashboard > Settings > API.
2. The service role key cannot be rotated without recreating the project.
3. If compromised, contact Supabase support immediately.
4. Update `SUPABASE_SERVICE_ROLE_KEY` in Netlify if regenerated.

## General Checklist

- [ ] Update the secret in the provider dashboard.
- [ ] Update the corresponding env var in Netlify (Production + Preview).
- [ ] Trigger a production redeploy.
- [ ] Verify the integration works end-to-end.
- [ ] Document the rotation date in the team log.
