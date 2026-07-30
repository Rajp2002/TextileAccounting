#!/usr/bin/env python3
"""Render the Base P1 remediation sprint as a polished PDF."""

from pathlib import Path

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
OUTPUT = ROOT / "output/pdf/WEAVLY_BASE_P1_REMEDIATION_SPRINT_PLAN_2026-07-30.pdf"

NAVY = colors.HexColor("#102A43")
BLUE = colors.HexColor("#1D4ED8")
TEAL = colors.HexColor("#0F766E")
INK = colors.HexColor("#243B53")
MUTED = colors.HexColor("#627D98")
GRID = colors.HexColor("#CBD5E1")
PALE_BLUE = colors.HexColor("#EAF2FF")
PALE_TEAL = colors.HexColor("#E8F7F4")
PALE_AMBER = colors.HexColor("#FFF7E6")
WHITE = colors.white


def safe(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def make_styles():
    sample = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=sample["Title"], fontName="Helvetica-Bold",
            fontSize=27, leading=31, textColor=WHITE, alignment=TA_CENTER,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=sample["BodyText"], fontName="Helvetica",
            fontSize=12, leading=17, textColor=colors.HexColor("#DCEBFF"),
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "H1", parent=sample["Heading1"], fontName="Helvetica-Bold",
            fontSize=17, leading=21, textColor=NAVY, spaceBefore=3 * mm,
            spaceAfter=3 * mm,
        ),
        "h2": ParagraphStyle(
            "H2", parent=sample["Heading2"], fontName="Helvetica-Bold",
            fontSize=12, leading=15, textColor=BLUE, spaceBefore=3 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body", parent=sample["BodyText"], fontName="Helvetica",
            fontSize=9.2, leading=13, textColor=INK, spaceAfter=2.2 * mm,
        ),
        "small": ParagraphStyle(
            "Small", parent=sample["BodyText"], fontName="Helvetica",
            fontSize=7.4, leading=9.5, textColor=INK,
        ),
        "callout": ParagraphStyle(
            "Callout", parent=sample["BodyText"], fontName="Helvetica-Bold",
            fontSize=10, leading=14, textColor=NAVY,
        ),
        "table_head": ParagraphStyle(
            "TableHead", parent=sample["BodyText"], fontName="Helvetica-Bold",
            fontSize=7.2, leading=9, textColor=WHITE,
        ),
        "table": ParagraphStyle(
            "Table", parent=sample["BodyText"], fontName="Helvetica",
            fontSize=7.0, leading=9, textColor=INK,
        ),
    }


STYLES = make_styles()


def footer(canvas, doc):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(GRID)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 9 * mm, "WEAVLY | BASE PRODUCT | P1 REMEDIATION")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"30 JUL 2026  |  {doc.page}")
    canvas.restoreState()


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(safe(item), STYLES["body"]), leftIndent=4 * mm) for item in items],
        bulletType="bullet",
        leftIndent=5 * mm,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        bulletColor=TEAL,
        spaceAfter=2 * mm,
    )


