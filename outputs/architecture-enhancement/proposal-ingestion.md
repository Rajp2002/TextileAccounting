# Proposal ingestion record

## Result

PASS - The attached Narola Infotech proposal was located, confirmed by content, copied into the repository without modification, and reopened successfully.

## Source and preserved copy

- Original attachment path: `/tmp/codex-remote-attachments/019f65b5-b52f-7bf1-89bc-f5ae9bdc1be6/7F9A4174-0C01-4433-8534-450CD5DAE13A/1-Commercial-20-20Technical-20Proposal-20for-20Weavly.pdf.pdf`
- Stable repository path: `docs/reference/narola-weavly-commercial-technical-proposal.pdf`
- Copy method: direct filesystem copy; no compression, rewrite, metadata edit, or PDF regeneration

## Identity confirmation

The document was not accepted based on its filename alone. Text extraction and rendered-page inspection confirmed all identifying characteristics:

- Prepared by Narola Infotech representatives Urvesh Sojitra and Vrushal Meruliya (page 1)
- Addressed to Raj Patel (page 1)
- Describes a greenfield, multi-tenant textile manufacturing operations SaaS for Indian grey-fabric weaving factories (pages 1-2)
- Contains Option A, a standalone Estimator Product (pages 3-4)
- Contains Option B, the Full Weavly Suite (pages 5-8)
- Contains technical architecture, security, QA, pricing, timeline, warranty, and handover sections (pages 10-18)

## File validation

| Attribute | Recorded value |
|---|---|
| File type | PDF 1.4 |
| File size | 4,211,132 bytes |
| Page count | 22 |
| PDF metadata title | Commercial & Technical Proposal for Weavly |
| Displayed document title | Greenfield multi-tenant textile manufacturing operations SAAS |
| Agency | Narola Infotech |
| Recipient | Raj Patel |
| Named preparers | Urvesh Sojitra; Vrushal Meruliya |
| Proposal date | Not stated in the document or PDF metadata |
| SHA-256 | `42ed3d628850509e1ec3a431e6588012fb0d8d71d2641988cf84f7c476f53c74` |

The source and repository copy produced the same SHA-256 checksum. `pypdf` reopened the repository copy, read 22 pages, extracted non-empty first-page text, and returned the expected metadata title. All 22 pages were rendered with PyMuPDF and reviewed through four contact sheets; the proposal is legible and has no visible corruption.

## Tooling note

Poppler (`pdfinfo` and `pdftotext`) was not installed in the execution environment. The PDF was therefore inspected with `pypdf` for metadata/text and PyMuPDF for raster rendering. This did not alter either PDF.
