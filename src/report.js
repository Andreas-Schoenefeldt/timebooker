import byCustomer from "./../config/byCustomer.js";
import * as fs from "node:fs";

async function report(customer) {
    const customerConf = byCustomer[customer];

    if (customerConf.report) {

        const file = `./data/${customer}_times.csv`;

        if (fs.existsSync(file)) {
            await customerConf.report(`./data/${customer}_times.csv`);
            console.log('All times for %o booked', customer);
        } else {
            console.log('No times available for %o', customer);
        }
    } else {
        console.log('No report function defined for %o', customer);
    }

    return true;
}

export default async function(customerOrAll = 'all') {

    if (customerOrAll === 'all') {

        for (let customer of Object.keys(byCustomer)) {
            await report(customer);
        }
    } else {
        await report(customerOrAll);
    }

    return true;
}