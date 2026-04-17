# Task

wirte a prompt for me to solve this task

build the AI related function for "Progress Tracking", build the langgraph workflow, to read gmail, breif summrize, recognize important enteries, classify email and write a reply with human-in-the-loop, which need review by user.

# Instruction

0. read potential related file in this repo first
1. all the frontend development is finished
2. backend only have dummy data and interface, after implemented this AI service, those dummy data need be replaced
3. have sure the connection between AI service and backend, do not mess up data.
4. check if there need more function at backend and frontend to verify gmail user infomation.
5. the extracted and raw email data both need to be saved in to database.
6. the AI workflow extract enteries, which use by frontend like, company name, email address, job position.
   - This work is very important, because frontend nest components are reply on those information.
   - the AI workflow need check database to make sure is the position (company and position need to be same at same time) exit, and then save this email related to this position.
7. add operation logic:
   - add a button to trigger AL workflow to get email information.
   - if there is already have data at frontend, AI only ready unready email.
   - the first time run only read recent 7 days email
   - the AI workflow can read title first, then decide which email need further operation.
8. AI langgraph workflow should build in AIService/ folder, and all AI sverice is start separatly from backend, backend need fetch data from AI serices port.

# output

save the output prompt to a new file.
