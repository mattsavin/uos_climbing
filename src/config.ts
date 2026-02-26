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
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "secretary",
            title: "Secretary",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "treasurer",
            title: "Treasurer",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "welfare-inclusions",
            title: "Welfare & Inclusions",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "team-captain",
            title: "Team Captain",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "social-sec",
            title: "Social Sec",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "womens-captain",
            title: "Women's Captain",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "mens-captain",
            title: "Men's Captain",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "publicity",
            title: "Publicity",
            description: "Committee elections are currently ongoing as we establish our new club structure."
        },
        {
            id: "kit-safety-sec",
            title: "Kit & Safety Sec",
            description: "Committee elections are currently ongoing as we establish our new club structure."
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

    // Session Types
    sessionTypes: [
        { id: "Competition", label: "Competition" },
        { id: "Social", label: "Social" },
        { id: "Training Session (Bouldering)", label: "Training Session (Bouldering)" },
        { id: "Training Session (Roped)", label: "Training Session (Roped)" },
        { id: "Meeting", label: "Meeting" }
    ],

    // Calendar Filters
    calendarFilters: [
        { id: "all", label: "All", default: true },
        { id: "basic", label: "Basic" },
        { id: "bouldering", label: "Bouldering" },
        { id: "comp_team", label: "Comp Team" }
    ]
};
