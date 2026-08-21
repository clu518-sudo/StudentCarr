export const visitorUser = {
  id: "visitor-demo",
  name: "Visitor Demo",
  fullName: "Visitor Demo",
  email: "visitor@studentcarr.demo",
  authProvider: "visitor",
  role: "visitor",
};

export const visitorProfile = {
  personalInfo: {
    name: "Alex Morgan",
    headline: "Computer Science student · Frontend developer",
    summary:
      "<p>Final-year computer science student who enjoys turning complex workflows into accessible web experiences. Experienced with React, JavaScript, and collaborative product delivery.</p>",
    phone: "+64 21 555 0142",
    location: "Auckland, New Zealand",
    links: [
      { label: "Portfolio", url: "https://example.com/alex" },
      { label: "GitHub", url: "https://github.com/example" },
      { label: "LinkedIn", url: "https://linkedin.com/in/example" },
    ],
  },
  preferences: {
    preferredRoles: ["Graduate Software Engineer", "Frontend Developer"],
    preferredLocations: ["Auckland", "Remote"],
    workAuthorization: "Eligible to work in New Zealand",
    salaryRange: "NZD 65,000–80,000",
    availability: "Available from November 2026",
  },
  education: [
    {
      school: "University of Auckland",
      degree: "Bachelor of Science",
      fieldOfStudy: "Computer Science",
      startDate: "2023-02",
      endDate: "2026-11",
      grade: "A- average",
      description: "<p>Coursework in software engineering, data structures, databases, and human-computer interaction.</p>",
      isCurrent: true,
    },
  ],
  workExperience: [
    {
      company: "Harbour Digital",
      title: "Software Engineering Intern",
      location: "Auckland",
      startDate: "2025-11",
      endDate: "2026-02",
      isCurrent: false,
      description: "<p>Built and tested reusable React components for a customer portal.</p>",
      achievements: [
        "Reduced a key form completion time by 25%",
        "Added component tests to the team delivery workflow",
      ],
    },
  ],
  projects: [
    {
      name: "StudentCarr",
      role: "Product developer",
      description: "<p>Designed a career workspace that brings profile, skills, applications, and interview preparation into one experience.</p>",
      technologies: ["React", "Vite", "Tailwind CSS"],
      startDate: "2026-03",
      endDate: "",
      projectUrl: "https://example.com/studentcarr",
      repositoryUrl: "https://github.com/example/studentcarr",
    },
    {
      name: "Campus Event Finder",
      role: "Frontend lead",
      description: "<p>Created a responsive event discovery app used in a university design project.</p>",
      technologies: ["JavaScript", "React", "REST APIs"],
      startDate: "2025-07",
      endDate: "2025-10",
      projectUrl: "",
      repositoryUrl: "https://github.com/example/events",
    },
  ],
  skills: [
    { name: "JavaScript", level: "Advanced", category: "Programming", yearsOfExperience: "3", keywords: ["ES6", "Async"] },
    { name: "React", level: "Advanced", category: "Frontend", yearsOfExperience: "2", keywords: ["Hooks", "Context"] },
    { name: "CSS", level: "Advanced", category: "Frontend", yearsOfExperience: "3", keywords: ["Responsive design", "Accessibility"] },
    { name: "Node.js", level: "Intermediate", category: "Backend", yearsOfExperience: "1", keywords: ["Express"] },
    { name: "Git", level: "Advanced", category: "Tools", yearsOfExperience: "3", keywords: ["GitHub", "Code review"] },
  ],
  certifications: [
    {
      name: "AWS Cloud Practitioner Essentials",
      issuer: "AWS Skill Builder",
      issueDate: "2026-05",
      expiryDate: "",
      credentialId: "DEMO-AWS-2026",
      credentialUrl: "https://example.com/credential",
    },
  ],
};

