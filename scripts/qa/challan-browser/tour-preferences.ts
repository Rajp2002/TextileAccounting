// Harness stand-in for the tour preference server action, which needs a real session.
export async function recordTourEventAction() {
    return { success: true as const }
}
