const dataFolder = './data/';
const reportsPath = dataFolder + 'report.json';
const inquirer = require("inquirer");
const processReport = require("./src/processReport");
const report = require("./src/report");
const comments = require("./src/comments");

(async function run () {
    let answers = await inquirer.prompt([
        {
            name: 'action',
            type: 'list',
            message: 'Please choose an action',
            choices: [
                {name: 'Prepare a new report', value: 'prepare'},
                {name: 'Rerun Existing (json)', value: 'rerun'},
                {name: 'Rerun Existing (csv)', value: 'rerun_csv'},
                {name: 'Report to external Systems', value: 'report'},
                {name: 'Generate Invoices', value: 'invoices'}
            ]
        }
    ]);
    let data = null;
    let success = false;

    console.log()

    switch (answers.action) {
        default:
            throw new Error('Unknown action ' + answers.action);
        case 'prepare':
            console.log('Preparing a worktime report');

            success = await require('./src/prepare')();

            console.log('Done: %o', success ? 'OK' : 'ERROR');

            break;
        case 'report':
            const byCustomer = require('./config/byCustomer');

            answers = await inquirer.prompt([
                {
                    name: 'customersOrAll',
                    type: 'list',
                    message: 'Would you like to report A specific customer, or all?',
                    default: 'all',
                    choices: [
                        {name: '- ALL -', value: 'all'}
                    ].concat(
                        Object.keys(byCustomer).sort().map((key) => {
                            return typeof byCustomer[key].report === 'function' ? {name: key, value: key} : null;
                        })).filter(i => i)
                }
            ]);

            success = await report(answers.customersOrAll);
            console.log('Reported %o %o',answers.customersOrAll, success);
            break;
        case 'invoices':
            success = await require('./src/invoices')();
            break;
        case 'rerun':
            data = await processReport(reportsPath);
            console.log('Existing report processed!');
            break;
        case 'rerun_csv':
            const fs = require('fs');
            const csvFiles = fs.readdirSync('./data/').filter(file => file.endsWith('.csv') && file.indexOf('time-emphasize_report') > -1);
            
            const csvAnswer = await inquirer.prompt([
                {
                    name: 'csvFile',
                    type: 'list',
                    message: 'Select a CSV file to process:',
                    choices: csvFiles.map(file => ({ name: file, value: './data/' + file }))
                }
            ]);
            
            data = await processReport(csvAnswer.csvFile);
            console.log('CSV report processed!');
            break;
    }

    console.log("");
    console.log(await comments({
        answers, data
    }));

})();

return;