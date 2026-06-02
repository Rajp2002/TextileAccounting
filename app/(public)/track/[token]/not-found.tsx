export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            textAlign: 'center',
        }}>
            {/* Weavly brand bar */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                background: '#1A5C38',
                height: 6,
            }} />

            <div style={{ fontSize: 56, marginBottom: 20 }}>📦</div>

            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', margin: '0 0 8px' }}>
                Link Not Found
            </h1>
            <p style={{
                fontSize: 14,
                color: '#64748b',
                maxWidth: 320,
                lineHeight: 1.6,
                margin: '0 0 32px',
            }}>
                Public dispatch receipt confirmation is currently disabled. Please send the received challan to the factory owner so they can record received meters in Weavly.
            </p>

            <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 14,
                padding: '14px 20px',
                maxWidth: 300,
            }}>
                <p style={{ fontSize: 12, color: '#15803d', fontWeight: 700, margin: '0 0 4px' }}>
                    🧵 Powered by Weavly
                </p>
                <p style={{ fontSize: 11, color: '#4ade80', margin: 0 }}>
                    Factory-recorded dispatch receipts
                </p>
            </div>
        </div>
    )
}
