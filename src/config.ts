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
    ],

    // Committee Members (Actual People)
    committeeMembers: [
        {
            roleId: "president",
            name: "Henry Hogg",
            instagram: "",
            faveCrag: "Unknown"
        }
        // More can be added as they are elected
    ],

    // FAQ Data
    faqs: [
        {
            question: "Do I need my own gear to start?",
            answer: "No! We provide climbing shoes and harnesses for hire during our weekly meets. Most beginners start with just a pair of comfortable gym clothes."
        },
        {
            question: "How do I join the competition team?",
            answer: "Team trials are held at the start of each semester. We look for both technical ability and potential. Keep an eye on our Instagram for trial dates!"
        },
        {
            question: "Are memberships refundable?",
            answer: "Memberships are generally non-refundable as they cover insurance and club affiliation costs. Contact the treasurer if you have exceptional circumstances."
        },
        {
            question: "Can I join if I've never climbed before?",
            answer: "Absolutely. Most of our members started as complete beginners. Our Tuesday social meets are designed specifically to be welcoming for newcomers."
        }
    ],

    // Local Walls Data
    walls: [
        {
            name: "The Foundry",
            type: "Leading / Bouldering",
            description: "The UK's first dedicated climbing wall and a Sheffield legend. Great for both ropes and bouldering.",
            distance: "15 min walk from West Street",
            discount: "Student Deals"
        },
        {
            name: "Depot Sheffield",
            type: "Bouldering",
            description: "Huge modern bouldering gym with hundreds of problems for all levels. Host to many national comps.",
            distance: "Short tram ride",
            discount: "Student Deals"
        },
        {
            name: "Awesome Walls",
            type: "Leading / Speed",
            description: "Home to incredible lead walls and a dedicated speed climbing lane. Perfect for endurance training.",
            distance: "20 min tram ride",
            discount: "Concession rates available"
        },
        {
            name: "The Climbing Works",
            type: "Bouldering",
            description: "World-famous international bouldering centre. Great for technical training and slab work.",
            distance: "25 min bus ride",
            discount: "Student Deals"
        }
    ]
};
