const inquirer = require("inquirer");
const { DateTime } = require("luxon");
const needle = require("needle");
const fs = require("fs");
const processReport = require("./processReport");
const {join} = require("node:path");

module.exports = async function() {

    const answers = await inquirer.prompt([
        {
            name: 'start',
            type: 'input',
            message: 'Start Date (YYYY-MM-DD):',
            default: DateTime.now().toISODate(),
        },
        {
            name: 'end',
            type: 'input',
            message: 'End Date (YYYY-MM-DD):',
            default: DateTime.now().toISODate(),
        }
    ]);

    const source = require('../config/source.json');

    const start = (new Date(answers.start)).getTime();
    const end = (new Date(answers.end + ' 23:59:59.999')).getTime();

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