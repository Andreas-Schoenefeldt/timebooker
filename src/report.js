const fs = require("fs");
const byCustomer = require('../config/byCustomer');
const async = require("async");

module.exports = async function() {

    await async.series(Object.keys(byCustomer).map((customer) => {

        return async function () {
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
    }));

    return true;
}