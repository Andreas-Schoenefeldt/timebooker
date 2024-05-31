const fs = require("fs");
const byCustomer = require('../config/byCustomer');
const async = require("async");

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

module.exports = async function(customerOrAll = 'all') {

    if (customerOrAll === 'all') {
        await async.series(Object.keys(byCustomer).map((customer) => {
            return report(customer);
        }));
    } else {
        await report(customerOrAll);
    }

    return true;
}