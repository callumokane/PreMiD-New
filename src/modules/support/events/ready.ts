import * as Methods from "../methods";

module.exports = {
    name: "ready",
    run: () => {
        Methods.sortTickets();
        Methods.updateTopic();
        Methods.checkOldTickets();
        
        setInterval(Methods.sortTickets, 12000);
        setInterval(Methods.updateTopic, 32000);
        setInterval(Methods.checkOldTickets, 15 * 60 * 1000);
    }
}