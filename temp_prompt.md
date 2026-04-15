# Task

wirte a prompt for me to solve this task:

Now I need build a langgraph AI workflow, to implement a function wich extract information from data base, and generate user information needed for user.

# Instruction

1. input is plain text of resume, transcript, essay, working related infomation and so on.
2. the langgraph workflow used to extract formated information my applicarion needed for later used for those text.
3. this function should build inside "AIServices\src"
4. output data will sent back to frontend through recent backend.
   - recent data send back to frontend through "Backend\src\profileManagement\pm.service.js".
   - and recent send backed data are dummy data, replace those data with AI workflow output data
     js```
     const createDummyGeneratedProfile = (currentManualProfile, documents) => {
     const hasTranscript = documents.some(
     (doc) => doc.documentType === "Transcript",
     );
     const hasWorkHistory = documents.some(
     (doc) =>
     doc.documentType === "Working History & Related Project Description",
     );
     const hasProject = documents.some((doc) => doc.documentType === "Project");
     const hasCertification = documents.some(
     (doc) => doc.documentType === "Certification",
     );
     const hasResume = documents.some((doc) => doc.documentType === "Resume");

const generated = {
...currentManualProfile,
personalInfo: {
...currentManualProfile.personalInfo,
headline: hasResume
? "Full-Stack Software Engineer | React, Node.js, Prisma"
: currentManualProfile.personalInfo.headline,
summary: hasResume
? "Results-driven engineer with hands-on experience building full-stack web applications, integrating APIs, and delivering production-ready features."
: currentManualProfile.personalInfo.summary,
},
};

if (hasTranscript) {
generated.education = [
{
school: "Dummy University",
degree: "Bachelor of Science",
fieldOfStudy: "Computer Science",
startDate: "2019-09",
endDate: "2023-06",
grade: "3.8 / 4.0",
description:
"Focused on software engineering, databases, and distributed systems.",
isCurrent: false,
},
];
}

if (hasWorkHistory) {
generated.workExperience = [
{
company: "Dummy Tech Co.",
title: "Software Engineer",
location: "Remote",
startDate: "2023-07",
endDate: "",
isCurrent: true,
description:
"Built and maintained full-stack features using React and Node.js, improving delivery speed and reliability.",
achievements: [
"Delivered 12+ customer-facing features",
"Reduced API error rate by 30%",
],
},
];
}

if (hasProject) {
generated.projects = [
{
name: "Student Career Platform",
role: "Full-Stack Developer",
description:
"Developed a profile and document workflow with role-based authentication and API-driven architecture.",
technologies: ["React", "Node.js", "Express", "Prisma", "SQLite"],
startDate: "2024-01",
endDate: "",
projectUrl: "https://example.com/student-career",
repositoryUrl: "https://github.com/example/student-career",
},
];
}

if (hasCertification) {
generated.certifications = [
{
name: "AWS Certified Cloud Practitioner",
issuer: "Amazon Web Services",
issueDate: "2024-05",
expiryDate: "2027-05",
credentialId: "DUMMY-AWS-12345",
credentialUrl: "https://www.credly.com/",
},
];
}

if (hasResume) {
generated.skills = [
{
name: "JavaScript",
level: "Advanced",
category: "Programming Language",
yearsOfExperience: 3,
keywords: ["ES6+", "Async/Await", "Node.js"],
},
{
name: "React",
level: "Advanced",
category: "Frontend",
yearsOfExperience: 3,
keywords: ["Hooks", "Component Design", "State Management"],
},
{
name: "SQL",
level: "Intermediate",
category: "Database",
yearsOfExperience: 2,
keywords: ["Joins", "Indexing", "Query Optimization"],
},
];
}

return generated;
};

/_
Need be replaced by real AI workflow implementation
_/
const generateManualProfileForUserDummy = async (userId, onProgress) => {
const current = await getProfileForUser(userId);
if (!current.documents.length) {
const error = new Error(
"Upload at least one document before generating profile content",
);
error.statusCode = 400;
throw error;
}

if (onProgress) {
onProgress("Analyzing uploaded documents...");
}
await sleep(1200);

if (onProgress) {
onProgress("Extracting profile details...");
}
await sleep(1300);

const generatedManualProfile = createDummyGeneratedProfile(
current.manualProfile,
current.documents,
);

if (onProgress) {
onProgress("Saving generated profile...");
}
await sleep(1500);

await upsertManualProfileForUser(userId, generatedManualProfile);
return getProfileForUser(userId);
};

```


```

# output

save the output prompt to a new file.
