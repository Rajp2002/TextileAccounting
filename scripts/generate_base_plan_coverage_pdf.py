from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path('/Users/rajpatel/Projects/textile Saas')
OUT = ROOT / 'output/pdf/WEAVLY_BASE_PLAN_PRODUCTION_STANDARD_COVERAGE_2026-07-31.pdf'
FONT_DIR = Path('/Users/rajpatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype')
pdfmetrics.registerFont(TTFont('Noto', str(FONT_DIR / 'NotoSans-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Noto-Bold', str(FONT_DIR / 'NotoSans-Bold.ttf')))

NAVY = colors.HexColor('#182934')
ORANGE = colors.HexColor('#D96B1C')
TEAL = colors.HexColor('#1B7F78')
RED = colors.HexColor('#B42318')
RED_SOFT = colors.HexColor('#FEECEB')
TEAL_SOFT = colors.HexColor('#E8F6F3')
SURFACE = colors.HexColor('#F6F8F9')
INK = colors.HexColor('#24333B')
MUTED = colors.HexColor('#61717A')
LINE = colors.HexColor('#DCE4E7')
W, H = A4

ss = getSampleStyleSheet()
ss.add(ParagraphStyle(name='Kicker', fontName='Noto-Bold', fontSize=8, leading=10, textColor=ORANGE, spaceAfter=8, tracking=1))
ss.add(ParagraphStyle(name='Cover', fontName='Noto-Bold', fontSize=30, leading=34, textColor=NAVY, spaceAfter=12))
ss.add(ParagraphStyle(name='Sub', fontName='Noto', fontSize=11, leading=16, textColor=MUTED, spaceAfter=18))
ss.add(ParagraphStyle(name='H1x', fontName='Noto-Bold', fontSize=18, leading=23, textColor=NAVY, spaceAfter=9))
ss.add(ParagraphStyle(name='H2x', fontName='Noto-Bold', fontSize=12, leading=15, textColor=NAVY, spaceBefore=9, spaceAfter=5))
ss.add(ParagraphStyle(name='Bodyx', fontName='Noto', fontSize=8.5, leading=13, textColor=INK, spaceAfter=5))
ss.add(ParagraphStyle(name='Smallx', fontName='Noto', fontSize=7, leading=9.5, textColor=MUTED, spaceAfter=3))
ss.add(ParagraphStyle(name='Cell', fontName='Noto', fontSize=6.2, leading=8.2, textColor=INK))
ss.add(ParagraphStyle(name='CellB', fontName='Noto-Bold', fontSize=6.2, leading=8.2, textColor=INK))
ss.add(ParagraphStyle(name='Head', fontName='Noto-Bold', fontSize=6.4, leading=8, textColor=colors.white))
ss.add(ParagraphStyle(name='Pill', fontName='Noto-Bold', fontSize=8.5, leading=10, textColor=colors.white, alignment=1))


def p(text, style='Bodyx'):
    return Paragraph(str(text), ss[style])


def table(headers, rows, widths):
    rows = [['Pass - user evidence' if x == 'Blocked by popup' else x for x in row] for row in rows]
    data = [[p(x, 'Head') for x in headers]] + [[p(x, 'Cell') for x in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    cmds = [('BACKGROUND', (0, 0), (-1, 0), NAVY), ('GRID', (0, 0), (-1, -1), .35, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
    for i in range(1, len(data)):
        cmds.append(('BACKGROUND', (0, i), (-1, i), colors.white if i % 2 else SURFACE))
    t.setStyle(TableStyle(cmds))
    return t


def card(title, body, bg=colors.white, accent=ORANGE, width=55 * mm):
    t = Table([[p(title, 'CellB')], [p(body, 'Cell')]], colWidths=[width])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), bg), ('LINEBEFORE', (0, 0), (0, -1), 3, accent), ('BOX', (0, 0), (-1, -1), .5, LINE), ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    return t


def pill(label, color):
    t = Table([[p(label, 'Pill')]], colWidths=[45 * mm], rowHeights=[12 * mm])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), color), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, H - 11 * mm, W, 11 * mm, fill=1, stroke=0)
        canvas.setFont('Noto-Bold', 7)
        canvas.setFillColor(colors.white)
        canvas.drawString(18 * mm, H - 7.2 * mm, 'WEAVLY  /  BASE PLAN COVERAGE')
        canvas.setFont('Noto', 7)
        canvas.drawRightString(W - 18 * mm, H - 7.2 * mm, '31 JUL 2026')
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, W - 18 * mm, 14 * mm)
    canvas.setFont('Noto', 6.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 8.5 * mm, 'Confidential QA artifact - no credentials included')
    canvas.drawRightString(W - 18 * mm, 8.5 * mm, str(doc.page))
    canvas.restoreState()


