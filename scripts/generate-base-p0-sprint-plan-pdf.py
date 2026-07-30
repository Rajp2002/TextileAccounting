#!/usr/bin/env python3
"""Render the Base P0 remediation sprint plan as a release-ready PDF."""

from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/pilot-remediation/BASE_P0_SPRINT_PLAN_2026-07-30.md"
OUTPUT = ROOT / "output/pdf/WEAVLY_BASE_P0_REMEDIATION_SPRINT_PLAN_2026-07-30.pdf"

NAVY = colors.HexColor("#102A43")
BLUE = colors.HexColor("#1D4ED8")
TEAL = colors.HexColor("#0F766E")
PALE_BLUE = colors.HexColor("#EAF2FF")
PALE_TEAL = colors.HexColor("#E8F7F4")
PALE_AMBER = colors.HexColor("#FFF7E6")
INK = colors.HexColor("#243B53")
MUTED = colors.HexColor("#627D98")
GRID = colors.HexColor("#CBD5E1")
WHITE = colors.white


def inline(text: str) -> str:
    text = text.strip().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(GRID)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "WEAVLY • BASE PRODUCT • P0 REMEDIATION")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"30 JUL 2026  |  {doc.page}")
    canvas.restoreState()


def styles():
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=27, leading=31, textColor=WHITE, alignment=TA_CENTER,
            spaceAfter=8 * mm,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=base["Normal"], fontName="Helvetica",
            fontSize=12, leading=17, textColor=colors.HexColor("#DCEBFF"),
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=17, leading=21, textColor=NAVY, spaceBefore=3 * mm,
            spaceAfter=3 * mm,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=12, leading=15, textColor=BLUE, spaceBefore=3 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.2, leading=13, textColor=INK, spaceAfter=2.3 * mm,
        ),
        "small": ParagraphStyle(
            "Small", parent=base["BodyText"], fontName="Helvetica",
            fontSize=7.6, leading=10, textColor=INK,
        ),
        "callout": ParagraphStyle(
            "Callout", parent=base["BodyText"], fontName="Helvetica-Bold",
            fontSize=10, leading=14, textColor=NAVY,
        ),
        "table_head": ParagraphStyle(
            "TableHead", parent=base["BodyText"], fontName="Helvetica-Bold",
            fontSize=7.3, leading=9, textColor=WHITE,
        ),
        "table": ParagraphStyle(
            "Table", parent=base["BodyText"], fontName="Helvetica",
            fontSize=7.1, leading=9, textColor=INK,
        ),
    }


