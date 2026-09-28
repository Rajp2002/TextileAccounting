/**
 * Turns the logo's alpha into a brocade draft: one row per weft pass, one
 * column per warp end. Cells are 0 (ground weave), 128 (saffron float on the
 * face) or 255 (a binding point that ties a long float down).
 */

/** Opaque bounding box of the mark inside public/images/WeavlyLogo.png (1024x853). */
export const LOGO_SOURCE = { src: '/images/WeavlyLogo.png', width: 1024, height: 853 }
export const LOGO_INK_BOX = { x0: 90, y0: 194, x1: 912, y1: 667 }

export const FIGURE = 128
export const BINDING = 255
const COVERAGE_THRESHOLD = 0.42
const BIND_EVERY = 10

export type WeaveMask = {
    rows: number
    cols: number
    /** rows * cols cells, row-major. */
    data: Uint8Array
    /** First row containing saffron, and the mean column of the first saffron rows. */
    firstRow: number
    firstCol: number
}

/**
 * @param alpha  alpha channel (0..255) of the ink box, row-major, `width * height` values
 * @param rows   weft passes across the ink height
 */
export function buildWeaveMask(alpha: ArrayLike<number>, width: number, height: number, rows: number): WeaveMask {
    const cell = height / rows
    const cols = Math.round(width / cell)
    const cw = width / cols
    const fig = new Uint8Array(rows * cols)

    for (let r = 0; r < rows; r++) {
        const y0 = Math.floor(r * cell)
        const y1 = Math.max(y0 + 1, Math.floor((r + 1) * cell))
        for (let q = 0; q < cols; q++) {
            const x0 = Math.floor(q * cw)
            const x1 = Math.max(x0 + 1, Math.floor((q + 1) * cw))
            let sum = 0
            let n = 0
            for (let y = y0; y < y1 && y < height; y++) {
                for (let x = x0; x < x1 && x < width; x++) {
                    sum += alpha[y * width + x]
                    n++
                }
            }
            fig[r * cols + q] = n > 0 && sum / n / 255 > COVERAGE_THRESHOLD ? 1 : 0
        }
    }

    const data = new Uint8Array(rows * cols)
    for (let r = 0; r < rows; r++) {
        let q = 0
        while (q < cols) {
            if (!fig[r * cols + q]) { q++; continue }
            let e = q
            while (e < cols && fig[r * cols + e]) e++
            for (let c = q; c < e; c++) data[r * cols + c] = FIGURE
            // Tie down long floats, staggered from row to row like a real brocade.
            if (e - q > BIND_EVERY) {
                for (let c = q + ((r * 2) % BIND_EVERY) + 1; c < e - 1; c += BIND_EVERY) data[r * cols + c] = BINDING
            }
            q = e
        }
    }

    let firstRow = 0
    while (firstRow < rows && !fig.subarray(firstRow * cols, (firstRow + 1) * cols).some(Boolean)) firstRow++
    let sum = 0
    let count = 0
    for (let r = firstRow; r < Math.min(rows, firstRow + 10); r++) {
        for (let q = 0; q < cols; q++) {
            if (fig[r * cols + q]) { sum += q; count++ }
        }
    }

    return { rows, cols, data, firstRow: Math.min(firstRow, rows - 1), firstCol: count ? sum / count : cols / 2 }
}
