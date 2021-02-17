import * as Methods from "../methods";

module.exports = {
    name: "ready",
    run: () => {
        Methods.sortTickets();
        Methods.checkOldTickets();

        setInterval(Methods.sortTickets, 12000);
        setInterval(Methods.checkOldTickets, 15 * 60 * 1000);
    }
}