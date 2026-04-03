import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/invoices/[id]/pdf
 *
 * Generate a branded invoice PDF using @react-pdf/renderer.
 * Returns the PDF as a binary response with content-type application/pdf.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Fetch Invoice with Company ──────────────────────────
    const { data: invoice, error: invoiceError } = await supabase
      .from('corporate_invoices')
      .select('*, company_accounts(name, legal_name, contact_name, contact_email, billing_email, billing_address)')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // ─── Dynamic Import @react-pdf/renderer ────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ReactPDF: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let React: any

    try {
      ReactPDF = await import('@react-pdf/renderer')
      React = await import('react')
    } catch {
      return NextResponse.json(
        { error: 'PDF export not available — install @react-pdf/renderer' },
        { status: 501 }
      )
    }

    const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF
    const { createElement: h } = React

    // ─── Styles ────────────────────────────────────────────────
    const styles = StyleSheet.create({
      page: {
        padding: 40,
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#1a1a1f',
      },
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
      },
      logo: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4F46E5',
      },
      invoiceTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4F46E5',
        textAlign: 'right',
      },
      invoiceNumber: {
        fontSize: 10,
        color: '#6b7280',
        textAlign: 'right',
        marginTop: 4,
      },
      divider: {
        height: 2,
        backgroundColor: '#4F46E5',
        marginBottom: 20,
      },
      infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
      },
      infoBlock: {
        width: '45%',
      },
      infoLabel: {
        fontSize: 8,
        color: '#6b7280',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      },
      infoValue: {
        fontSize: 10,
        marginBottom: 2,
      },
      statusBadge: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 4,
      },
      tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#4F46E5',
        color: '#ffffff',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 2,
        marginBottom: 1,
      },
      tableHeaderCell: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 8,
      },
      tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#e5e7eb',
      },
      tableRowAlt: {
        backgroundColor: '#fafafa',
      },
      tableCell: {
        fontSize: 9,
      },
      totalsSection: {
        marginTop: 16,
        alignItems: 'flex-end',
      },
      totalRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        width: 200,
        marginBottom: 4,
      },
      totalLabel: {
        fontSize: 9,
        color: '#6b7280',
        width: 100,
        textAlign: 'right',
        marginRight: 12,
      },
      totalValue: {
        fontSize: 9,
        fontWeight: 'bold',
        width: 80,
        textAlign: 'right',
      },
      grandTotal: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        width: 200,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 2,
        borderTopColor: '#4F46E5',
      },
      grandTotalLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#4F46E5',
        width: 100,
        textAlign: 'right',
        marginRight: 12,
      },
      grandTotalValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#4F46E5',
        width: 80,
        textAlign: 'right',
      },
      notes: {
        marginTop: 24,
        padding: 12,
        backgroundColor: '#fefce8',
        borderRadius: 4,
        fontSize: 9,
      },
      notesLabel: {
        fontWeight: 'bold',
        marginBottom: 4,
      },
      footer: {
        position: 'absolute',
        bottom: 24,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 7,
        color: '#9ca3af',
      },
    })

    // ─── Build Document ────────────────────────────────────────
    const company = invoice.company_accounts as {
      name: string
      legal_name: string | null
      contact_name: string
      contact_email: string
      billing_email: string | null
      billing_address: { line1: string; line2?: string; city: string; state: string; zip: string; country: string } | null
    } | null

    const lineItems = invoice.line_items as { description: string; quantity: number; unit_price: number; total: number }[]

    const statusColor = {
      draft: '#6b7280',
      sent: '#3b82f6',
      viewed: '#8b5cf6',
      paid: '#10B981',
      overdue: '#f97316',
      void: '#ef4444',
      refunded: '#6b7280',
    }[invoice.status as string] ?? '#6b7280'

    const doc = h(Document, null,
      h(Page, { size: 'A4', style: styles.page },
        // Header
        h(View, { style: styles.header },
          h(View, null,
            h(Text, { style: styles.logo }, 'Meridian'),
            h(Text, { style: { fontSize: 8, color: '#6b7280', marginTop: 2 } }, 'Fitness Studio Operating System'),
          ),
          h(View, null,
            h(Text, { style: styles.invoiceTitle }, 'INVOICE'),
            h(Text, { style: styles.invoiceNumber }, invoice.invoice_number),
            h(Text, {
              style: {
                ...styles.statusBadge,
                color: statusColor,
                backgroundColor: statusColor + '15',
                alignSelf: 'flex-end',
              },
            }, (invoice.status as string).toUpperCase()),
          ),
        ),

        // Divider
        h(View, { style: styles.divider }),

        // Bill To / Invoice Details
        h(View, { style: styles.infoRow },
          h(View, { style: styles.infoBlock },
            h(Text, { style: styles.infoLabel }, 'Bill To'),
            h(Text, { style: { ...styles.infoValue, fontWeight: 'bold' } }, company?.legal_name || company?.name || 'N/A'),
            company?.contact_name ? h(Text, { style: styles.infoValue }, company.contact_name) : null,
            company?.billing_email || company?.contact_email
              ? h(Text, { style: styles.infoValue }, company.billing_email || company.contact_email)
              : null,
            company?.billing_address
              ? h(View, null,
                  h(Text, { style: styles.infoValue }, company.billing_address.line1),
                  company.billing_address.line2 ? h(Text, { style: styles.infoValue }, company.billing_address.line2) : null,
                  h(Text, { style: styles.infoValue }, `${company.billing_address.city}, ${company.billing_address.state} ${company.billing_address.zip}`),
                )
              : null,
          ),
          h(View, { style: styles.infoBlock },
            h(Text, { style: styles.infoLabel }, 'Invoice Details'),
            h(Text, { style: styles.infoValue }, `Issue Date: ${invoice.issue_date}`),
            h(Text, { style: styles.infoValue }, `Due Date: ${invoice.due_date}`),
            invoice.paid_date ? h(Text, { style: styles.infoValue }, `Paid Date: ${invoice.paid_date}`) : null,
            invoice.payment_method ? h(Text, { style: styles.infoValue }, `Payment Method: ${invoice.payment_method}`) : null,
          ),
        ),

        // Line Items Table Header
        h(View, { style: styles.tableHeader },
          h(Text, { style: { ...styles.tableHeaderCell, width: '50%' } }, 'Description'),
          h(Text, { style: { ...styles.tableHeaderCell, width: '15%', textAlign: 'center' } }, 'Qty'),
          h(Text, { style: { ...styles.tableHeaderCell, width: '17.5%', textAlign: 'right' } }, 'Unit Price'),
          h(Text, { style: { ...styles.tableHeaderCell, width: '17.5%', textAlign: 'right' } }, 'Total'),
        ),

        // Line Items Rows
        ...lineItems.map((item, idx) =>
          h(View, {
            key: `row-${idx}`,
            style: {
              ...styles.tableRow,
              ...(idx % 2 === 1 ? styles.tableRowAlt : {}),
            },
            wrap: false,
          },
            h(Text, { style: { ...styles.tableCell, width: '50%' } }, item.description),
            h(Text, { style: { ...styles.tableCell, width: '15%', textAlign: 'center' } }, String(item.quantity)),
            h(Text, { style: { ...styles.tableCell, width: '17.5%', textAlign: 'right' } }, `$${item.unit_price.toFixed(2)}`),
            h(Text, { style: { ...styles.tableCell, width: '17.5%', textAlign: 'right' } }, `$${item.total.toFixed(2)}`),
          )
        ),

        // Totals
        h(View, { style: styles.totalsSection },
          h(View, { style: styles.totalRow },
            h(Text, { style: styles.totalLabel }, 'Subtotal'),
            h(Text, { style: styles.totalValue }, `$${invoice.subtotal.toFixed(2)}`),
          ),
          invoice.discount_amount > 0
            ? h(View, { style: styles.totalRow },
                h(Text, { style: styles.totalLabel }, 'Discount'),
                h(Text, { style: styles.totalValue }, `-$${invoice.discount_amount.toFixed(2)}`),
              )
            : null,
          invoice.tax_amount > 0
            ? h(View, { style: styles.totalRow },
                h(Text, { style: styles.totalLabel }, `Tax (${invoice.tax_rate}%)`),
                h(Text, { style: styles.totalValue }, `$${invoice.tax_amount.toFixed(2)}`),
              )
            : null,
          h(View, { style: styles.grandTotal },
            h(Text, { style: styles.grandTotalLabel }, 'Total'),
            h(Text, { style: styles.grandTotalValue }, `$${invoice.total.toFixed(2)}`),
          ),
          invoice.amount_paid > 0
            ? h(View, { style: { ...styles.totalRow, marginTop: 8 } },
                h(Text, { style: styles.totalLabel }, 'Amount Paid'),
                h(Text, { style: styles.totalValue }, `$${invoice.amount_paid.toFixed(2)}`),
              )
            : null,
          invoice.amount_paid > 0 && invoice.amount_paid < invoice.total
            ? h(View, { style: styles.totalRow },
                h(Text, { style: { ...styles.totalLabel, fontWeight: 'bold', color: '#f97316' } }, 'Balance Due'),
                h(Text, { style: { ...styles.totalValue, color: '#f97316' } }, `$${(invoice.total - invoice.amount_paid).toFixed(2)}`),
              )
            : null,
        ),

        // Notes
        invoice.notes
          ? h(View, { style: styles.notes },
              h(Text, { style: styles.notesLabel }, 'Notes'),
              h(Text, null, invoice.notes),
            )
          : null,

        // Footer
        h(View, { style: styles.footer, fixed: true },
          h(Text, null, `Generated by Meridian — ${new Date().toISOString().split('T')[0]}`),
          h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}`
          }),
        ),
      )
    )

    const buffer = await renderToBuffer(doc)
    const pdfBuffer = Buffer.from(buffer)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('POST /api/invoices/[id]/pdf error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
