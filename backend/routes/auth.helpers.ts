export function isSheffieldEmail(email: string): boolean {
    return email.toLowerCase().endsWith('@sheffield.ac.uk');
}

export function getAcademicYear(now = new Date()): string {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return currentMonth < 8
        ? `${currentYear - 1}/${currentYear}`
        : `${currentYear}/${currentYear + 1}`;
}