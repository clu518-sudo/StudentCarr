import { syncProgressTrackingForUser } from "../processTracking/pt.service.js";

const runProgressTracking = async (userId, message) => {
    /*
        message: used as tag, indecating which function to run. 
                recent value(s): getEmails ......
     */
    
    
    // get job hunting related emails
    if (message == "getEmails") {
        const { sync: result } = await syncProgressTrackingForUser(userId);
    };

    // Todo
    // if there more functions in the furture

    return { result };
};

export { runProgressTracking };