def styled_table(rows, widths, st):
    data = []
    for row_index, row in enumerate(rows):
        style = st["table_head"] if row_index == 0 else st["table"]
        data.append([Paragraph(inline(cell), style) for cell in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def bullets(items, st):
    return ListFlowable(
        [ListItem(Paragraph(inline(item), st["body"]), leftIndent=4 * mm) for item in items],
        bulletType="bullet", leftIndent=5 * mm, bulletFontName="Helvetica",
        bulletFontSize=7, bulletColor=TEAL, spaceAfter=2 * mm,
    )


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    st = styles()
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=17 * mm, bottomMargin=19 * mm,
        title="Weavly Base P0 Remediation Sprint Plan",
        author="Weavly Product Engineering",
        subject="Base product pilot blocker remediation",
    )
    story = []

    cover = Table(
        [[
            Paragraph("WEAVLY", ParagraphStyle(
                "Brand", parent=st["cover_sub"], fontName="Helvetica-Bold",
                fontSize=12, textColor=colors.HexColor("#88C7FF"), spaceAfter=13 * mm,
            )),
            ],
         [Paragraph("Base Product<br/>P0 Remediation Sprint", st["cover_title"])],
         [Paragraph(
             "Implementation plan and release gates<br/>30 July 2026",
             st["cover_sub"],
         )]],
        colWidths=[174 * mm],
        rowHeights=[30 * mm, 72 * mm, 42 * mm],
    )
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0, NAVY),
    ]))
    story.extend([
        Spacer(1, 24 * mm), cover, Spacer(1, 10 * mm),
        Table(
            [[Paragraph("<b>SPRINT START</b><br/>NO-GO", st["callout"]),
              Paragraph("<b>LOCAL REMEDIATION</b><br/>IMPLEMENTED", st["callout"]),
              Paragraph("<b>PILOT RELEASE</b><br/>DEPLOYED PROOF PENDING", st["callout"])]],
            colWidths=[58 * mm] * 3,
            style=TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), PALE_AMBER),
                ("BACKGROUND", (1, 0), (1, 0), PALE_TEAL),
                ("BACKGROUND", (2, 0), (2, 0), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, GRID),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]),
        ),
        PageBreak(),
    ])

    story.extend([
        Paragraph("Executive sprint contract", st["h1"]),
        Paragraph(
            "Close every P0 blocker in the 30 July Base Pilot Go/No-Go report and "
            "produce objective evidence for a Base-only pilot retest. Full Suite "
            "workflow remediation is explicitly excluded.",
            st["body"],
        ),
        Table(
            [[Paragraph("<b>Scope</b><br/>Weavly Base / Estimator only", st["callout"]),
              Paragraph("<b>Duration</b><br/>5 working days + deployed retest", st["callout"])]],
            colWidths=[87 * mm, 87 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, GRID),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]),
        ),
        Spacer(1, 4 * mm),
        Paragraph("Exit rule", st["h2"]),
        bullets([
            "Transport changes the authoritative quote price everywhere.",
            "Estimator UI, saved assumptions, internal PDF, and customer PDF agree on price and margin.",
            "Failed, dismissed, and stale Razorpay checkouts are truthful and immediately retryable; a Netbanking success is proven after deployment.",
            "The production dependency audit has zero untriaged high or critical findings.",
        ], st),
        Paragraph(
            "Passing unit tests alone is not sufficient. Commercial and billing fixes require deployed runtime evidence.",
            st["callout"],
        ),
        Spacer(1, 4 * mm),
        Paragraph("Workstream board", st["h1"]),
        styled_table([
            ["ID", "Workstream", "Estimate", "Status"],
            ["P0-PRICE", "Authoritative transport-aware pricing", "1.0 day", "Implemented locally"],
            ["P0-EXPORT", "PDF commercial consistency", "0.75 day", "Implemented locally"],
            ["P0-BILL", "Razorpay recovery + Netbanking proof", "1.5 days", "Recovery implemented; proof pending"],
            ["P0-DEPS", "Production dependency remediation", "0.75 day", "Implemented; production audit clean"],
            ["P0-RETEST", "Base-only regression and Go/No-Go rerun", "1.0 day", "Pending deployment"],
        ], [25 * mm, 76 * mm, 24 * mm, 49 * mm], st),
        PageBreak(),
    ])

    days = [
        ("Day 1 — Commercial invariant", [
            "Honor every non-zero transport input, including legacy rows with a stale disabled section toggle.",
            "Calculate actual margin per metre and preserve valid zero-quantity Base costings.",
            "Lock the two transport oracles: Rs 41.6725 at Rs 1.50/m and Rs 42.2407 at Rs 2.00/m.",
        ], "UI and server-authoritative persistence use the same formula and round only at the snapshot boundary."),
        ("Day 2 — Export consistency", [
            "Recompute historical export economics from saved assumptions, not a previously persisted buggy quote price.",
            "Show profit per metre when order quantity is absent; show total expected profit only when quantity exists.",
            "Keep customer quotation free of internal cost, margin, and profit.",
        ], "UI, internal PDF, and customer PDF agree on transport-aware unit price; missing quantity never appears as zero profit."),
        ("Day 3 — Billing recovery", [
            "Treat Razorpay order creation as pending, never payment receipt.",
            "Make failed, dismissed, and stale orders retryable through an authenticated, tenant-scoped endpoint.",
            "Use Netbanking as the approved pilot activation route; UPI is outside the pilot route.",
            "Keep entitlement activation server-authoritative.",
        ], "No false receipt state, no manual row cleanup, and deployed Netbanking proof yields exactly one payment and one entitlement."),
        ("Day 4 — Dependency gate", [
            "Upgrade Next.js, Sentry, PostCSS, and aligned tooling to patched releases.",
            "Remove the unused deprecated crypto package and constrain the vulnerable build-only EJS chain.",
            "Run production and full audits without npm audit fix --force.",
        ], "Zero high/critical production advisories and a green optimized build."),
        ("Day 5 — Verification and decision", [
            "Run focused regression, full Vitest, lint, production build, and dependency audits.",
            "Deploy the exact tested revision and execute transport, PDF, Razorpay failure/dismissal/retry/success flows.",
            "Reconcile quote snapshots, captured payment, and entitlement cardinality.",
        ], "Updated Base Pilot report has no open P0; otherwise the pilot remains No-Go."),
    ]
    story.append(Paragraph("Five-day execution plan", st["h1"]))
    for title, items, acceptance in days:
        story.append(KeepTogether([
            Paragraph(title, st["h2"]),
            bullets(items, st),
            Table(
                [[Paragraph(f"<b>ACCEPTANCE</b> — {inline(acceptance)}", st["small"])]],
                colWidths=[174 * mm],
                style=TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), PALE_TEAL),
                    ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#99D5CC")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 7),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]),
            ),
            Spacer(1, 3 * mm),
        ]))
    story.append(PageBreak())

    story.extend([
        Paragraph("Acceptance ledger", st["h1"]),
        styled_table([
            ["Gate", "Required proof", "Blocker condition"],
            ["PRICE-01", "Non-zero transport affects the authoritative quote.", "Transport changes but price does not."],
            ["PRICE-02", "Server rejects alternate client totals.", "Client can persist a different price."],
            ["EXPORT-01", "Saved assumptions export the corrected derived price.", "Export trusts the old stored result."],
            ["EXPORT-02", "No-quantity PDF shows margin and profit/m.", "0%, Rs 0, NaN, or Infinity appears."],
            ["EXPORT-03", "Customer PDF hides internal economics.", "Cost, margin, or profit leaks."],
            ["BILL-01", "Created order states payment is pending.", "Receipt is claimed before verification."],
            ["BILL-02", "Failed/dismissed checkout is immediately retryable.", "Cleanup or a wait is required."],
            ["BILL-03", "Mutation is owner, tenant, order, and state scoped.", "Cross-tenant or paid-state mutation."],
            ["BILL-04", "Netbanking creates one payment and entitlement.", "Duplicate or missing record."],
            ["DEPS-01", "Production audit has zero high/critical.", "Any untriaged production advisory."],
            ["BUILD-01", "Focused/full tests, lint, and build pass.", "Any regression or compile failure."],
        ], [20 * mm, 97 * mm, 57 * mm], st),
        Spacer(1, 5 * mm),
        Paragraph("Local verification evidence", st["h1"]),
        styled_table([
            ["Gate", "Result"],
            ["Focused P0 regression", "4 files; 59 tests passed"],
            ["Full Vitest suite", "115 files; 778 passed; 1 intentionally skipped"],
            ["Lint", "Full repository and final changed-file lint passed"],
            ["Production build", "Next.js 16.2.12 Webpack/PWA, TypeScript, and 45 static pages passed"],
            ["Production audit", "0 vulnerabilities"],
            ["Full audit", "9 dev-only ESLint advisory paths; no production exposure"],
        ], [48 * mm, 126 * mm], st),
        Spacer(1, 5 * mm),
        Paragraph("Release decision", st["h1"]),
        Table(
            [[Paragraph(
                "<b>CONDITIONAL NO-GO</b><br/>Local implementation is not the pilot release gate. "
                "Go requires deployment of the tested revision plus successful Netbanking, PDF, "
                "pricing, and tenant-data reconciliation evidence.",
                st["callout"],
            )]],
            colWidths=[174 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), PALE_AMBER),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#E5A72E")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]),
        ),
        Spacer(1, 5 * mm),
        Paragraph("Key risks and controls", st["h2"]),
        bullets([
            "Historical rows retain old stored results; exports derive from saved assumptions until a separately reviewed backfill.",
            "Local tests cannot prove Razorpay's hosted Netbanking flow; deployed runtime evidence is mandatory.",
            "Checkout recovery mutates only created rows, so late browser dismissal cannot downgrade verified activation.",
            "The EJS override is accepted only with a green PWA production build.",
            "Pre-existing estimator quality-save changes remain outside this P0 sprint.",
        ], st),
        PageBreak(),
        Paragraph("Definition of done", st["h2"]),
        bullets([
            "All local gates are green and the target contains the exact tested revision.",
            "A Base QA account completes Netbanking and reconciliation proves one captured payment and one active entitlement.",
            "Both transport oracles match in UI, database, internal PDF, and customer PDF.",
            "The revised pilot report contains no open P0 finding.",
        ], st),
        Spacer(1, 5 * mm),
        Paragraph("Implementation map", st["h1"]),
        styled_table([
            ["Area", "Primary implementation"],
            ["Pricing invariant", "lib/estimator.ts"],
            ["Export reconciliation", "lib/estimator-export.ts; owner/quotes/QuotesClient.tsx"],
            ["Billing state", "lib/billing-lifecycle.ts; owner/billing/page.tsx"],
            ["Checkout recovery", "api/billing/checkout-state/route.ts; SubscribeButton.tsx"],
            ["Regression coverage", "estimator and Base P0 Vitest suites"],
            ["Dependency closure", "package.json; package-lock.json"],
        ], [50 * mm, 124 * mm], st),
        Spacer(1, 5 * mm),
        Paragraph("Deployment retest packet", st["h1"]),
        bullets([
            "Deploy the exact tested revision to the target environment.",
            "Use the retained Base QA account or create an isolated BASEPILOT account.",
            "Run Netbanking failure, dismissal, retry, and success; UPI is not a pilot route.",
            "Download and visually compare internal and customer PDFs for both transport oracles.",
            "Reconcile one captured payment, one active Base entitlement, and the saved quote snapshot.",
            "Record evidence in the revised Base Pilot Go/No-Go report.",
        ], st),
    ])

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
