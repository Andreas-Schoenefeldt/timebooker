const fs = require("fs");
const csv = require("fast-csv");
const math = require("mathjs");
const inquirer = require("inquirer");
const async = require("async");
const activities = require("./../config/activities.json");
const byCustomer = require("./../config/byCustomer");

const ignoreMap = {};

module.exports = function (reportsPath) {
    if (fs.existsSync(reportsPath)) {
        const entries = [];

        csv.parseFile(reportsPath, { headers: true, comment: '#' }).on("data", (row) => {
            if (row.Day) {

                const activity = row.Activity;

                const regex = /=TIME\((\d+);(\d+);(\d+)\)/gm;
                const m = regex.exec(row.Total);
                const minutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

                if (minutes > 1) {

                    const dayParts =  row.Day.split('.');
                    const time = math.ceil( minutes/ 15) * 15 / 60;

                    const info = row.Info.split("\n").map((line) => {
                        return line.substr(6);
                    });

                    entries.push({
                        activity,
                        minutes,
                        time,
                        info,
                        date: `${dayParts[2]}-${dayParts[1]}-${dayParts[0]}`
                    })
                }
            }
        }).on('end', () => {

            const entriesByCustomers = {};

            const processLine = function (entry, callback) {
                if (!ignoreMap[entry.activity]) {

                    if (activities[entry.activity]) {
                        const tickets = {};
                        const activityConf = activities[entry.activity];
                        const customer = activityConf.customer;

                        if (!customer) {
                            throw new Error('No customer defined for ' + entry.activity);
                        }

                        if (!entriesByCustomers[customer]) {
                            entriesByCustomers[customer] = {
                                result: [],
                                perDay: {}
                            }
                        }

                        entry.info.forEach( (comment) => {
                            let ticket;

                            if (byCustomer[customer]) {
                                const res = byCustomer[customer].parseTicketAndComment(comment);
                                ticket = res.ticket || ticket;
                                comment = res.comment;
                            } else {
                                throw new Error('missing byCustomer line parser configuration for ' + customer);
                            }

                            if (!ticket) {
                                const cleanComment = comment.toLocaleLowerCase();

                                if (activityConf && activityConf.autoTickets && activityConf.autoTickets[cleanComment]) {
                                    ticket = activityConf.autoTickets[cleanComment];
                                } else if (activityConf.defaultTicket) {
                                    ticket = activityConf.defaultTicket;
                                }
                            }

                            if (!ticket) {
                                console.log(entry);
                                throw new Error('unknown ticket: ' + comment);
                            }

                            if (!tickets[ticket]) {
                                tickets[ticket] = {
                                    maxWeight: entry.info.length,
                                    weight: 0,
                                    comments: []
                                }
                            }

                            tickets[ticket].weight++;
                            tickets[ticket].comments.push(comment || 'development & bugfixing');
                        })

                        const unit = 0.25;
                        const ticketNumbers = Object.keys(tickets);
                        let available = entry.time / unit - ticketNumbers.length;
                        let usedWeights = 0;

                        if (!entriesByCustomers[customer].perDay[entry.date]) {
                            entriesByCustomers[customer].perDay[entry.date] = {
                                date: entry.date,
                                reported: 0,
                                shouldHave: 0
                            }
                        }

                        entriesByCustomers[customer].perDay[entry.date].shouldHave += entry.time;

                        ticketNumbers.forEach((ticketNumber) => {
                            const t = tickets[ticketNumber];
                            const p = t.weight / (t.maxWeight - usedWeights);
                            const distributedAmount = math.round(p * available);

                            usedWeights += t.weight;
                            available -= distributedAmount;

                            t.time = unit + distributedAmount * unit;

                            entriesByCustomers[customer].result.push({
                                activity: entry.activity,
                                ticket: ticketNumber,
                                date: entry.date,
                                time: t.time,
                                comment: t.comments.join(', '),
                                processed: 0
                            })

                            entriesByCustomers[customer].perDay[entry.date].reported += t.time;
                        })

                        callback(null, true);
                    } else {
                        inquirer.prompt([
                                {
                                    type: 'confirm',
                                    name: 'ignore',
                                    message: 'Should activity "' + entry.activity + '" be ignored?',
                                    default: true
                                },
                            ]
                        ).then((answers) => {

                            if (answers.ignore) {
                                ignoreMap[entry.activity] = {};
                                callback(null, false);
                            } else {
                                callback(null, true);
                            }
                        })
                    }

                } else {
                    callback(null, false)
                }
            }

            async.series(entries.map((entry) => {
                return processLine.bind(this, entry);
            }), function () {

                Object.keys(entriesByCustomers).forEach((customer) => {
                    csv.writeToPath('./data/' + customer +'_times.csv', entriesByCustomers[customer].result, {headers: true});
                    csv.writeToPath('./data/' + customer +'_perDay.csv', Object.values(entriesByCustomers[customer].perDay), {headers: true});
                });

            })
        })


    } else {
        throw new Error(reportsPath + ' does not exist!');
    }
}