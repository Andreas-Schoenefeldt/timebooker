import byCustomer from "./../config/byCustomer.js";
import async from "async";


export default async function (conf) {

    let comment = '';

    await async.series(Object.keys(byCustomer).map((customer) => {

        return async function () {
            const customerConf = byCustomer[customer];

            if (customerConf.comment && conf.data && conf.data[customer]) {
                comment += await customerConf.comment({
                    action: conf.answers.action,
                    data: conf.data[customer]
                })
            }
        }
    }));

    return comment;
}