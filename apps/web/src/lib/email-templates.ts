/**
 * Branded email templates for Meridian / The Sauna Guys
 *
 * Table-based layout for Outlook compatibility.
 * Responsive with 600px max width.
 * CAN-SPAM compliant footer.
 * Handlebars merge tag support.
 */
import Handlebars from 'handlebars'
import { STUDIO_URL } from '@/lib/constants'

// ─── Brand Colors ────────────────────────────────────────────

const COLORS = {
  darkTeal: '#23383D',
  teal: '#2BBCCD',
  gold: '#E8A838',
  white: '#FFFFFF',
  offWhite: '#F8F6F2',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
}

// ─── Merge Tag Defaults ──────────────────────────────────────

const MERGE_TAG_DEFAULTS: Record<string, string> = {
  first_name: 'Member',
  last_name: '',
  credits_remaining: '0',
  membership_name: 'your membership',
  total_visits: '0',
  campaign_name: '',
  studio_name: 'The Sauna Guys',
  studio_address: '123 Main Street, Tampa, FL 33602', // CAN-SPAM required physical address
  unsubscribe_url: `${STUDIO_URL}/unsubscribe`,
}

// ─── Template Resolution ────────────────────────────────────

/**
 * Resolve Handlebars merge tags in a template string.
 * Missing values fall back to sensible defaults.
 */
export function resolveTemplate(
  templateStr: string,
  mergeData: Record<string, string | number | undefined>
): string {
  // Merge defaults with provided data, converting everything to strings
  const data: Record<string, string> = { ...MERGE_TAG_DEFAULTS }
  for (const [key, value] of Object.entries(mergeData)) {
    if (value !== undefined && value !== null) {
      data[key] = String(value)
    }
  }

  // HTML escaping enabled to prevent XSS via member-supplied names/values.
  // Use {{{triple-braces}}} in templates for intentionally raw HTML (e.g., layout markup).
  const template = Handlebars.compile(templateStr)
  return template(data)
}

// ─── Text to HTML ────────────────────────────────────────────

/**
 * Convert plain text to HTML paragraphs.
 * Double newlines become paragraph breaks, single newlines become <br>.
 */
export function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((paragraph) => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

// ─── Branded Email Layout ────────────────────────────────────

/**
 * Wrap body HTML in the branded Sauna Guys email layout.
 * Table-based for maximum email client compatibility.
 */
export function wrapEmailLayout(bodyHtml: string, preheaderText?: string): string {
  const preheader = preheaderText
    ? `<div style="display:none;font-size:1px;color:${COLORS.offWhite};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheaderText}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>The Sauna Guys</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .fluid { max-width: 100% !important; height: auto !important; }
      .stack-column { display: block !important; width: 100% !important; }
      .content-padding { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.offWhite}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  ${preheader}

  <!-- Outer Wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${COLORS.offWhite};">
    <tr>
      <td align="center" style="padding: 24px 16px;">

        <!-- Email Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: ${COLORS.darkTeal}; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="color: ${COLORS.white}; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">
                    <!-- Logo placeholder — replace src with actual logo URL -->
                    The Sauna Guys
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="content-padding" style="background-color: ${COLORS.white}; padding: 32px; color: ${COLORS.textPrimary}; font-size: 16px; line-height: 1.6;">
              ${bodyHtml}

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${STUDIO_URL}/book" target="_blank" style="display: inline-block; background-color: ${COLORS.teal}; color: ${COLORS.white}; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 6px;">
                      Book a Session
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent Divider -->
          <tr>
            <td style="background-color: ${COLORS.gold}; height: 3px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Footer (CAN-SPAM compliant: physical address + unsubscribe) -->
          <tr>
            <td style="background-color: ${COLORS.darkTeal}; padding: 24px 32px; border-radius: 0 0 8px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="color: #A0AEB3; font-size: 13px; line-height: 1.5;">
                    <p style="margin: 0 0 8px 0;">
                      {{studio_name}} &middot; {{studio_address}}
                    </p>
                    <p style="margin: 0 0 8px 0;">
                      You're receiving this because you're a member or subscriber of {{studio_name}}.
                    </p>
                    <p style="margin: 0;">
                      <a href="{{unsubscribe_url}}" style="color: ${COLORS.teal}; text-decoration: underline;">Unsubscribe</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${STUDIO_URL}/preferences" style="color: ${COLORS.teal}; text-decoration: underline;">Email Preferences</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${STUDIO_URL}/privacy" style="color: ${COLORS.teal}; text-decoration: underline;">Privacy Policy</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End Email Container -->

      </td>
    </tr>
  </table>
  <!-- End Outer Wrapper -->
</body>
</html>`
}
