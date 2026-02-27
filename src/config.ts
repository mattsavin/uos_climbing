/**
 * Central configuration for the USCC Web Application.
 * This file contains data that is dynamically rendered across the site to avoid hardcoding.
 */

export const config = {
    // Global site strings
    academicYear: "2026/27",

    // Committee Roles available for election and display
    committeeRoles: [
        {
            id: "president",
            title: "President",
            description: "Leads the committee, sets priorities, and represents the club across the university."
        },
        {
            id: "secretary",
            title: "Secretary",
            description: "Coordinates committee operations, agendas, and key club communications."
        },
        {
            id: "treasurer",
            title: "Treasurer",
            description: "Manages budgeting, spend approvals, and financial planning for club activity."
        },
        {
            id: "welfare-inclusions",
            title: "Welfare & Inclusions",
            description: "Supports member wellbeing and inclusion across socials, training, and competitions."
        },
        {
            id: "team-captain",
            title: "Team Captain",
            description: "Leads competition planning, athlete coordination, and event-day team management."
        },
        {
            id: "social-sec",
            title: "Social Sec",
            description: "Plans socials and community events to keep the club welcoming and connected."
        },
        {
            id: "womens-captain",
            title: "Women's Captain",
            description: "Represents and supports women in the club across training and competition pathways."
        },
        {
            id: "mens-captain",
            title: "Men's Captain",
            description: "Represents and supports men in the club across training and competition pathways."
        },
        {
            id: "publicity",
            title: "Publicity",
            description: "Runs club publicity, digital comms, and promotion of sessions, socials, and results."
        },
        {
            id: "kit-safety-sec",
            title: "Kit & Safety Sec",
            description: "Oversees gear inventory, hire workflows, and day-to-day safety standards."
        }
    ],

    // Membership Types
    membershipTypes: [
        { id: "basic", label: "Basic Membership (All Members)" },
        { id: "bouldering", label: "Bouldering Add-on" },
        { id: "comp_team", label: "Competition Team Only" }
    ],

    // Membership Add-on Options (for Dashboard additional membership requests)
    membershipAddons: [
        { id: "basic", label: "Basic Membership" },
        { id: "bouldering", label: "Bouldering Add-on" },
        { id: "comp_team", label: "Competition Team" }
    ],

    // Calendar Filters
    calendarFilters: [
        { id: "all", label: "All", default: true },
        { id: "basic", label: "Basic" },
        { id: "bouldering", label: "Bouldering" },
        { id: "comp_team", label: "Comp Team" }
    ]
};
