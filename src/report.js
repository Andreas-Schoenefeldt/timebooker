import byCustomer from "./../config/byCustomer.js";
import * as fs from "node:fs";

async function report(customer) {
    const customerConf = byCustomer[customer];

    if (customerConf.report) {

        const file = `./data/${customer}_times.csv`;

        if (fs.existsSync(file)) {
            const hours = await customerConf.report(`./data/${customer}_times.csv`);
            console.log('%o hours for %o booked', typeof hours === 'number' ? hours.toFixed(2) : hours, customer);
        } else {
            console.log('No times available for %o', customer);
        }
        console.log('------------------------------------------------------------');
    } else {
        // silent ignore
        // console.log('No report function defined for %o', customer);
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