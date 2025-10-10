const fs = require("fs");
const byCustomer = require('../config/byCustomer');
const csv = require("fast-csv");
const needle = require("needle");

async function report(customer) {
    const customerConf = byCustomer[customer];

    if (customerConf.report) {

        const file = `./data/${customer}_times.csv`;

        if (fs.existsSync(file)) {
            await customerConf.report(`./data/${customer}_times.csv`, {
                csv, needle, fs
            });
            console.log('All times for %o booked', customer);
        } else {
            console.log('No times available for %o', customer);
        }
    } else {
        console.log('No report function defined for %o', customer);
    }

    return true;
}

module.exports = async function(customerOrAll = 'all') {

    if (customerOrAll === 'all') {

        for (let customer of Object.keys(byCustomer)) {
            await report(customer);
        }
    } else {
        await report(customerOrAll);
    }

    return true;
}