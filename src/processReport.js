const { DateTime } = require("luxon");
const fs = require("fs");
const csv = require("fast-csv");
const math = require("mathjs");
const inquirer = require("inquirer");
const async = require("async");
const activities = require("./../config/activities.json");
const byCustomer = require("./../config/byCustomer");

const ignoreMap = {};
const entriesByCustomers = {};

const convertTimeToMinutes = (timeStr) => {
    if (!timeStr || timeStr.trim() === '') return 0;
    
    const match = timeStr.match(/(?:(\d+)h\s*)?(?:(\d+)m\s*)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    return hours * 60 + minutes;
};

const convertCsvToEntries = (csvData) => {
    const entries = [];
    
    csvData.forEach(row => {
        if (row.name && row.name.trim() !== '') {
            const dateParts = row.date.split('/');
            const formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
            
            const entry = {
                activity: row.name,
                date: formattedDate,
                minutes: convertTimeToMinutes(row.time),
                info: row.info ? row.info.split('|').map(item => item.trim()).filter(item => item !== '') : []
            };
            entries.push(entry);
        }
    });
    
    return entries;
};

const processLine = async function (entry) {
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
                    perDay: {},
                    perWeek: {},
                }
            }

            // calculate the rounded time
            const unit = byCustomer[customer].granularity || 0.25;

            const granularityMinutes = unit * 60;
            entry.time = math.ceil(entry.minutes / granularityMinutes) * granularityMinutes / 60;

            if (!entry.info.length) {
                console.error('WARNING, no Comment for', entry, 'customer: ' + customer);

                if (!activityConf.defaultTicket) {
                    throw new Error('Could not handle empty response');
                } else {
                    entry.info.push(activityConf.defaultTicket);
                }
            }

            for (let comment of entry.info) {
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
                    console.log('unknown ticket: ', entry);

                    const answers = await inquirer.prompt([
                        {
                            name: 'ticket',
                            type: 'input',
                            message: `What is the ticket number for the comment "${comment}"? (Customer ${customer})`,
                        }
                    ]);

                    ticket = answers.ticket;

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
            }

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

            // per week calculations
            const dt = DateTime.fromISO(entry.date);
            const weekNumber = dt.weekNumber;
            const weekDay = dt.weekday;

            const weekKey = weekNumber + ' - ' + entry.activity;

            if (!entriesByCustomers[customer].perWeek[weekKey]) {
                entriesByCustomers[customer].perWeek[weekKey] = {
                    week: `${weekNumber} (${entry.date})`,
                    activity: entry.activity,
                    '1': 0,
                    '2': 0,
                    '3': 0,
                    '4': 0,
                    '5': 0,
                    '6': 0,
                    '7': 0,
                    tickets: [],
                    comments: [],
                }
            }

            const weekConf = entriesByCustomers[customer].perWeek[weekKey];

            ticketNumbers.forEach((ticket) => {
                if (weekConf.tickets.indexOf(ticket) < 0) {
                    weekConf.tickets.push(ticket);
                    weekConf.tickets.sort();
                }

                tickets[ticket].comments.forEach((comment) => {
                    if (weekConf.comments.indexOf(comment) < 0) {
                        weekConf.comments.push(comment);
                        weekConf.comments.sort();
                    }
                })
            });

            weekConf[weekDay] += entry.time;

            return true;
        } else {
            let answers = await inquirer.prompt([
                    {
                        name: 'ignore',
                        type: 'confirm',
                        message: 'Should activity "' + entry.activity + '" be ignored?',
                        default: true
                    },
                ]
            );

            if (answers.ignore) {
                ignoreMap[entry.activity] = {};
                return false;
            } else {
                return true;
            }
        }

    } else {
        return false;
    }
}

module.exports = async function (reportsPath) {


    if (fs.existsSync(reportsPath)) {
        
        let entries;
        if (reportsPath.toLowerCase().endsWith('.json')) {
            entries = JSON.parse(fs.readFileSync(reportsPath).toString());
        } else if (reportsPath.toLowerCase().endsWith('.csv')) {
            const csvData = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(reportsPath)
                    .pipe(csv.parse({ headers: true }))
                    .on('data', row => csvData.push(row))
                    .on('end', resolve)
                    .on('error', reject);
            });
            entries = convertCsvToEntries(csvData);
        } else {
            throw new Error('File must be either JSON (.json) or CSV (.csv) format');    
        }

        if (entries.length === 0) {
            throw new Error('The report does not contain any lines.');
        } else {

            for (let entry of entries) {
                await processLine(entry);
            }

            Object.keys(entriesByCustomers).forEach((customer) => {

                // adjust the per week string
                Object.keys(entriesByCustomers[customer].perWeek).forEach((key) => {
                    entriesByCustomers[customer].perWeek[key].tickets = entriesByCustomers[customer].perWeek[key].tickets.join(', ');
                    entriesByCustomers[customer].perWeek[key].comments = entriesByCustomers[customer].perWeek[key].comments.join(', ');
                });

                csv.writeToPath('./data/' + customer + '_times.csv', entriesByCustomers[customer].result, {headers: true});
                csv.writeToPath('./data/' + customer + '_perDay.csv', Object.values(entriesByCustomers[customer].perDay), {headers: true});
                csv.writeToPath('./data/' + customer + '_perWeek.csv', Object.values(entriesByCustomers[customer].perWeek), {headers: true});
            });

            return entriesByCustomers;
        }


    } else {
        throw new Error(reportsPath + ' does not exist!');
    }
}