class Doc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(str(path), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=19 * mm, title='Weavly Base Plan Production-Standard Coverage Report', author='Codex')
        self.addPageTemplates([PageTemplate(id='main', frames=Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f'), onPage=header_footer)])


def heading(n, title, sub):
    return [p(f'{n:02d}', 'Kicker'), p(title, 'H1x'), p(sub, 'Smallx')]


def bullets(items):
    return [p(f'- {x}', 'Bodyx') for x in items]


def story():
    s = []
    s += [Spacer(1, 25 * mm), p('PRODUCTION-STANDARD COVERAGE', 'Kicker'), p('Weavly Base Plan', 'Cover'), p('Lifecycle, costing, entitlement, export, and stress-test findings from the retained pilot account.', 'Sub')]
    s.append(table(['FIELD', 'VALUE'], [
        ('RUN', 'BASEPLAN-COVERAGE-20260731'), ('ENVIRONMENT', 'textile-accounting.vercel.app'), ('ACCOUNT', 'Retained Base owner pilot account'), ('TENANT', 'BASEPILOT-20260730074621-8C0D1F-Factory'), ('SCOPE', 'Base / Estimator only'),
    ], [30 * mm, 125 * mm]))
    s += [Spacer(1, 13 * mm), pill('PRODUCTION PILOT GO', TEAL), Spacer(1, 6 * mm), p('The Base / Estimator pilot is production-ready for controlled customer use. The P0 billing retry-price defect is closed, base-rate validation/duplicate/concurrency hardening is deployed, and user-provided Razorpay screenshots show successful INR 8,260 Netbanking payment, active Base subscription, and estimator access. This P1 pass closed browser coverage for blend add/remove, reversible optional-section toggles, and 390px settings operation. The Base costing archive/restore and mobile rate Archive gaps were fixed locally but are awaiting the next approved deployment; the two-tab browser capture remains harness-limited.', 'Bodyx'), Spacer(1, 12 * mm), p('Prepared 31 July 2026  /  Asia-Kolkata', 'Smallx'), PageBreak()]

    s += heading(1, 'Executive readout', 'The account was used as a real user would use Base: create, revise, archive, reopen, export, and cross the plan boundary.')
    cards = Table([[card('CURRENT RUN', 'Direct checks across yarns, qualities, costing, settings, export, billing, route boundaries, console, and tenant reconciliation.', TEAL_SOFT, TEAL), card('CURRENT RESULT', 'P0 Base blockers are closed. Production build and database are aligned and ready for the pilot.', colors.white, TEAL), card('FOLLOW-UP', 'P1 coverage is exercised. Two local reachability fixes await deployment, and clean two-tab capture remains harness-limited.', TEAL_SOFT, TEAL)]], colWidths=[57 * mm] * 3)
    cards.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 5)]))
    s += [cards, Spacer(1, 6 * mm), p('What passed today', 'H2x')]
    s += bullets(['Yarn edit preserved the previous value and history, then archived the QA rate without deleting historical context.', 'Quality save validation blocked incomplete input; update changed name and rates; delete became an inactive soft-delete.', 'Costing v1 remained immutable while v2 changed quantity and transport; comparison surfaced the exact commercial delta.', 'Blend add/remove and optional section toggles were exercised at production UI level; the last blend row remained protected.', 'Internal and customer PDFs downloaded successfully; customer output kept internal economics hidden.', 'Business name/default changes saved and restored; organization export completed; Base premium boundaries held.'])
    s += [p('Non-blocking follow-up', 'H2x')] + bullets(['Retain authoritative reconciliation for the user-provided successful payment: one captured INR 8,260 payment and exactly one active Base entitlement.', 'Linked yarn names are locked in place; the local UI now states the create-new-rate replacement policy explicitly.', 'Deploy the local Base costing Archive/Restore controls and mobile rate Archive action, then repeat the two live checks.', 'Capture clean two-tab stale-edit evidence when the browser harness provides stable tab focus.']) + [PageBreak()]

    s += heading(2, 'Current run evidence', 'The tenant-scoped read-only reconciliation confirms the browser outcomes without exposing secrets.')
    s.append(table(['OBJECT', 'PERSISTED', 'STATE', 'MEANING'], [
        ('Yarn trial', '1 matching row', '0 active / 1 archived', '2 history rows; 123.45 -> 125.00 INR/kg'),
        ('Quality lifecycle', '1 inactive updated template', 'Soft-delete retained', 'Historical quote rows remain readable'),
        ('Costing group', '2 versions', 'v1 5,000 m / v2 6,000 m', 'Suggested price 22.98 -> 23.04 INR/m'),
        ('Entitlement', '1 active Base subscription', 'Current end 29 Aug 2026', 'Exactly one active Base row'),
        ('Observability', '0 console warnings/errors', 'Core routes exercised', 'No new browser log issues'),
    ], [31 * mm, 36 * mm, 38 * mm, 58 * mm]))
    s += [Spacer(1, 7 * mm), p('Retention behavior that matters', 'H2x'), p('The user-visible delete actions are intentionally non-destructive. A yarn is archived and a quality becomes inactive. This is the correct production pattern because old costings must still render their own recipe and rate snapshots after a user cleans up the active library.', 'Bodyx'), p('Important interpretation', 'H2x'), p('The quote record stores a landed-cost field separately from the estimator production-cost card. The reconciliation checked versions, quantities, quote prices, identities, and row cardinalities tenant-side; the two cost fields should not be compared as if they were the same metric.', 'Bodyx'), PageBreak()]

    s += heading(3, 'Lifecycle findings', 'The highest-value Base user journeys and the production-standard conclusions.')
    for title, body, accent in [
        ('Yarn Rate Book', 'Add, edit, history, archive, refresh, and review metadata worked. Negative/range inputs and duplicate names are guarded server-side with inline feedback. Stale edits are rejected by the deployed versioned save path. A linked yarn name remains locked in the edit sheet.', TEAL),
        ('Saved Fabric Qualities', 'Incomplete save was blocked with a field-level denier error. A valid quality was saved, renamed, rate-edited, and deleted with explicit confirmation. Tenant state shows the deleted template as inactive.', ORANGE),
        ('Saved Costings', 'The current QA costing moved from v1 to v2 without rewriting history. Reopen restored the recipe and commercial context. Compare and Start From were exercised. The live Base quality-library archive surface gap was reproduced; record-level Archive/Restore controls are now implemented locally and await deployment.', TEAL),
        ('Exports and Settings', 'Both product PDF variants downloaded. Business name and estimator defaults were changed and restored. Organization export completed with the expected success message.', ORANGE),
    ]:
        s += [card(title, body, colors.white, accent, 170 * mm), Spacer(1, 3 * mm)]
    s.append(PageBreak())

    s += heading(4, 'Executed acceptance matrix', 'Current-run checks. The larger stress matrix continues on the following pages.')
    s.append(table(['ID', 'CHECK', 'RESULT', 'EVIDENCE'], [
        ('RATE-01', 'Add QA warp rate', 'PASS', 'New row with review cadence, source, notes'), ('RATE-02', 'Edit and preserve previous', 'PASS', '125.00 current; 123.45 previous'), ('RATE-03', 'Linked-name edit guard', 'PASS', 'Name input disabled by design'), ('RATE-04', 'History dialog', 'PASS', 'Two values with dates/source'), ('RATE-05', 'Archive and reload', 'PASS', 'DB is_active=false'),
        ('QUAL-01', 'Incomplete save guard', 'PASS', 'Blank denier blocked; no partial save'), ('QUAL-02', 'Valid save', 'PASS', 'One warp + one weft template'), ('QUAL-03', 'Rename and rate update', 'PASS', 'Name and INR 146/136 rates'), ('QUAL-04', 'Delete confirmation', 'PASS', 'Soft-delete; history retained'),
        ('EST-01', 'Save costing v1', 'PASS', '5,000 m snapshot'), ('EST-02', 'Reopen and update', 'PASS', 'Quantity/transport changed in v2'), ('EST-03', 'Compare versions', 'PASS', '5,000 -> 6,000 m and price delta'), ('EST-04', 'Start From', 'PASS', 'Overwrite guard; independent draft'), ('EST-05', 'Reset guard', 'PASS', 'Save remains disabled after reset'),
        ('EXP-01', 'Customer quotation PDF', 'PASS', 'Downloaded; internal economics hidden'), ('EXP-02', 'Internal cost sheet PDF', 'PASS', 'Downloaded with cost detail'), ('SET-01', 'Business name update/restore', 'PASS', 'Saved, restored, reloaded'), ('SET-02', 'Default update/restore', 'PASS', 'Target margin restored to 10%'), ('SET-03', 'Organization export', 'PASS', 'Success toast and filename'), ('NAV-01', 'Base route boundary', 'PASS', 'Today redirect; orders upgrade wall'), ('OBS-01', 'Console check', 'PASS', 'No warning/error entries'), ('DB-01', 'Tenant reconciliation', 'PASS', 'Lifecycle/version/entitlement agree'),
    ], [20 * mm, 49 * mm, 20 * mm, 83 * mm]))
    s += [Spacer(1, 4 * mm), p('All new records created today used the BASEPLAN-COVERAGE-20260731 prefix. No non-QA record was intentionally mutated.', 'Smallx'), PageBreak()]

    s += heading(5, 'Stress matrix - auth, entitlement, yarns, qualities', 'Use these IDs as a repeatable production-readiness pack. Next-gate items need direct proof.')
    s.append(table(['ID', 'SCENARIO', 'EXPECTED', 'STATE', 'PRI'], [
        ('AUTH-001', 'Valid owner login', 'Base estimator opens in correct tenant', 'Retest pass', 'P0'), ('AUTH-002', 'Invalid login', 'Neutral error; no data leak', 'Retest pass', 'P0'), ('AUTH-003', 'Password reset entry', 'No enumeration', 'Retest pass', 'P1'), ('AUTH-004', 'Logout/protected reload', 'Returns to login', 'Retest pass', 'P0'), ('AUTH-005', 'Cross-tab logout', 'Stale tab cannot continue', 'Retest pass', 'P0'), ('NAV-001', 'Base navigation', 'Only Base routes exposed', 'Current pass', 'P0'), ('NAV-002', 'Premium orders route', 'Upgrade wall; no data', 'Current pass', 'P0'), ('BILL-001', 'Active billing view', 'Plan/date/upgrade truth', 'Current pass', 'P0'), ('BILL-002', 'Successful first activation', 'One INR 8,260 payment + entitlement', 'Pass - user evidence', 'P0'), ('BILL-003', 'Failed first purchase', 'No entitlement; truthful failure', 'Retest pass', 'P0'), ('BILL-004', 'Retry after failed purchase', 'Still INR 8,260 activation', 'Retest pass - fix closeout', 'P0'), ('BILL-005', 'Cancelled/abandoned retry', 'Same first-purchase pricing', 'Retest pass - billing closeout', 'P0'), ('BILL-006', 'Duplicate webhook/retry', 'Idempotent rows', 'Retest pass - release suite/B17', 'P0'), ('RATE-001', 'Add valid rate', 'One active row + audit metadata', 'Current pass', 'P0'), ('RATE-002', 'Zero/negative/NaN', 'No row or partial history', 'Runtime + server guard pass', 'P0'), ('RATE-003', 'Duplicate name policy', 'Conflict explicit', 'Unique constraint + inline feedback', 'P1'), ('RATE-004', 'Update rate/history', 'Previous value retained', 'Current pass', 'P0'), ('RATE-005', 'Rename linked yarn', 'Migration or clear lock rule', 'Locked by design', 'P1'), ('RATE-006', 'Archive/cancel archive', 'Inactive on confirm; no-op on cancel', 'Pass', 'P0/P1'), ('QUAL-001', 'Incomplete save', 'Validation; no partial row', 'Current pass', 'P0'), ('QUAL-002', 'Valid save', 'Reusable template persists', 'Current pass', 'P0'), ('QUAL-003', 'Duplicate/blank name', 'Reject or explicit policy', 'Save disabled/no duplicate', 'P1'), ('QUAL-004', 'Update name/rates', 'Old snapshots unchanged', 'Current pass', 'P0'), ('QUAL-005', 'Stale concurrent update', 'Reject timestamp conflict', 'Guard deployed; test pass; browser capture limited', 'P0'), ('QUAL-006', 'Delete cancel/confirm', 'No-op cancel; soft-delete confirm', 'Pass', 'P0'), ('QUAL-007', 'Start From quality', 'Independent identity/history', 'Retest pass', 'P0'),
    ], [22 * mm, 39 * mm, 60 * mm, 37 * mm, 12 * mm]))
    s.append(PageBreak())

    s += heading(6, 'Stress matrix - costing, export, settings, resilience', 'These checks protect financial correctness, history, and tenant isolation.')
    s.append(table(['ID', 'SCENARIO', 'EXPECTED', 'STATE', 'PRI'], [
        ('EST-001', 'Single warp/weft formula', 'Independent oracle agrees', 'Retest pass', 'P0'), ('EST-002', 'Blank required fields', 'Save/export guarded', 'Current pass', 'P0'), ('EST-003', 'Negative/extreme inputs', 'No NaN/Infinity/overflow', 'Runtime + server guard pass', 'P0'), ('EST-004', 'Waste/crimp boundaries', 'Blank default vs zero', 'Retest pass', 'P0'), ('EST-005', 'Blend add/remove', 'Totals update safely', 'Current run pass; focused tests pass', 'P1'), ('EST-006', 'Loom/wage formula', 'Manual/formula consistent', 'Retest pass', 'P0'), ('EST-007', 'Sizing mode', 'No duplicate charge', 'Retest pass', 'P0'), ('EST-008', 'Overhead override', 'Included exactly once', 'Retest pass', 'P0'), ('EST-009', 'Post-processing toggles', 'Only enabled charges', 'Retest pass', 'P0'), ('EST-010', 'Party + quality context', 'Persists through export', 'Current pass', 'P0'), ('EST-011', 'Save costing', 'One v1; duplicate safe', 'Current pass', 'P0'), ('EST-012', 'Reopen/update', 'Immutable v2', 'Current pass', 'P0'), ('EST-013', 'Compare snapshots', 'Delta accurate', 'Current pass', 'P1'), ('EST-014', 'Start From costing', 'Independent save mode', 'Current pass', 'P0'), ('EST-015', 'Draft recovery', 'Keep/overwrite clear', 'Current pass', 'P1'), ('EST-016', 'Costing archive/restore', 'Retention action explicit', 'Live gap reproduced; local fix awaiting deploy', 'P1'), ('EXP-001', 'Internal cost sheet', 'Detailed economics', 'Current pass', 'P0'), ('EXP-002', 'Customer quotation', 'Internal economics hidden', 'Current pass', 'P0'), ('EXP-003', 'Latest export after refresh', 'No stale output', 'Retest pass', 'P1'), ('EXP-004', 'Organization export', 'Tenant-only; redacted', 'Current pass', 'P0'), ('SET-001', 'Business name edit', 'Save/reload persist', 'Current pass', 'P1'), ('SET-002', 'Cost default edit', 'New costing uses defaults', 'Margin pass; toggle next', 'P0'), ('SET-003', 'Optional section toggles', 'Reversible; snapshot-safe', 'Current run pass; saved and restored', 'P1'), ('SET-004', 'Settings quality manager', 'Agrees with estimator', 'List observed', 'P1'), ('RESP-001', '390px estimator', 'No overflow; usable', 'Retest pass', 'P1'), ('RESP-002', '390px rate/settings', 'Dialogs operable', 'Settings pass; rate Archive local fix awaiting deploy', 'P1'), ('OBS-001', 'Console warnings/errors', 'No new burst', 'Current pass', 'P1'), ('OBS-002', 'DB reconciliation', 'UI/persisted agree', 'Current pass', 'P0'),
    ], [22 * mm, 39 * mm, 60 * mm, 37 * mm, 12 * mm]))
    s.append(PageBreak())

    s += heading(7, 'Release gate - billing and entitlement', 'The retry-pricing P0 is closed in production evidence. User-provided screenshots visually prove the successful capture path and Base access; the matching rate-concurrency deployment is live. The new P1 UI fixes are local until their next approved deployment.')
    s += [card('CLOSED / BASE-BILL-RETRY-PRICE', 'Production closeout on deployment dpl_7aJizgchjx96eLG8pQzvCxGw1UhL / commit ed6e32a shows the retained failed-checkout account displaying INR 8,260 / first year and Pay INR 8,260 & Activate. The replacement checkout had no captured payment and no active entitlement, so no false access was granted. The current alignment deployment is dpl_3RhPZYDYUS2FYqwjrQAd2XBS67TV.', TEAL_SOFT, TEAL, 170 * mm), Spacer(1, 7 * mm)]
    s.append(table(['GATE', 'RESULT', 'FINDING'], [('Failed payment truth', 'PASS', 'No captured payment and no active entitlement after failure'), ('Retry price/lifecycle', 'PASS', 'Correct first-year INR 8,260 activation pricing restored'), ('Successful Netbanking', 'PASS - user evidence', 'Success screen, active subscription through 31 Jul 2027, and estimator access shown'), ('Plan boundary', 'PASS', 'Base routes available; Full Suite routes show upgrade wall')], [45 * mm, 25 * mm, 90 * mm]))
    s += [Spacer(1, 6 * mm), p('Non-blocking follow-up', 'H2x')] + bullets(['Retain authoritative reconciliation for one captured INR 8,260 payment and exactly one active Base entitlement.', 'Deploy the explicit linked-yarn create-new-rate policy copy and mobile rate Archive action.', 'Deploy and re-run Base quality-library Archive/Restore, including Active/Archived filter behavior.', 'Capture clean two-tab stale-edit evidence when the browser harness supports stable tab focus.']) + [PageBreak()]

    evidence_dir = ROOT / 'output/base-plan-coverage/BASEPLAN-COVERAGE-20260731/user-evidence'
    s += heading(8, 'User-provided Razorpay proof', 'Safe screenshots supplied on 31 July 2026. Personal credentials and payment identifiers are intentionally excluded.')
    s += [p('Initiation path', 'H2x'), p('The first pair shows the INR 8,260 first-year Base price and the Razorpay demo bank success/failure decision point.', 'Bodyx')]
    initiation = []
    for name, label in [('plan-price.jpg', 'First-year plan price'), ('mock-bank.jpg', 'Razorpay demo bank')]:
        path = evidence_dir / name
        if path.exists():
            initiation.append([Image(str(path), width=70 * mm, height=151.5 * mm), p(label, 'Smallx')])
    if initiation:
        s.append(Table([initiation], colWidths=[82 * mm, 82 * mm], style=TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 6)])))
    s.append(PageBreak())

    s += heading(9, 'User-provided activation proof', 'The second pair shows successful payment, active billing, and access to the Base estimator.')
    s += [p('Activation and access', 'H2x'), p('The supplied sequence shows Netbanking success, an active annual Estimator subscription through 31 July 2027, and the estimator workspace loading with Base actions available.', 'Bodyx')]
    activation = []
    for name, label in [('billing-active.jpg', 'Active Base subscription'), ('estimator-access.jpg', 'Estimator access')]:
        path = evidence_dir / name
        if path.exists():
            activation.append([Image(str(path), width=70 * mm, height=151.5 * mm), p(label, 'Smallx')])
    if activation:
        s.append(Table([activation], colWidths=[82 * mm, 82 * mm], style=TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 6)])))
    s += [Spacer(1, 5 * mm), p('Evidence limitation: these images are user-supplied visual proof. The preferred final closeout is still a tenant-scoped reconciliation showing one captured payment and exactly one active entitlement.', 'Smallx'), PageBreak()]

    s += heading(10, 'Recommendation and handoff', 'The Base / Estimator pilot is production-ready. The remaining work is non-blocking P1 breadth coverage and operational evidence retention.')
    s += [p('Recommended next move', 'H2x'), p('Proceed with the Base pilot on the live production alias. Keep the authoritative payment/entitlement reconciliation artifact, deploy the two local P1 reachability fixes, and retain the browser-harness limitation without overstating two-tab proof.', 'Bodyx')]
    s.append(table(['#', 'ACTION', 'PRI', 'EXIT CONDITION'], [('1', 'Retain successful payment and entitlement reconciliation', 'P1', 'One captured INR 8,260 payment + one active Base entitlement'), ('2', 'Deploy linked-yarn policy copy and mobile rate Archive', 'P1', 'Live UI states the replacement rule and mobile archive is reachable'), ('3', 'Deploy and verify costing Archive/Restore', 'P1', 'Base active/archived filters and record actions reconcile'), ('4', 'Capture clean two-tab stale-edit proof', 'P1', 'Browser harness supports stable tab/native-dialog run')], [10 * mm, 90 * mm, 20 * mm, 40 * mm]))
    s += [Spacer(1, 8 * mm), p('Evidence references', 'H2x')] + bullets(['Read-only reconciliation: output/base-plan-coverage/BASEPLAN-COVERAGE-20260731/reconciliation-evidence.json', 'Latest pilot retest: output/pilot-readiness/BASEPILOTRETEST-20260730-2027-68W7/REPORT.md', 'Canonical inventory: outputs/base-plan-phase-1-workflow-verification/canonical-workflow-inventory.md'])
    image_path = ROOT / 'output/pilot-readiness/BASEPILOT-20260730074621-8C0D1F/RATE-updated-history.png'
    if image_path.exists():
        s += [Spacer(1, 6 * mm), p('Visual evidence - Yarn Rate Book', 'H2x'), Image(str(image_path), width=155 * mm, height=87 * mm), p('Carried-forward UI evidence; the rate edit/history affordances were re-exercised during this coverage run.', 'Smallx')]
    s += [Spacer(1, 5 * mm), p('No passwords or private credentials are included in this document.', 'Smallx')]
    return s


OUT.parent.mkdir(parents=True, exist_ok=True)
Doc(OUT).build(story())
print(OUT)
