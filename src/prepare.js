const inquirer = require("inquirer");
const { DateTime } = require("luxon");
const needle = require("needle");
const fs = require("fs");
const processReport = require("./processReport");
const {join} = require("node:path");

module.exports = async function() {

    const answers = await inquirer.prompt([
        {
            name: 'period',
            type: 'list',
            message: 'Select period:',
            choices: [
                {
                    name: `Current Week (${DateTime.now().startOf('week').toISODate()} - ${DateTime.now().endOf('week').toISODate()})`,
                    value: 'current_week'
                },
                {
                    name: `Last Week (${DateTime.now().minus({ weeks: 1 }).startOf('week').toISODate()} - ${DateTime.now().minus({ weeks: 1 }).endOf('week').toISODate()})`,
                    value: 'last_week'
                },
                {
                    name: `Current Month (${DateTime.now().startOf('month').toISODate()} - ${DateTime.now().endOf('month').toISODate()})`,
                    value: 'current_month'
                },
                {
                    name: `Last Month (${DateTime.now().minus({ months: 1 }).startOf('month').toISODate()} - ${DateTime.now().minus({ months: 1 }).endOf('month').toISODate()})`,
                    value: 'last_month'
                },
                { name: 'Custom', value: 'custom' }
            ]
        },
        {
            name: 'start',
            type: 'input',
            message: 'Start Date (YYYY-MM-DD):',
            default: DateTime.now().toISODate(),
            when: (answers) => answers.period === 'custom'
        },
        {
            name: 'end',
            type: 'input',
            message: 'End Date (YYYY-MM-DD):',
            default: DateTime.now().toISODate(),
            when: (answers) => answers.period === 'custom'
        }
    ]);

    let start, end;

    switch (answers.period) {
        case 'current_week':
            start = DateTime.now().startOf('week').toISODate();
            end = DateTime.now().endOf('week').toISODate();
            break;
        case 'last_week':
            start = DateTime.now().minus({ weeks: 1 }).startOf('week').toISODate();
            end = DateTime.now().minus({ weeks: 1 }).endOf('week').toISODate();
            break;
        case 'current_month':
            start = DateTime.now().startOf('month').toISODate();
            end = DateTime.now().endOf('month').toISODate();
            break;
        case 'last_month':
            start = DateTime.now().minus({ months: 1 }).startOf('month').toISODate();
            end = DateTime.now().minus({ months: 1 }).endOf('month').toISODate();
            break;
        case 'custom':
            start = answers.start;
            end = answers.end;
            break;
    }

    const source = require('../config/source.json');

    start = (new Date(start)).getTime();
    end = (new Date(end + ' 23:59:59.999')).getTime();

    if (end <= start) {
        console.error('End date must be after start date');
        return false;
    }

    const url = source.host + '/report.php?group=day&quantisize=1&includeInfos=true&includeColors=false&topic=' + source.access + '&from=' + start + '&to=' + end;
    console.log('Fetching data from ' + url);

    const res = await needle('get', url);

    /**
     * @type {{start: number, name: string, time: number, infos?: {s: string, i: string}[]}[]}
     */
    const entries = res.body.entries;
    const clean = [];


    entries.forEach((entry) => {

        if (entry.time && entry.name && entry.name !== 'Pause') {
            const minutes = Math.round(entry.time / 60000);

            if (minutes > 1) {
                const day = DateTime.fromMillis(entry.start);

                clean.push({
                    date: day.toFormat('yyyy-MM-dd'),
                    activity: entry.name,
                    minutes: minutes,
                    info: entry.infos ? entry.infos.map((info) => {return info.i.trim().replace('teh', 'the')}) : []
                })
            }
        }
    });

    const dataDir = './data/';
    const reportsPath =  dataDir + 'report.json';

    for (const file of await fs.promises.readdir(dataDir)) {
        await fs.promises.unlink(join(dataDir, file));
    }

    await fs.promises.writeFile(reportsPath, JSON.stringify(clean, null, 2));

    await processReport(reportsPath);

    console.log('Report processed and written.');
    return true;
}