export const visitorDocuments = [
  {
    id: "demo-resume",
    documentType: "Resume",
    originalName: "Alex_Morgan_Resume.pdf",
    size: 184320,
    parserStatus: "completed",
    uploadedAt: "2026-08-12T03:15:00.000Z",
  },
  {
    id: "demo-transcript",
    documentType: "Transcript",
    originalName: "Academic_Transcript.pdf",
    size: 263168,
    parserStatus: "completed",
    uploadedAt: "2026-08-10T22:40:00.000Z",
  },
];

export const visitorApplications = [
  {
    id: "demo-app-1",
    companyName: "Koru Labs",
    positionTitle: "Graduate Software Engineer",
    status: "invited",
    lastUpdatedAt: "2026-08-19T02:30:00.000Z",
  },
  {
    id: "demo-app-2",
    companyName: "Northstar Health",
    positionTitle: "Junior Frontend Developer",
    status: "under_review",
    lastUpdatedAt: "2026-08-17T23:10:00.000Z",
  },
  {
    id: "demo-app-3",
    companyName: "Tui Systems",
    positionTitle: "Software Developer Intern",
    status: "applied",
    lastUpdatedAt: "2026-08-15T04:45:00.000Z",
  },
];

export const visitorEmailsByApplicationId = {
  "demo-app-1": [
    {
      id: "demo-email-invite",
      applicationId: "demo-app-1",
      subject: "Interview invitation — Graduate Software Engineer",
      sender: "Mia Chen · Koru Labs",
      senderEmail: "mia.chen@korulabs.example",
      contactEmail: "mia.chen@korulabs.example",
      date: "2026-08-19T02:30:00.000Z",
      intent: "invite",
      companyName: "Koru Labs",
      positionTitle: "Graduate Software Engineer",
      summary: "Invitation to a 45-minute video interview with the engineering team.",
      body: "<p>Hi Alex,</p><p>We enjoyed reviewing your application and would like to invite you to a video interview next Tuesday at 10:30am.</p><p>Kind regards,<br/>Mia</p>",
      replyCount: 1,
      replies: [
        {
          id: "demo-reply-1",
          subject: "Re: Application received",
          sender: "Alex Morgan",
          date: "2026-08-14T01:10:00.000Z",
          depth: 1,
          summary: "Thanked the recruiter for the update.",
          body: "<p>Thanks for the update. I look forward to hearing from the team.</p>",
        },
      ],
      draftText: "<p>Hi Mia,</p><p>Thank you for the invitation. Tuesday at 10:30am works well for me, and I’m looking forward to meeting the engineering team.</p><p>Kind regards,<br/>Alex Morgan</p>",
    },
  ],
  "demo-app-2": [
    {
      id: "demo-email-review",
      applicationId: "demo-app-2",
      subject: "Your application is under review",
      sender: "Northstar Health Careers",
      senderEmail: "careers@northstar.example",
      date: "2026-08-17T23:10:00.000Z",
      intent: "follow_up",
      companyName: "Northstar Health",
      positionTitle: "Junior Frontend Developer",
      summary: "The hiring team expects to provide an update within five business days.",
      body: "<p>Thanks for applying. Your application is now with our hiring team for review.</p>",
      replyCount: 0,
      replies: [],
    },
  ],
  "demo-app-3": [
    {
      id: "demo-email-applied",
      applicationId: "demo-app-3",
      subject: "Application received — Tui Systems",
      sender: "Tui Systems Recruitment",
      senderEmail: "recruitment@tui.example",
      date: "2026-08-15T04:45:00.000Z",
      intent: "applied_confirmation",
      companyName: "Tui Systems",
      positionTitle: "Software Developer Intern",
      summary: "Confirmation that the application was received.",
      body: "<p>We have received your application and will be in touch if your experience matches the role.</p>",
      replyCount: 0,
      replies: [],
    },
  ],
};

export const visitorInterviewDraft =
  "<p>Hi Mia,</p><p>Thank you for the invitation. Tuesday at 10:30am works well for me, and I’m looking forward to meeting the engineering team.</p><p>Kind regards,<br/>Alex Morgan</p>";

export const demoDisabledMessage =
  "This feature is disabled in visitor mode until the backend is deployed.";
