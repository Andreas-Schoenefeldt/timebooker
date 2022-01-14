const fs = require("fs");
const byCustomer = require('./config/byCustomer');

Object.keys(byCustomer).forEach(async (customer) => {

    const customerConf = byCustomer[customer];

    if (customerConf.report) {

        const file = `./data/${customer}_times.csv`;

        if (fs.existsSync(file)) {
            await customerConf.report(`./data/${customer}_times.csv`);
            console.log('All times for %o booked');
        } else {
            console.log('No times available for %o', customer);
        }
    } else {
        console.log('No report function defined for %o', customer);
    }
});