def table(rows, widths):
    content = []
    for row_number, row in enumerate(rows):
        style = STYLES["table_head"] if row_number == 0 else STYLES["table"]
        content.append([Paragraph(safe(str(cell)), style) for cell in row])
    result = Table(content, colWidths=widths, repeatRows=1, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F7FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return result


def acceptance(text):
    result = Table(
        [[Paragraph(f"<b>ACCEPTANCE</b> - {safe(text)}", STYLES["small"])]],
        colWidths=[174 * mm],
    )
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_TEAL),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#99D5CC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return result


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=17 * mm,
        bottomMargin=19 * mm,
        title="Weavly Base P1 Remediation Sprint Plan",
        author="Weavly Product Engineering",
        subject="Base product P1 pilot blocker remediation",
    )
    story = []

    cover = Table([
        [Paragraph("WEAVLY", ParagraphStyle(
            "Brand", parent=STYLES["cover_sub"], fontName="Helvetica-Bold",
            fontSize=12, textColor=colors.HexColor("#88C7FF"),
        ))],
        [Paragraph("Base Product<br/>P1 Remediation Sprint", STYLES["cover_title"])],
        [Paragraph("Implementation plan and release gates<br/>30 July 2026", STYLES["cover_sub"])],
    ], colWidths=[174 * mm], rowHeights=[30 * mm, 72 * mm, 42 * mm])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    status = Table(
        [[
            Paragraph("<b>P1 FINDINGS</b><br/>3 REPORT BLOCKERS", STYLES["callout"]),
            Paragraph("<b>LOCAL IMPLEMENTATION</b><br/>COMPLETE", STYLES["callout"]),
            Paragraph("<b>PILOT RELEASE</b><br/>DEPLOYED RETEST PENDING", STYLES["callout"]),
        ]],
        colWidths=[58 * mm] * 3,
    )
    status.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), PALE_AMBER),
        ("BACKGROUND", (1, 0), (1, 0), PALE_TEAL),
        ("BACKGROUND", (2, 0), (2, 0), PALE_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.5, GRID),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.extend([Spacer(1, 24 * mm), cover, Spacer(1, 10 * mm), status, PageBreak()])

    story.extend([
        Paragraph("Executive sprint contract", STYLES["h1"]),
        Paragraph(
            "Close every P1 blocker in the 30 July Base Pilot report without enabling "
            "Full Suite order, market-run, or production capabilities.",
            STYLES["body"],
        ),
        Paragraph("Exit rule", STYLES["h2"]),
        bullets([
            "Quality save creates both the reusable quality and initial snapshot, or leaves neither record.",
            "Start From creates a new template and costing-group identity that cannot mutate the source.",
            "Base captures customer and positive quantity inline, persists both, and exports both.",
        ]),
        Paragraph(
            "Local tests are necessary but not sufficient. Final closure requires deployed UI, PDF, and tenant-data evidence.",
            STYLES["callout"],
        ),
        Spacer(1, 4 * mm),
        Paragraph("Sprint board", STYLES["h1"]),
        table([
            ["ID", "Workstream", "Estimate", "Status"],
            ["P1-QUALITY", "Quality-save validation and rollback integrity", "0.75 day", "Implemented locally"],
            ["P1-COPY", "Independent Start From identity", "0.5 day", "Implemented locally"],
            ["P1-CONTEXT", "Base customer and quantity workflow", "1.0 day", "Implemented locally"],
            ["P1-ARTIFACT", "Saved Costings and PDF reconciliation", "0.5 day", "Implemented locally"],
            ["P1-RETEST", "Deployed workflow and database proof", "1.25 days", "Pending deployment"],
        ], [25 * mm, 76 * mm, 24 * mm, 49 * mm]),
        Spacer(1, 5 * mm),
        Paragraph("Product boundary", STYLES["h1"]),
        Table(
            [[
                Paragraph("<b>BASE GAINS</b><br/>Customer and quantity context", STYLES["callout"]),
                Paragraph("<b>BASE RETAINS</b><br/>Costing record semantics", STYLES["callout"]),
                Paragraph("<b>BASE DOES NOT GAIN</b><br/>Production conversion", STYLES["callout"]),
            ]],
            colWidths=[58 * mm] * 3,
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, GRID),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]),
        ),
        PageBreak(),
    ])

    days = [
        (
            "Day 1 - Quality-save integrity",
            [
                "Do not require hidden tape length for Base quality or costing validation.",
                "Validate the complete initial snapshot before inserting the template.",
                "On unexpected snapshot failure, delete the exact tenant template and verify the returned identity.",
                "Preserve deterministic initial-snapshot idempotency.",
            ],
            "Valid Base recipe with tape length 0 succeeds; invalid input writes zero records; downstream failure leaves no active template.",
        ),
        (
            "Day 2 - Independent duplication",
            [
                "Keep the copied recipe values in memory.",
                "Detach template, source quote, source timestamp, record kind, and request ID before Start From.",
                "Save through the new-quality path.",
                "Verify the copy begins at its own template ID, costing group, and version 1.",
            ],
            "Updating or deleting the copy does not alter the source, and later copy versions stay in the copy group.",
        ),
        (
            "Day 3 - Base commercial context",
            [
                "Load recent tenant-scoped customer names for inline selection.",
                "Allow a recent customer or a new free-text customer.",
                "Show and require a positive Base costing quantity.",
                "Persist customer, order_quantity_m, and meters from the same state.",
                "Carry populated context into a new quality's initial snapshot.",
            ],
            "A Base owner saves and reopens an explicit customer and 5,000m exactly.",
        ),
        (
            "Day 4 - Artifacts and release gate",
            [
                "Prefill Base customer in exports and Saved Costings.",
                "Customer PDF shows customer, quantity, unit price, and quotation value.",
                "Internal PDF shows quantity, margin, and expected total profit.",
                "Run focused/full tests, lint, production build, audit, deployment, and data reconciliation.",
            ],
            "UI, database, internal PDF, and customer PDF agree, and Base remains unable to create production records.",
        ),
    ]
    story.append(Paragraph("Four-day execution plan", STYLES["h1"]))
    for title, items, gate in days:
        story.append(KeepTogether([
            Paragraph(title, STYLES["h2"]),
            bullets(items),
            acceptance(gate),
            Spacer(1, 3 * mm),
        ]))
    story.append(PageBreak())

    story.extend([
        Paragraph("Acceptance ledger", STYLES["h1"]),
        table([
            ["Gate", "Required proof", "Blocker condition"],
            ["QUALITY-01", "Base recipe saves without tape length.", "Hidden tape validation rejects save."],
            ["QUALITY-02", "Snapshot validation precedes template insert.", "Invalid snapshot leaves a template."],
            ["QUALITY-03", "Failed snapshot returns exact rollback identity.", "Partial template survives."],
            ["COPY-01", "Start From clears all source identities.", "Copy retains source identity."],
            ["COPY-02", "Copy has distinct template and costing group.", "Copy becomes next source version."],
            ["PARTY-01", "Recent-party chooser plus free text is visible.", "Customer exists only in export."],
            ["PARTY-02", "Explicit customer is required and persisted.", "Quality is silently used as party."],
            ["QTY-01", "Positive Base quantity is visible and required.", "Saved row remains 0m."],
            ["QTY-02", "Reopen restores exact saved quantity.", "Quantity is lost."],
            ["PDF-01", "Customer PDF shows customer, qty, price, total.", "Context or total missing."],
            ["PDF-02", "Internal PDF shows qty, margin, total profit.", "Financial context conflicts."],
            ["BOUNDARY-01", "Base production capabilities remain false.", "Full Suite capability leaks."],
        ], [22 * mm, 94 * mm, 58 * mm]),
        Spacer(1, 5 * mm),
        Paragraph("Local verification evidence", STYLES["h1"]),
        table([
            ["Gate", "Result"],
            ["Focused P1 regression", "5 files; 42 tests passed"],
            ["Full Vitest suite", "116 files; 783 passed; 1 intentionally skipped"],
            ["Changed-file lint", "Passed"],
            ["Full lint", "Passed"],
            ["Production build", "Next.js 16.2.12 Webpack/PWA, TypeScript, and 45 static pages passed"],
            ["Production audit", "0 vulnerabilities"],
        ], [48 * mm, 126 * mm]),
        PageBreak(),
    ])

    story.extend([
        Paragraph("Implementation map", STYLES["h1"]),
        table([
            ["Area", "Primary implementation"],
            ["Base capability boundary", "lib/costing-workspace.ts"],
            ["Quality, rollback, parties, persistence", "owner/estimator/actions.ts"],
            ["Initial party data", "owner/estimator/page.tsx"],
            ["Party, quantity, copy, export UI", "owner/estimator/EstimatorClient.tsx"],
            ["Saved Costings context", "owner/quotes/QuotesClient.tsx"],
            ["Regression coverage", "Base P1, costing workspace, estimator readiness tests"],
        ], [55 * mm, 119 * mm]),
        Spacer(1, 5 * mm),
        Paragraph("Risks and controls", STYLES["h1"]),
        bullets([
            "Base keeps costing record_kind and cannot convert to orders or production.",
            "Legacy 0m or party-equals-quality snapshots remain immutable history; new versions carry explicit context.",
            "Complete validation runs before the first write; exact compensating cleanup covers unexpected snapshot failures.",
            "Existing bad copies are not rewritten; deployed proof must create a fresh independent copy.",
            "Unrelated QA artifacts remain outside the sprint scope.",
        ]),
        Spacer(1, 4 * mm),
        Paragraph("Definition of done", STYLES["h1"]),
        bullets([
            "All local gates pass and the exact tested revision is deployed.",
            "Fresh Base save produces one quality and one initial snapshot without hidden tape input.",
            "Start From produces a different template and costing group at version 1.",
            "A 5,000m customer costing reopens with exact context.",
            "Internal and customer PDFs agree with UI and database.",
            "No Full Suite production capability is exposed to Base.",
        ]),
        Spacer(1, 5 * mm),
        Table(
            [[Paragraph(
                "<b>RELEASE POSITION</b><br/>P1 is code-complete locally. Pilot closure remains conditional on deployed workflow, PDF, and tenant-data reconciliation.",
                STYLES["callout"],
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
    ])

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
